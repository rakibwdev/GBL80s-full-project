// Consistent online backup: database snapshot + copy of all uploaded files. Schedule with cron.
import {resolve,join} from 'node:path';import {mkdirSync,cpSync,existsSync} from 'node:fs';import {openDb} from '../src/db.js';
const e=process.env,root=new URL('..',import.meta.url).pathname,R=p=>resolve(root,p);
const db=openDb(R(e.DB_FILE||'./data/gbl80s.db')),stamp=new Date().toISOString().slice(0,10),dir=join(R(e.BACKUP_DIR||'./data/backups'),stamp);
mkdirSync(dir,{recursive:true});db.exec(`VACUUM INTO '${join(dir,'gbl80s.db').replace(/'/g,"''")}'`);
const up=R(e.UPLOAD_DIR||'./data/uploads');if(existsSync(up))cpSync(up,join(dir,'uploads'),{recursive:true});console.log('Backup written to',dir);
