import express from 'express';import helmet from 'helmet';import cors from 'cors';import cookieParser from 'cookie-parser';import rateLimit from 'express-rate-limit';
import multer from 'multer';import bcrypt from 'bcryptjs';import jwt from 'jsonwebtoken';
import {mkdirSync,openSync,readSync,closeSync,renameSync,rmSync,existsSync} from 'node:fs';import {join,resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {tx} from './db.js';

const TYPES=['Team photograph','Newspaper clipping','Programme','Scorecard','Grand final','Social','Memorabilia'];
const CATS=['remarkables','legends','tributes'],STATUS=['pending','approved','corrections_requested','declined','removed'];
const err=(c,m)=>Object.assign(new Error(m),{status:c});
const S=(v,n=500)=>String(v??'').trim().slice(0,n);
const need=(o,...k)=>k.forEach(x=>{if(!S(o[x],5000))throw err(400,`${x} is required`)});
const yes=v=>v===true||v==='true'||v==='on'||v==='1'||v===1;

export function createApp({db,secret,uploadDir,frontendDir,corsOrigin,maxFileMb=15,prod=false}){
if(!secret||secret.length<16)throw new Error('JWT_SECRET must be set (16+ chars)');
mkdirSync(uploadDir,{recursive:true});const app=express();app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],fontSrc:["https://fonts.gstatic.com"],imgSrc:["'self'","data:","blob:"],frameSrc:["'self'"],objectSrc:["'self'"]}},crossOriginResourcePolicy:{policy:'same-site'}}));
if(corsOrigin)app.use(cors({origin:corsOrigin,credentials:true}));
app.use(express.json({limit:'100kb'}),cookieParser());
// CSRF defence: cookies are SameSite=Lax and every state-changing call must carry this header
app.use((q,r,n)=>(['GET','HEAD','OPTIONS'].includes(q.method)||q.get('X-Requested-With')==='gbl')?n():n(err(403,'Missing X-Requested-With header')));
const lim=(max,min=60)=>rateLimit({windowMs:min*60e3,max,standardHeaders:true,legacyHeaders:false,message:{error:'Too many requests, please try again later.'}});

// ---------- auth ----------
const cookie={httpOnly:true,sameSite:'lax',secure:prod,maxAge:12*3600e3};
const me=(q,r,n)=>{try{const t=jwt.verify(q.cookies.gbl||'',secret),u=db.prepare('SELECT id,email,name,role,club,active FROM users WHERE id=?').get(t.id);if(u?.active)q.user=u}catch{}n()};
app.use(me);
const auth=(...roles)=>(q,r,n)=>!q.user?n(err(401,'Please sign in')):roles.length&&!roles.includes(q.user.role)?n(err(403,'Not allowed')):n();
const admin=auth('admin'),contrib=auth('contributor','admin');
app.post('/api/auth/login',lim(10,15),(q,r)=>{need(q.body,'email','password');const u=db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(S(q.body.email));
if(!u||!bcrypt.compareSync(String(q.body.password),u.password_hash))throw err(401,'Wrong email or password');
r.cookie('gbl',jwt.sign({id:u.id},secret,{expiresIn:'12h'}),cookie).json({id:u.id,name:u.name,email:u.email,role:u.role,club:u.club})});
app.post('/api/auth/logout',(q,r)=>r.clearCookie('gbl').json({ok:true}));
app.get('/api/auth/me',(q,r)=>r.json(q.user||null));
app.post('/api/auth/password',auth(),lim(10,15),(q,r)=>{need(q.body,'current','next');if(S(q.body.next).length<10)throw err(400,'Password must be at least 10 characters');
const u=db.prepare('SELECT * FROM users WHERE id=?').get(q.user.id);if(!bcrypt.compareSync(String(q.body.current),u.password_hash))throw err(401,'Current password is wrong');
db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(q.body.next),10),u.id);r.json({ok:true})});
const audit=(q,a,t)=>db.prepare('INSERT INTO audit(user_id,action,target) VALUES(?,?,?)').run(q.user?.id??null,a,String(t));

// ---------- uploads (type sniffed from file bytes, never trusted from the client) ----------
const sniff=p=>{const fd=openSync(p,'r'),b=Buffer.alloc(8);readSync(fd,b,0,8,0);closeSync(fd);
return b[0]===0xff&&b[1]===0xd8?['image/jpeg','jpg']:b.toString('hex',0,4)==='89504e47'?['image/png','png']:b.toString('latin1',0,4)==='%PDF'?['application/pdf','pdf']:null};
const up=multer({dest:join(uploadDir,'_tmp'),limits:{fileSize:maxFileMb*1048576,files:20,fields:30},fileFilter:(q,f,cb)=>/\.(jpe?g|png|pdf)$/i.test(f.originalname)?cb(null,true):cb(err(400,'Only JPEG, PNG and PDF files are accepted'))}).array('files',20);
const upload=(q,r,n)=>up(q,r,e=>n(e?.code==='LIMIT_FILE_SIZE'?err(400,`Each file must be under ${maxFileMb} MB`):e));
const keep=files=>{const out=[];try{for(const f of files||[]){const t=sniff(f.path);if(!t)throw err(400,`"${f.originalname}" is not a valid JPEG, PNG or PDF`);const name=`${randomUUID()}.${t[1]}`;renameSync(f.path,join(uploadDir,name));out.push({path:name,mime:t[0],size:f.size,name:S(f.originalname,200)})}}
catch(e){out.forEach(o=>rmSync(join(uploadDir,o.path),{force:true}));(files||[]).forEach(f=>rmSync(f.path,{force:true}));throw e}return out};
const addFiles=(files,col,id)=>files.forEach(f=>db.prepare(`INSERT INTO files(${col},path,mime,size,original_name) VALUES(?,?,?,?,?)`).run(id,f.path,f.mime,f.size,f.name));
const dropFiles=(col,id)=>{db.prepare(`SELECT path FROM files WHERE ${col}=?`).all(id).forEach(f=>rmSync(join(uploadDir,f.path),{force:true}))};

// ---------- shaping ----------
const filesOf=(col,id)=>db.prepare(`SELECT id,mime,original_name name FROM files WHERE ${col}=? ORDER BY id`).all(id).map(f=>({...f,url:`/api/files/${f.id}`}));
const pubItem=i=>({id:i.id,club:i.club,clubName:i.clubName,type:i.type,title:i.title,caption:i.caption,year:i.year,people:i.people,event:i.event,source:i.source,createdAt:i.created_at,files:filesOf('item_id',i.id)});
const fullItem=i=>({...pubItem(i),contact:i.contact,status:i.status,note:i.reviewer_note,submittedBy:i.submitter||null});
const SEL='SELECT i.*,c.name clubName,u.email submitter FROM items i JOIN clubs c ON c.slug=i.club LEFT JOIN users u ON u.id=i.submitted_by';
const rec=n=>db.prepare('SELECT * FROM nominations WHERE id=?').get(n);

// ---------- public ----------
app.get('/api/clubs',(q,r)=>r.json(db.prepare('SELECT slug,name,division FROM clubs WHERE active=1 ORDER BY sort').all()));
app.get('/api/items',(q,r)=>{const w=["i.status='approved'"],p=[];const {club,type,decade,event,person}=q.query;
if(club){w.push('i.club=?');p.push(S(club))}if(type){w.push('i.type=?');p.push(S(type))}
if(decade==='unknown')w.push("i.year=''");else if(/^\d{3}$/.test(S(decade))){w.push('i.year LIKE ?');p.push(S(decade)+'%')}
if(event){w.push('i.event LIKE ?');p.push(`%${S(event,100)}%`)}if(person){w.push('i.people LIKE ?');p.push(`%${S(person,100)}%`)}
for(const t of S(q.query.q,200).split(/\s+/).filter(Boolean).slice(0,8)){w.push("(i.title||' '||i.caption||' '||i.people||' '||i.event||' '||i.type||' '||c.name||' '||i.year) LIKE ?");p.push(`%${t}%`)}
const lim=Math.min(+q.query.limit||60,200),off=Math.max(+q.query.offset||0,0);
const rows=db.prepare(`${SEL} WHERE ${w.join(' AND ')} ORDER BY i.created_at DESC,i.id DESC LIMIT ? OFFSET ?`).all(...p,lim,off);
r.json({items:rows.map(pubItem)})});
app.get('/api/items/:id',(q,r)=>{const i=db.prepare(`${SEL} WHERE i.id=? AND i.status='approved'`).get(+q.params.id);if(!i)throw err(404,'Not found');r.json(pubItem(i))});
app.post('/api/items/:id/report',lim(10),(q,r)=>{need(q.body,'message');if(q.body.website)return r.json({ok:true});
if(!db.prepare("SELECT 1 FROM items WHERE id=? AND status='approved'").get(+q.params.id))throw err(404,'Not found');
db.prepare('INSERT INTO reports(item_id,message,contact) VALUES(?,?,?)').run(+q.params.id,S(q.body.message,2000),S(q.body.contact,200));r.json({ok:true})});
app.get('/api/clubs/:slug/entries',(q,r)=>r.json(db.prepare('SELECT id,kind,name,role,years,bio FROM entries WHERE club=? AND published=1 AND (?=\'\' OR kind=?) ORDER BY name').all(q.params.slug,S(q.query.kind),S(q.query.kind))));
app.get('/api/recognition/:cat',(q,r)=>{if(!CATS.includes(q.params.cat))throw err(404,'Unknown category');
r.json(db.prepare("SELECT id,nominee,clubs,roles,years,story FROM nominations WHERE category=? AND status='approved' ORDER BY nominee").all(q.params.cat).map(n=>({...n,files:filesOf('nomination_id',n.id)})))});
app.get('/api/news',(q,r)=>r.json(db.prepare('SELECT id,kind,title,body,created_at FROM posts WHERE published=1 ORDER BY created_at DESC,id DESC').all()));
app.post('/api/nominations',lim(8),upload,(q,r)=>{const b=q.body;let files=[];
try{if(b.website)return r.json({ok:true});need(b,'category','nominee','story','nominator_name','nominator_contact');
const cat=S(b.category).toLowerCase();if(!CATS.includes(cat))throw err(400,'Invalid category');if(!yes(b.acknowledged))throw err(400,'Please accept the acknowledgement');
files=keep(q.files);const id=tx(db,()=>{const x=db.prepare('INSERT INTO nominations(category,nominee,clubs,roles,years,story,nominator_name,nominator_contact,sources,family_consulted,acknowledged) VALUES(?,?,?,?,?,?,?,?,?,?,1)')
.run(cat,S(b.nominee,200),S(b.clubs,300),S(b.roles,300),S(b.years,100),S(b.story,5000),S(b.nominator_name,200),S(b.nominator_contact,200),S(b.sources,1000),yes(b.family_consulted)?1:0).lastInsertRowid;addFiles(files,'nomination_id',x);return x});
r.status(201).json({id:+id,status:'pending'})}catch(e){files.forEach(f=>rmSync(join(uploadDir,f.path),{force:true}));(q.files||[]).forEach(f=>rmSync(f.path,{force:true}));throw e}});

// ---------- files (originals are private until the owning item/nomination is approved) ----------
app.get('/api/files/:id',(q,r)=>{const f=db.prepare('SELECT * FROM files WHERE id=?').get(+q.params.id);if(!f)throw err(404,'Not found');
const i=f.item_id&&db.prepare('SELECT status,submitted_by FROM items WHERE id=?').get(f.item_id),n=f.nomination_id&&db.prepare('SELECT status FROM nominations WHERE id=?').get(f.nomination_id);
const ok=i?.status==='approved'||n?.status==='approved'||q.user?.role==='admin'||(i&&q.user&&i.submitted_by===q.user.id);if(!ok)throw err(404,'Not found');
const p=resolve(uploadDir,f.path);if(!existsSync(p))throw err(404,'Not found');r.set({'Content-Type':f.mime,'X-Content-Type-Options':'nosniff','Cache-Control':ok&&(i?.status==='approved'||n?.status==='approved')?'public,max-age=86400':'private,no-store'}).sendFile(p)});

// ---------- contributor ----------
app.post('/api/items',contrib,upload,(q,r)=>{let files=[];try{const b=q.body;need(b,'type','title');if(!TYPES.includes(S(b.type)))throw err(400,'Invalid content type');
if(!yes(b.permission))throw err(400,'The permission declaration is required');
const club=q.user.role==='admin'?S(b.club):q.user.club;if(!db.prepare('SELECT 1 FROM clubs WHERE slug=? AND active=1').get(club))throw err(400,'Unknown club');
files=keep(q.files);if(!files.length&&S(b.type)!=='Social')throw err(400,'Please attach at least one file');
const id=tx(db,()=>{const x=db.prepare('INSERT INTO items(club,type,title,caption,year,people,event,source,contact,permission,submitted_by) VALUES(?,?,?,?,?,?,?,?,?,1,?)')
.run(club,S(b.type),S(b.title,200),S(b.caption,5000),S(b.year,20),S(b.people,300),S(b.event,300),S(b.source,200)||'unknown',S(b.contact,200)||q.user.email,q.user.id).lastInsertRowid;addFiles(files,'item_id',x);return x});
r.status(201).json({id:+id,status:'pending'})}catch(e){files.forEach(f=>rmSync(join(uploadDir,f.path),{force:true}));(q.files||[]).forEach(f=>rmSync(f.path,{force:true}));throw e}});
app.get('/api/my/items',contrib,(q,r)=>r.json(db.prepare(`${SEL} WHERE i.submitted_by=? ORDER BY i.created_at DESC,i.id DESC`).all(q.user.id).map(fullItem)));
const own=q=>{const i=db.prepare('SELECT * FROM items WHERE id=? AND submitted_by=?').get(+q.params.id,q.user.id);if(!i)throw err(404,'Not found');return i};
app.patch('/api/my/items/:id',contrib,(q,r)=>{const i=own(q);if(!['pending','corrections_requested'].includes(i.status))throw err(400,'Approved items can only be changed by the editorial team');
const b=q.body,g=(k,n)=>b[k]===undefined?i[k]:S(b[k],n);
db.prepare("UPDATE items SET title=?,caption=?,year=?,people=?,event=?,source=?,status='pending' WHERE id=?").run(g('title',200),g('caption',5000),g('year',20),g('people',300),g('event',300),g('source',200),i.id);r.json({ok:true})});
app.delete('/api/my/items/:id',contrib,(q,r)=>{const i=own(q);if(i.status!=='pending')throw err(400,'Only pending items can be withdrawn');dropFiles('item_id',i.id);db.prepare('DELETE FROM items WHERE id=?').run(i.id);r.json({ok:true})});

// ---------- editor / administrator ----------
app.get('/api/admin/items',admin,(q,r)=>{const w=['1=1'],p=[];if(STATUS.includes(q.query.status)){w.push('i.status=?');p.push(q.query.status)}if(q.query.club){w.push('i.club=?');p.push(S(q.query.club))}
r.json(db.prepare(`${SEL} WHERE ${w.join(' AND ')} ORDER BY i.created_at DESC LIMIT 500`).all(...p).map(fullItem))});
app.post('/api/admin/items/:id/review',admin,(q,r)=>{const st=S(q.body.status);if(!STATUS.includes(st)||st==='pending')throw err(400,'Invalid status');if(['corrections_requested','declined'].includes(st))need(q.body,'note');
const x=db.prepare("UPDATE items SET status=?,reviewer_note=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?").run(st,S(q.body.note,1000),q.user.id,+q.params.id);if(!x.changes)throw err(404,'Not found');audit(q,'item:'+st,q.params.id);r.json({ok:true})});
app.patch('/api/admin/items/:id',admin,(q,r)=>{const i=db.prepare('SELECT * FROM items WHERE id=?').get(+q.params.id);if(!i)throw err(404,'Not found');const b=q.body,g=(k,n)=>b[k]===undefined?i[k]:S(b[k],n);
if(b.club&&!db.prepare('SELECT 1 FROM clubs WHERE slug=?').get(S(b.club)))throw err(400,'Unknown club');
db.prepare('UPDATE items SET club=?,type=?,title=?,caption=?,year=?,people=?,event=?,source=? WHERE id=?').run(g('club',60),g('type',40),g('title',200),g('caption',5000),g('year',20),g('people',300),g('event',300),g('source',200),i.id);audit(q,'item:edit',i.id);r.json({ok:true})});
app.delete('/api/admin/items/:id',admin,(q,r)=>{dropFiles('item_id',+q.params.id);db.prepare('DELETE FROM items WHERE id=?').run(+q.params.id);audit(q,'item:delete',q.params.id);r.json({ok:true})});
app.get('/api/admin/nominations',admin,(q,r)=>r.json(db.prepare('SELECT * FROM nominations ORDER BY created_at DESC LIMIT 500').all().map(n=>({...n,files:filesOf('nomination_id',n.id)}))));
app.post('/api/admin/nominations/:id/review',admin,(q,r)=>{const st=S(q.body.status);if(!['approved','declined','pending'].includes(st))throw err(400,'Invalid status');
if(!rec(+q.params.id))throw err(404,'Not found');db.prepare('UPDATE nominations SET status=?,reviewer_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(st,S(q.body.note,1000),+q.params.id);audit(q,'nomination:'+st,q.params.id);r.json({ok:true})});
app.get('/api/admin/reports',admin,(q,r)=>r.json(db.prepare('SELECT r.*,i.title FROM reports r JOIN items i ON i.id=r.item_id ORDER BY r.status,r.created_at DESC').all()));
app.post('/api/admin/reports/:id/resolve',admin,(q,r)=>{db.prepare("UPDATE reports SET status='resolved' WHERE id=?").run(+q.params.id);r.json({ok:true})});
app.get('/api/admin/users',admin,(q,r)=>r.json(db.prepare('SELECT id,email,name,role,club,active,created_at FROM users ORDER BY role,club,name').all()));
app.post('/api/admin/users',admin,(q,r)=>{const b=q.body;need(b,'email','name','password');if(S(b.password).length<10)throw err(400,'Password must be at least 10 characters');
const role=b.role==='admin'?'admin':'contributor',club=role==='admin'?null:S(b.club);if(role==='contributor'&&!db.prepare('SELECT 1 FROM clubs WHERE slug=?').get(club))throw err(400,'A valid club is required for contributors');
try{const id=db.prepare('INSERT INTO users(email,name,password_hash,role,club) VALUES(?,?,?,?,?)').run(S(b.email,200),S(b.name,200),bcrypt.hashSync(String(b.password),10),role,club).lastInsertRowid;audit(q,'user:create',id);r.status(201).json({id:+id})}
catch(e){throw /UNIQUE/.test(e.message)?err(409,'That email is already registered'):e}});
app.patch('/api/admin/users/:id',admin,(q,r)=>{const b=q.body,id=+q.params.id;if(b.active!==undefined){if(id===q.user.id)throw err(400,'You cannot deactivate yourself');db.prepare('UPDATE users SET active=? WHERE id=?').run(yes(b.active)?1:0,id)}
if(b.password){if(S(b.password).length<10)throw err(400,'Password must be at least 10 characters');db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(b.password),10),id)}audit(q,'user:update',id);r.json({ok:true})});
app.get('/api/admin/entries',admin,(q,r)=>r.json(db.prepare('SELECT * FROM entries ORDER BY club,kind,name').all()));
app.post('/api/admin/entries',admin,(q,r)=>{const b=q.body;need(b,'club','kind','name');if(!['player','team'].includes(b.kind))throw err(400,'Invalid kind');if(!db.prepare('SELECT 1 FROM clubs WHERE slug=?').get(S(b.club)))throw err(400,'Unknown club');
r.status(201).json({id:+db.prepare('INSERT INTO entries(club,kind,name,role,years,bio) VALUES(?,?,?,?,?,?)').run(S(b.club),b.kind,S(b.name,200),S(b.role,100),S(b.years,100),S(b.bio,3000)).lastInsertRowid})});
app.delete('/api/admin/entries/:id',admin,(q,r)=>{db.prepare('DELETE FROM entries WHERE id=?').run(+q.params.id);r.json({ok:true})});
app.post('/api/admin/posts',admin,(q,r)=>{need(q.body,'kind','title');if(!['reunion','news'].includes(q.body.kind))throw err(400,'Invalid kind');r.status(201).json({id:+db.prepare('INSERT INTO posts(kind,title,body) VALUES(?,?,?)').run(q.body.kind,S(q.body.title,200),S(q.body.body,5000)).lastInsertRowid})});
app.delete('/api/admin/posts/:id',admin,(q,r)=>{db.prepare('DELETE FROM posts WHERE id=?').run(+q.params.id);r.json({ok:true})});
// Full export of every table (no password hashes). Files are in UPLOAD_DIR; scripts/backup.js copies both.
app.get('/api/admin/export',admin,(q,r)=>{const t=n=>db.prepare(`SELECT * FROM ${n}`).all();audit(q,'export','all');
r.set('Content-Disposition','attachment; filename="gbl80s-export.json"').json({exportedAt:new Date().toISOString(),clubs:t('clubs'),users:db.prepare('SELECT id,email,name,role,club,active FROM users').all(),items:t('items'),nominations:t('nominations'),files:t('files'),reports:t('reports'),entries:t('entries'),posts:t('posts')})});

app.get('/api/health',(q,r)=>{db.prepare('SELECT 1').get();r.json({ok:true})});
app.use('/api',(q,r)=>r.status(404).json({error:'Not found'}));
if(frontendDir&&existsSync(frontendDir))app.use(express.static(frontendDir));
app.use((e,q,r,n)=>{const s=e.status||(e instanceof multer.MulterError?400:500);if(s===500)console.error(e);r.status(s).json({error:s===500?'Something went wrong':e.message})});
return app}
