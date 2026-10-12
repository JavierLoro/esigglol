import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

function source(file) {
  const contents = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, '$1$2.mjs$3')
  return { path: path.resolve(file.replace(/\.ts$/, '.mjs')), type: 'ESModule', contents }
}
const context = `import { AsyncLocalStorage } from 'node:async_hooks';
const context=new AsyncLocalStorage();export const withRuntime=(value,fn)=>context.run(value,fn);export const getRuntime=()=>context.getStore();`
// Fixture-only restore endpoints exist exclusively in this isolated test Worker.
// The SQL fixture deliberately excludes FileBudget and credentials.
const entry = `import {DurableObject} from 'cloudflare:workers';
import {createDatabase} from './cloudflare/database.mjs';import {runMigrations} from './lib/db-migrations.mjs';
import {withRuntime} from './cloudflare/context.mjs';import {writeFile,readFile,unlink,collectGarbage,FILE_LIMITS} from './cloudflare/file-store.mjs';
export {FileBudget} from './cloudflare/file-budget.mjs';
export class FilesTest extends DurableObject {
constructor(state,env){super(state,env);this.db=createDatabase(state.storage);this.db.exec("CREATE TABLE IF NOT EXISTS cloudflare_files(name TEXT PRIMARY KEY,state TEXT,created_at INTEGER NOT NULL DEFAULT 0)");runMigrations(this.db);this.failDelete=false;}
async alarm(){}
async fetch(request){const bucket=this.env.FILES;const env={...this.env,FILES:{put:bucket.put.bind(bucket),get:bucket.get.bind(bucket),delete:(key)=>{if(this.failDelete){this.failDelete=false;throw Error('Injected deletion failure')}return bucket.delete(key)}}};
return withRuntime({database:this.db,state:this.ctx,env},async()=>{
const db=this.db;const name=new URL(request.url).pathname;
const put=async(name,content='logo')=>writeFile('/data/uploads/'+name,Buffer.from(content));
const team=(id,logo)=>db.prepare('INSERT INTO teams(id,data) VALUES(?,?)').run(id,JSON.stringify({id,logo:'/api/uploads/'+logo,players:[]}));
const usage=()=>this.env.FILE_BUDGET.getByName('esigglol-application').usage();
const state=async()=>({files:db.prepare('SELECT name,state,created_at FROM cloudflare_files').all(),alarm:await this.ctx.storage.getAlarm(),usage:await usage()});
if(name==='/seed'){
for(let i=0;i<20;i++){await put('referenced-'+i+'.svg');team('team-'+i,'referenced-'+i+'.svg');}
await put('brand.svg');db.prepare('INSERT INTO tournament_config(key,data) VALUES(?,?)').run('site-branding',JSON.stringify({logo:'/api/uploads/brand.svg'}));
await put('pending.svg');db.prepare('INSERT INTO team_change_requests(id,team_id,type,payload) VALUES(?,?,?,?)').run('pending','team-0','team_logo',JSON.stringify({logo:'/api/uploads/pending.svg'}));
for(let i=0;i<13;i++)await put('orphan-'+i+'.svg');
db.prepare('UPDATE cloudflare_files SET created_at=0').run();await put('young.svg');db.prepare('UPDATE cloudflare_files SET created_at=? WHERE name=?').run(Date.now()+120000,'young.svg');
return Response.json(await state());}
if(name==='/collect'){await this.ctx.storage.deleteAlarm();await collectGarbage();return Response.json(await state());}
if(name==='/age'){db.prepare('UPDATE cloudflare_files SET created_at=0 WHERE name=?').run('young.svg');return Response.json({ok:true});}
if(name==='/failure'){await put('failure.svg');db.prepare('UPDATE cloudflare_files SET created_at=0 WHERE name=?').run('failure.svg');await this.ctx.storage.deleteAlarm();this.failDelete=true;let failed=false;try{await collectGarbage()}catch{failed=true}return Response.json({failed,...await state()});}
if(name==='/backup'){await put('recover.svg','<svg>recovery fixture</svg>');team('recovery','recover.svg');const bytes=await readFile('/data/uploads/recover.svg');return Response.json({team:db.prepare('SELECT * FROM teams WHERE id=?').get('recovery'),file:db.prepare('SELECT * FROM cloudflare_files WHERE name=?').get('recover.svg'),bytes:bytes.toString('base64'),usage:await usage()});}
if(name==='/damage'){db.prepare('DELETE FROM teams WHERE id=?').run('recovery');await unlink('/data/uploads/recover.svg');return Response.json(await state());}
if(name==='/restore-sql'){const backup=await request.json();db.transaction(()=>{db.prepare('UPDATE cloudflare_files SET state=?,created_at=? WHERE name=?').run(backup.file.state,backup.file.created_at,backup.file.name);db.prepare('INSERT INTO teams(id,data,version) VALUES(?,?,?)').run(backup.team.id,backup.team.data,backup.team.version)})();return Response.json({team:db.prepare('SELECT * FROM teams WHERE id=?').get('recovery'),usage:await usage()});}
if(name==='/restore-r2'){const backup=await request.json();const bytes=Buffer.from(backup.bytes,'base64');const metadata={contentType:'image/svg+xml'};if(bytes.length>FILE_LIMITS.objectBytes||!await this.env.FILE_BUDGET.getByName('esigglol-application').reserve(1,0,bytes.length+JSON.stringify(metadata).length))return new Response(null,{status:429});await this.env.FILES.put(backup.file.name,bytes,{storageClass:'Standard',httpMetadata:metadata});return Response.json({usage:await usage()});}
if(name==='/read'){try{return new Response(await readFile('/data/uploads/recover.svg'))}catch(error){return new Response(null,{status:error.code==='ENOENT'?404:500})}}
return new Response(null,{status:404});});}}
export default {fetch(request,env){return env.TEST.getByName('files').fetch(request)}};`
const options = convertV4MiniflareOptions({
  name: 'files-test', modulesRoot: process.cwd(),
  modules: [
    { path: path.resolve('files-entry.mjs'), type: 'ESModule', contents: entry },
    { path: path.resolve('cloudflare/context.mjs'), type: 'ESModule', contents: context },
    { path: path.resolve('cloudflare/assets.mjs'), type: 'ESModule', contents: 'export default {version:""}' },
    ...['cloudflare/database.ts', 'lib/db-migrations.ts', 'cloudflare/file-budget.ts', 'cloudflare/file-store.ts', 'cloudflare/schedule.ts', 'lib/storage-quota.ts'].map(source),
  ],
  compatibilityDate: '2026-10-10', compatibilityFlags: ['nodejs_compat'],
  durableObjects: { TEST: { className: 'FilesTest', useSQLite: true }, FILE_BUDGET: { className: 'FileBudget', useSQLite: true } },
  r2Buckets: { FILES: 'isolated-files-test' },
})
const runtime = new Miniflare(options)
const request = (route, body) => runtime.dispatchFetch(`https://files.test${route}`, body ? { method: 'POST', body: JSON.stringify(body) } : {})
const json = async (route, body) => {
  const response = await request(route, body)
  assert.equal(response.status, 200)
  return response.json()
}
try {
  await json('/seed')
  let result = await json('/collect')
  assert.equal(result.files.filter(file => file.name.startsWith('referenced-') && file.state === 'live').length, 20)
  assert.equal(result.files.find(file => file.name === 'brand.svg').state, 'live')
  assert.equal(result.files.find(file => file.name === 'pending.svg').state, 'live')
  assert.equal(result.files.filter(file => file.name.startsWith('orphan-') && file.state === 'deleted').length, 10)
  assert.ok(result.alarm !== null && result.alarm < Date.now() + 10000, 'Remaining batches must schedule another alarm')
  result = await json('/collect')
  assert.equal(result.files.filter(file => file.name.startsWith('orphan-') && file.state === 'deleted').length, 13)
  const young = result.files.find(file => file.name === 'young.svg')
  assert.equal(young.state, 'live')
  assert.equal(result.alarm, young.created_at + 300000, 'A young orphan must retain its future cleanup alarm')
  await json('/age')
  result = await json('/collect')
  assert.equal(result.files.find(file => file.name === 'young.svg').state, 'deleted')
  assert.equal(result.alarm, null, 'Referenced logos must not cause perpetual alarms')
  result = await json('/failure')
  assert.equal(result.failed, true)
  assert.equal(result.files.find(file => file.name === 'failure.svg').state, 'deleting')
  assert.ok(result.alarm !== null && result.alarm <= Date.now() + 60000, 'A failed deletion must remain scheduled')
  result = await json('/collect')
  assert.equal(result.files.find(file => file.name === 'failure.svg').state, 'deleted')
  assert.equal(result.alarm, null)

  const backup = await json('/backup')
  const damaged = await json('/damage')
  assert.deepEqual(damaged.usage, backup.usage, 'Deletion must not refund the budget')
  assert.equal((await request('/read')).status, 404)
  const sql = await json('/restore-sql', backup)
  assert.deepEqual(sql.team, backup.team)
  assert.equal((await request('/read')).status, 404, 'SQL restore alone cannot recover a deleted R2 logo')
  const restored = await json('/restore-r2', backup)
  assert.equal(restored.usage.class_a, backup.usage.class_a + 1, 'Restoring R2 must reserve another write')
  assert.ok(restored.usage.class_b >= backup.usage.class_b, 'SQL recovery must not reset read reservations')
  assert.ok(restored.usage.bytes > backup.usage.bytes, 'SQL recovery must not reset written bytes')
  assert.equal(await (await request('/read')).text(), Buffer.from(backup.bytes, 'base64').toString())
  console.log('Cloudflare orphan batches, future alarms, deletion retries and isolated SQL + R2 fixture recovery without quota refunds passed')
} finally {
  await runtime.dispose()
}
