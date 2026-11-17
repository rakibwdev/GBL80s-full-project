import {useEffect,useRef} from 'react';import {Routes,Route,NavLink,Link,useLocation} from 'react-router-dom';import {AppProvider,useApp} from './store.jsx';
import {LIVE} from './api.js';import {AuthProvider,Admin} from './live.jsx';import {Home,Story,Clubs,Archive,Recognition,Gallery,AllStar,News,Contribute,ClubPage} from './pages.jsx';
function Viewer({view,close}){const r=useRef();useEffect(()=>{const d=r.current;if(view&&d&&!d.open)d.showModal()},[view]);
return view?<dialog ref={r} aria-label="Archive image" onClose={close} onClick={e=>e.target===r.current&&close()}><form method="dialog"><button aria-label="Close image">Close ×</button></form><img src={view.img} alt={view.alt||view.title}/><p>{view.title}</p></dialog>:null}
function Shell(){const {pathname}=useLocation(),{view,open}=useApp();
useEffect(()=>{window.scrollTo(0,0);document.getElementById('main')?.focus({preventScroll:true})},[pathname]);
return <>
<a className="skip" href="#main" onClick={e=>{e.preventDefault();document.getElementById('main').focus()}}>Skip to content</a>
{!LIVE&&<div className="demo">Client preview. Players, teams, social posts and news are sample placeholders until real content is supplied.</div>}
<header><div className="wrap bar"><Link className="brand" to="/"><span>GBL<span className="accent">80s</span></span><small>THE GBL 80s STORY</small></Link>
<nav aria-label="Main navigation">{[['story','Our story'],['clubs','Clubs'],['archive','Archive'],['recognition','Recognition'],['news','Reunions & news'],['contribute','Contribute']].map(([p,t])=><NavLink key={p} to={'/'+p}>{t}</NavLink>)}</nav></div></header>
<main id="main" tabIndex={-1}><Routes><Route path="/" element={<Home/>}/><Route path="/story" element={<Story/>}/><Route path="/clubs" element={<Clubs/>}/><Route path="/club/:slug/:sub?" element={<ClubPage/>}/><Route path="/archive" element={<Archive/>}/><Route path="/recognition" element={<Recognition/>}/>{['remarkables','legends','tributes'].map(k=><Route key={k} path={'/'+k} element={<Gallery k={k}/>}/>)}<Route path="/allstar" element={<AllStar/>}/><Route path="/news" element={<News/>}/><Route path="/contribute" element={<Contribute/>}/>{LIVE&&<Route path="/admin" element={<Admin/>}/>}<Route path="*" element={<Home/>}/></Routes></main>
<footer><div className="wrap bar"><span>The GBL 80s Story · Preserving Gippsland basketball history</span><span><Link to="/contribute">Corrections &amp; removal requests</Link> · <a href="#top">Back to top ↑</a></span></div></footer>
<Viewer view={view} close={()=>open(null)}/></>}
export default function App(){const x=<AppProvider><Shell/></AppProvider>;return LIVE?<AuthProvider>{x}</AuthProvider>:x}
