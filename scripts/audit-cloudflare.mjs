import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const native = new Set(builtinModules.map(name => name.replace(/^node:/, '')))
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(file => /^(app|components|lib|scripts)\/.*\.[cm]?[jt]sx?$|^(proxy|next\.config)\.ts$/.test(file))
  .filter(file => !file.includes('/__tests__/') && !file.endsWith('.test.ts'))
  .sort()

// Static evidence only: no application module is imported and no DB is opened.
export function inspectSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const imports = []
  const evidence = []
  function add(kind, node, detail) {
    evidence.push({ kind, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, detail: detail.replace(/\s+/g, ' ').slice(0, 180) })
  }
  function dependency(node, specifier) {
    imports.push(specifier)
    const name = specifier.replace(/^node:/, '')
    if (native.has(name)) add(name.startsWith('fs') ? 'filesystem' : 'node-api', node, specifier)
    if (specifier === 'better-sqlite3') add('sqlite-native', node, specifier)
    if (specifier === 'prom-client' || specifier === 'pino-pretty') add('process-observability', node, specifier)
  }
  function walk(node, transactionDepth = 0, functionDepth = 0) {
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly)
      || (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier)) {
      // Named type-only imports do not produce a runtime dependency.
      const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : undefined
      if (!(bindings && ts.isNamedImports(bindings) && bindings.elements.every(item => item.isTypeOnly)
        && !node.importClause.name)) dependency(node, node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      if ((expression.kind === ts.SyntaxKind.ImportKeyword || expression.getText(source) === 'require')
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) dependency(node, node.arguments[0].text)
      if (ts.isPropertyAccessExpression(expression)) {
        const name = expression.name.text
        if (['prepare', 'exec', 'pragma', 'transaction', 'immediate', 'backup'].includes(name)
          && /^(db|_db|database|applyMigration|update)(\.|$)/.test(expression.expression.getText(source))) {
          add(name === 'transaction' && transactionDepth > 0 ? 'nested-transaction' : `sql-${name}`, node, expression.getText(source))
        }
        if (name === 'transaction') transactionDepth++
      }
      if (['after', 'setTimeout', 'setInterval'].includes(expression.getText(source))) add('deferred-work', node, expression.getText(source))
    }
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'process') add('process-global', node, node.getText(source))
    if (ts.isIdentifier(node) && node.text === 'globalThis') add('runtime-global', node, 'globalThis')
    if (ts.isVariableDeclarationList(node) && functionDepth === 0 && !(node.flags & ts.NodeFlags.Const)) add('module-mutable-state', node, node.getText(source).slice(0, 120))
    if (ts.isNewExpression(node) && functionDepth === 0) add('module-initialization', node, node.expression.getText(source))
    if (ts.isExportAssignment(node) && ts.isCallExpression(node.expression)) add('module-initialization', node, node.expression.expression.getText(source))
    if (ts.isStringLiteralLike(node) && /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|PRAGMA)\b/.test(node.text)) {
      add('sql-text', node, node.text.trim().replace(/\s+/g, ' ').slice(0, 160))
    }
    const nextFunctionDepth = functionDepth + (ts.isFunctionLike(node) ? 1 : 0)
    ts.forEachChild(node, child => walk(child, transactionDepth, nextFunctionDepth))
  }
  walk(source)
  return { file, sha256: createHash('sha256').update(text).digest('hex'), imports: [...new Set(imports)].sort(), evidence }
}

export function resolveLocal(file, specifier, knownFiles) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const base = specifier.startsWith('@/') ? specifier.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
  return [base, ...['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'].map(extension => base + extension)]
    .find(candidate => knownFiles.has(candidate)) ?? null
}

export function collectDependencies(file, modules, visited = new Set()) {
  if (visited.has(file)) return visited
  visited.add(file)
  for (const dependency of modules.get(file)?.dependencies ?? []) collectDependencies(dependency, modules, visited)
  return visited
}

function generate() {
  const modules = new Map(files.map(file => [file, inspectSource(file, readFileSync(path.join(root, file), 'utf8'))]))
  const knownFiles = new Set(files)
  for (const item of modules.values()) item.dependencies = item.imports.map(specifier => resolveLocal(item.file, specifier, knownFiles)).filter(Boolean)
  const counts = {}
  for (const item of modules.values()) for (const { kind } of item.evidence) counts[kind] = (counts[kind] ?? 0) + 1
  const entrypoints = files.filter(file => /^app\/.*\/(page|layout|route)\.tsx?$|^app\/(page|layout)\.tsx?$|^proxy\.ts$/.test(file))
    .map(file => {
      // Layouts and the proxy execute even when the page itself only renders UI.
      const inherited = ['proxy.ts']
      if (!file.endsWith('/route.ts') && !file.endsWith('/route.js')) {
        for (let directory = path.posix.dirname(file); directory.startsWith('app'); directory = path.posix.dirname(directory)) {
          for (const extension of ['.ts', '.tsx']) if (modules.has(`${directory}/layout${extension}`)) inherited.push(`${directory}/layout${extension}`)
        }
      }
      const closure = collectDependencies(file, modules)
      for (const dependency of inherited) collectDependencies(dependency, modules, closure)
      const risks = [...closure].flatMap(dependency => modules.get(dependency)?.evidence.map(item => ({ file: dependency, ...item })) ?? [])
      const kinds = [...new Set(risks.map(item => item.kind))].sort()
      const status = kinds.includes('sqlite-native') ? 'blocked' : kinds.some(kind => ['filesystem', 'process-observability', 'deferred-work', 'runtime-global'].includes(kind)) ? 'refactor' : kinds.length ? 'adaptation' : 'candidate'
      return { file, status, kinds, dependencies: [...closure].sort() }
    })
  const report = {
    schemaVersion: 1,
    baseCommit: execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim(),
    method: 'Conservative static AST inventory; runtime imports plus inherited layouts and proxy. No proof of runtime compatibility; computed imports and third-party internals need manual review.',
    counts, modules: [...modules.values()], entrypoints,
  }
  const markdown = [
    '# Inventario generado de compatibilidad', '',
    'Generar: `npm run audit:cloudflare`. Verificar: `npm run audit:cloudflare -- --check`.', '',
    `Base auditada: \`${report.baseCommit}\`. ${files.length} módulos; ${entrypoints.length} entradas.`, '',
    'Análisis conservador de imports de runtime (incluidos dinámicos literales), layouts ancestros y proxy. No ejecuta código de producto. `candidate` significa candidato sin señales detectadas, **no compatible probado**. Las dependencias transitivas de paquetes y los imports calculados requieren revisión manual.', '',
    '## Señales directas', '', '| Señal | Apariciones |', '|---|---:|',
    ...Object.entries(counts).sort().map(([kind, count]) => `| ${kind} | ${count} |`), '',
    '## Entradas (rutas, layouts y proxy)', '', '| Entrada | Estado | Señales transitivas |', '|---|---|---|',
    ...entrypoints.map(item => `| \`${item.file}\` | ${item.status} | ${item.kinds.join(', ')} |`), '',
    '## Evidencia directa por módulo', '',
    ...[...modules.values()].filter(item => item.evidence.length).flatMap(item => [
      `### ${item.file}`, '',
      ...item.evidence.map(evidence => `- L${evidence.line}: **${evidence.kind}** — \`${evidence.detail.replaceAll('`', "'")}\``), '',
    ]),
  ].join('\n')
  const outputs = new Map([
    ['docs/deploy-cloudflare/inventory.json', JSON.stringify(report, null, 2) + '\n'],
    ['docs/deploy-cloudflare/inventory.md', markdown],
  ])
  for (const [file, content] of outputs) {
    if (process.argv.includes('--check')) {
      if (readFileSync(path.join(root, file), 'utf8') !== content) throw new Error(`Stale inventory: ${file}; run npm run audit:cloudflare`)
    } else writeFileSync(path.join(root, file), content)
  }
  console.log(`Audited ${files.length} modules and ${entrypoints.length} entrypoints without importing application code.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generate()
