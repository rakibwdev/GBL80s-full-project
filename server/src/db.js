import {DatabaseSync} from 'node:sqlite';import {readFileSync,mkdirSync} from 'node:fs';import {dirname} from 'node:path';
export const CLUBS=[...['Bairnsdale','Stratford','Sale','Maffra','Heyfield','Traralgon','Morwell','Moe'].map(n=>[n,'East']),...['Pakenham','Sherbrooke','Warragul','Poowong','Korumburra','Leongatha','Wonthaggi'].map(n=>[n,'West']),['Gippsland Lakers','Representative']];
export const slug=n=>n.toLowerCase().replace(/\s+/g,'-');
export function openDb(file){if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;');
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const n=db.prepare('SELECT COUNT(*) c FROM clubs').get().c;if(!n){const ins=db.prepare('INSERT INTO clubs(slug,name,division,sort) VALUES(?,?,?,?)');CLUBS.forEach(([name,d],i)=>ins.run(slug(name),name,d,i))}
return db}
export const tx=(db,fn)=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
