import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

function source(file, name) { return { path: path.resolve(name), type: 'ESModule', contents: ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText } }
const entry = `import {DurableObject} from 'cloudflare:workers';
import {createDatabase} from './database.mjs';import {runMigrations,migrations} from './migrations.mjs';export {FileBudget} from './budget.mjs';
export class StorageTest extends DurableObject {
async fetch(){const db=createDatabase(this.ctx.storage);db.exec("CREATE TABLE cloudflare_files(name TEXT PRIMARY KEY,state TEXT);CREATE TABLE test_rows(id TEXT PRIMARY KEY)");runMigrations(db);
let rollback=false;try{db.transaction(()=>{db.prepare('INSERT INTO test_rows VALUES(?)').run('first');throw new Error('fail')}).immediate()}catch{rollback=db.prepare('SELECT * FROM test_rows').all().length===0}
db.transaction(()=>{db.prepare('INSERT INTO test_rows VALUES(?)').run('outer');try{db.transaction(()=>{db.prepare('INSERT INTO test_rows VALUES(?)').run('inner');throw new Error('fail')})()}catch{}db.prepare('INSERT INTO test_rows VALUES(?)').run('after')})();
let migrationRollback=false;try{runMigrations(db,[...migrations,{version:6,name:'failing',up(db){db.exec('CREATE TABLE failed_migration(id TEXT)');throw new Error('fail')}}])}catch{migrationRollback=!db.prepare("SELECT 1 FROM sqlite_master WHERE name='failed_migration'").get()&&!db.prepare('SELECT 1 FROM schema_migrations WHERE version=6').get()}
db.prepare("INSERT INTO cloudflare_files VALUES('logo.svg','deleting')").run();let tombstone=false;try{db.prepare('INSERT INTO teams(id,data) VALUES(?,?)').run('bad',JSON.stringify({logo:'/api/uploads/logo.svg'}))}catch{tombstone=!db.prepare("SELECT 1 FROM teams WHERE id='bad'").get()}
return Response.json({rollback,nested:db.prepare('SELECT id FROM test_rows ORDER BY id').all().map(r=>r.id),migrationRollback,tombstone})}}
export default {async fetch(r,e){if(new URL(r.url).pathname==='/quota'){const q=e.FILE_BUDGET.getByName('budget');const results=await Promise.all(Array.from({length:1010},()=>q.reserve(1,0,1)));return Response.json({allowed:results.filter(Boolean).length,usage:await q.usage(),over:await q.reserve(1,0,1)})}return e.TEST.getByName('one').fetch(r)}};`
const options = convertV4MiniflareOptions({ name: 'storage-test', modulesRoot: process.cwd(), modules: [{ path: path.resolve('entry.mjs'), type: 'ESModule', contents: entry }, source('cloudflare/database.ts', 'database.mjs'), source('lib/db-migrations.ts', 'migrations.mjs'), source('cloudflare/file-budget.ts', 'budget.mjs')], compatibilityDate: '2026-10-10', compatibilityFlags: ['nodejs_compat'], durableObjects: { TEST: { className: 'StorageTest', useSQLite: true }, FILE_BUDGET: { className: 'FileBudget', useSQLite: true } } })
const runtime = new Miniflare(options)
try {
  const result = await (await runtime.dispatchFetch('https://test/')).json()
  assert.deepEqual(result, { rollback: true, nested: ['after', 'outer'], migrationRollback: true, tombstone: true })
  const quota = await (await runtime.dispatchFetch('https://test/quota')).json()
  assert.deepEqual(quota, { allowed: 1000, usage: { class_a: 1000, class_b: 0, bytes: 1000 }, over: false })
  console.log('Cloudflare rollback, nested transactions, migration rollback, tombstones and concurrent hard quota passed')
} finally { await runtime.dispose() }
