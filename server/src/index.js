import 'node:process';import {resolve} from 'node:path';import {openDb} from './db.js';import {createApp} from './app.js';
const e=process.env,root=new URL('..',import.meta.url).pathname;const R=p=>resolve(root,p);
const db=openDb(R(e.DB_FILE||'./data/gbl80s.db'));
const app=createApp({db,secret:e.JWT_SECRET,uploadDir:R(e.UPLOAD_DIR||'./data/uploads'),frontendDir:e.FRONTEND_DIR&&R(e.FRONTEND_DIR),corsOrigin:e.CORS_ORIGIN||'',maxFileMb:+e.MAX_FILE_MB||15,prod:e.NODE_ENV==='production'});
app.listen(+e.PORT||3000,()=>console.log('GBL 80s API listening on :'+(e.PORT||3000)));
