// Creates the first administrator (and optional demo content). Safe to re-run.
import bcrypt from 'bcryptjs';import {resolve} from 'node:path';import {openDb,slug} from '../src/db.js';
const e=process.env,root=new URL('..',import.meta.url).pathname,db=openDb(resolve(root,e.DB_FILE||'./data/gbl80s.db'));
const email=e.ADMIN_EMAIL,pw=e.ADMIN_PASSWORD;if(!email||!pw||pw.length<10){console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters).');process.exit(1)}
if(!db.prepare('SELECT 1 FROM users WHERE email=?').get(email)){db.prepare("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'admin')").run(email,'GBL 80s Administrator',bcrypt.hashSync(pw,10));console.log('Admin created:',email)}else console.log('Admin already exists:',email);
if(process.argv.includes('--demo')){const add=(em,club)=>{if(!db.prepare('SELECT 1 FROM users WHERE email=?').get(em))db.prepare("INSERT INTO users(email,name,password_hash,role,club) VALUES(?,?,?,'contributor',?)").run(em,club+' representative',bcrypt.hashSync('demo-password-1',10),slug(club))};
add('sale@example.com','Sale');add('lakers@example.com','Gippsland Lakers');
if(!db.prepare('SELECT 1 FROM posts').get())db.prepare("INSERT INTO posts(kind,title,body) VALUES('reunion','2026 GBL 80s reunion','Date, venue and booking details will be announced by the GBL 80s Team.')").run();
console.log('Demo contributors: sale@example.com and lakers@example.com / demo-password-1')}
