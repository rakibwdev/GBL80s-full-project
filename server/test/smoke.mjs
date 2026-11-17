// End-to-end acceptance test: runs the real app on a temp database and uploads folder.
import assert from 'node:assert/strict';import bcrypt from 'bcryptjs';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDb} from '../src/db.js';import {createApp} from '../src/app.js';
const db=openDb(':memory:'),dir=mkdtempSync(join(tmpdir(),'gbl-'));
const mk=(em,role,club)=>db.prepare('INSERT INTO users(email,name,password_hash,role,club) VALUES(?,?,?,?,?)').run(em,em,bcrypt.hashSync('password-123456',4),role,club);
mk('admin@t.com','admin',null);mk('lakers@t.com','contributor','gippsland-lakers');mk('sale@t.com','contributor','sale');
const srv=createApp({db,secret:'test-secret-0123456789',uploadDir:dir}).listen(0);const base='http://127.0.0.1:'+srv.address().port;
const JPG=Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9','hex');
async function call(m,p,{json,form,jar,csrf=true}={}){const h={};if(csrf)h['X-Requested-With']='gbl';if(jar?.c)h.Cookie=jar.c;if(json)h['Content-Type']='application/json';
const r=await fetch(base+p,{method:m,headers:h,body:json?JSON.stringify(json):form});const sc=r.headers.get('set-cookie');if(sc&&jar)jar.c=sc.split(';')[0];
const ct=r.headers.get('content-type')||'';return {s:r.status,b:ct.includes('json')?await r.json():null,ct}}
const login=async e=>{const jar={};const r=await call('POST','/api/auth/login',{json:{email:e,password:'password-123456'},jar});assert.equal(r.s,200);return jar};
const form=(o,files=[])=>{const f=new FormData();for(const k in o)f.append(k,o[k]);files.forEach(([n,buf])=>f.append('files',new Blob([buf]),n));return f};
const ok=n=>console.log('PASS',n);
try{
const adm=await login('admin@t.com'),lak=await login('lakers@t.com'),sal=await login('sale@t.com');
assert.equal((await call('GET','/api/clubs')).b.length,16);assert.ok(!(await call('GET','/api/clubs')).b.some(c=>/lakes|drouin|phillip/i.test(c.name)));ok('16 clubs/teams incl. Lakers; removed towns absent');
assert.equal((await call('POST','/api/auth/login',{json:{email:'admin@t.com',password:'x'}})).s,401);ok('wrong password rejected');
assert.equal((await call('POST','/api/items',{form:form({type:'Social',title:'x',permission:'true'}),jar:lak,csrf:false})).s,403);ok('CSRF header required');
assert.equal((await call('POST','/api/items',{form:form({type:'Team photograph',title:'No permission'},[['a.jpg',JPG]]),jar:lak})).s,400);ok('permission declaration required');
assert.equal((await call('POST','/api/items',{form:form({type:'Team photograph',title:'Bad file',permission:'true'},[['a.jpg',Buffer.from('not an image')]]),jar:lak})).s,400);ok('fake image rejected by byte check');
assert.equal((await call('POST','/api/items',{form:form({type:'Team photograph',title:'x',permission:'true'}),jar:lak})).s,400);ok('non-social item needs a file');
for(const t of ['Awards night 1984','Awards night second photo']){const r=await call('POST','/api/items',{form:form({type:'Team photograph',title:t,year:'1984',people:'Team',event:'Awards',permission:'true',club:'sale'},[['a.jpg',JPG],['b.jpg',JPG]]),jar:lak});assert.equal(r.s,201)}ok('contributor submits a batch (club forced to own club)');
const soc=await call('POST','/api/items',{form:form({type:'Social',title:'Presentation night',caption:'Great night',permission:'true'}),jar:lak});assert.equal(soc.s,201);ok('social post without a file');
assert.equal((await call('GET','/api/items')).b.items.length,0);assert.equal((await call('GET','/api/files/1')).s,404);ok('nothing public before approval (items and files)');
const mine=(await call('GET','/api/my/items',{jar:lak})).b;assert.equal(mine.length,3);assert.ok(mine.every(i=>i.club==='gippsland-lakers'&&i.status==='pending'));assert.equal((await call('GET','/api/files/1',{jar:lak})).s,200);assert.equal((await call('GET','/api/files/1',{jar:sal})).s,404);ok('owner sees pending; other club cannot');
assert.equal((await call('POST','/api/admin/items/1/review',{json:{status:'approved'},jar:lak})).s,403);ok('contributor cannot approve');
assert.equal((await call('POST','/api/admin/items/2/review',{json:{status:'declined'},jar:adm})).s,400);ok('decline needs a note');
assert.equal((await call('POST','/api/admin/items/1/review',{json:{status:'approved'},jar:adm})).s,200);assert.equal((await call('POST','/api/admin/items/2/review',{json:{status:'declined',note:'Blurry'},jar:adm})).s,200);assert.equal((await call('POST','/api/admin/items/3/review',{json:{status:'approved'},jar:adm})).s,200);ok('editors approve / decline');
const f=await call('GET','/api/items?club=gippsland-lakers&q=awards&decade=198');assert.equal(f.b.items.length,1);assert.equal(f.b.items[0].files.length,2);assert.equal((await call('GET','/api/items?club=sale')).b.items.length,0);ok('approved item searchable on the correct club only');
assert.equal((await call('GET','/api/items?type=Social&club=gippsland-lakers')).b.items[0].title,'Presentation night');assert.equal((await call('GET','/api/files/1')).ct,'image/jpeg');ok('social post + approved file served publicly');
assert.equal((await call('GET','/api/files/3')).s,404);ok('declined item files stay private');
const n=await call('POST','/api/nominations',{form:form({category:'legends',nominee:'Test Person',story:'Great',nominator_name:'N',nominator_contact:'n@x.com',acknowledged:'true'},[['p.jpg',JPG]])});assert.equal(n.s,201);
assert.equal((await call('GET','/api/recognition/legends')).b.length,0);assert.equal((await call('GET','/api/files/'+(db.prepare('SELECT MAX(id) m FROM files').get().m))).s,404);ok('public nomination stays private until approved');
await call('POST','/api/admin/nominations/1/review',{json:{status:'approved'},jar:adm});assert.equal((await call('GET','/api/recognition/legends')).b[0].nominee,'Test Person');ok('approved nomination appears in gallery');
assert.equal((await call('POST','/api/nominations',{form:form({category:'legends',nominee:'Bot',story:'x',nominator_name:'b',nominator_contact:'b',acknowledged:'true',website:'spam.com'})})).b.ok,true);assert.equal(db.prepare('SELECT COUNT(*) c FROM nominations').get().c,1);ok('honeypot silently drops spam');
assert.equal((await call('POST','/api/items/1/report',{json:{message:'Wrong name'}})).s,200);assert.equal((await call('GET','/api/admin/reports',{jar:adm})).b.length,1);ok('visitors can report mistakes');
const x=(await call('GET','/api/admin/export',{jar:adm})).b;assert.ok(x.items.length===3&&!JSON.stringify(x).includes('password_hash'));ok('full export without password hashes');
console.log('\nALL ACCEPTANCE CHECKS PASSED')}catch(e){console.error('FAIL',e);process.exitCode=1}finally{srv.close()}
