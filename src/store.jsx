import {createContext,useContext,useState} from 'react';
function useLS(k){const [v,setV]=useState(()=>{try{return JSON.parse(localStorage[k]||'[]')}catch{return[]}});
return [v,n=>{setV(n);try{localStorage[k]=JSON.stringify(n)}catch{alert('Browser storage is full. Try a smaller image.')}}]}
const Ctx=createContext();export const useApp=()=>useContext(Ctx);
// Demo persistence in localStorage. In the live build these become API calls (see PRD).
export function AppProvider({children}){const [subs,setSubs]=useLS('gbl80u'),[noms,setNoms]=useLS('gbl80n'),[view,open]=useState(null);
const [user,setUser]=useState(()=>sessionStorage.gblin||'');
const login=c=>{sessionStorage.gblin=c;setUser(c)},logout=()=>{sessionStorage.removeItem('gblin');setUser('')};
return <Ctx.Provider value={{subs,setSubs,noms,setNoms,view,open,user,login,logout}}>{children}</Ctx.Provider>}
