import {useEffect,useState} from 'react';
// LIVE=true when built with VITE_LIVE=1 (talks to the /api back end). Otherwise the site runs as the offline demo.
export const LIVE=import.meta.env.VITE_LIVE==='1';
export async function api(path,{method='GET',json,form}={}){const h={'X-Requested-With':'gbl'};if(json)h['Content-Type']='application/json';
const r=await fetch('/api'+path,{method,headers:h,credentials:'include',body:json?JSON.stringify(json):form}),d=r.headers.get('content-type')?.includes('json')?await r.json():null;
if(!r.ok)throw new Error(d?.error||'Request failed');return d}
export const toCard=i=>({id:'i'+i.id,img:i.files?.find(f=>f.mime.startsWith('image/'))?.url||'',type:i.type,title:i.title,text:i.caption||[i.people,i.event].filter(Boolean).join(' · '),club:i.clubName,year:i.year,alt:i.title});
export function useApi(path,deps=[]){const [d,setD]=useState(null);useEffect(()=>{let ok=true;setD(null);if(path)api(path).then(x=>ok&&setD(x)).catch(()=>ok&&setD([]));return()=>{ok=false}},[path,...deps]);return d}
