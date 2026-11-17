import {Link} from 'react-router-dom';import {EAST,WEST,LAKERS,IMG,slug} from './data.js';import {useApp} from './store.jsx';
export const Sec=({cls,k,children})=><section className={cls}><div className="wrap section">{k&&<p className="kicker"><i></i> {k}</p>}{children}</div></section>;
export const Crumb=({a})=><p className="crumb">{a.map((x,i)=>i<a.length-1?<span key={i}><Link to={x[1]}>{x[0]}</Link> / </span>:x[0])}</p>;
export const Field=({l,cls='',children})=><label className={'f '+cls}>{l}{children}</label>;
export const Opts=({list,all})=><>{all&&<option value="">{all}</option>}{list.map(x=><option key={x}>{x}</option>)}</>;
export const LakersBadge=()=><Link className="badge" to={'/club/'+slug(LAKERS.n)}><img src={IMG.lakers} alt="Gippsland Nubrik Lakers logo"/><span><b>{LAKERS.full}</b><small>{LAKERS.sub}</small></span></Link>;
export const Dirs=()=><div className="dirs">{[['East',EAST],['West',WEST]].map(([d,l])=><div key={d}><h3>{d} division · {l.length}</h3><ul>{l.map(n=><li key={n}><Link to={'/club/'+slug(n)}>{n}</Link></li>)}</ul></div>)}</div>;
export function Card({i,ph}){const {open}=useApp(),cl=[].concat(i.club).join(', ');
return <article>{i.img?<button onClick={()=>open(i)} aria-label={'View '+i.title}><img src={i.img} alt={i.alt||i.title} loading="lazy"/><span>View ↗</span></button>:<div className="ph" aria-hidden="true">{ph||'🏀'}</div>}<p className="meta">{i.type.toUpperCase()}</p><h3>{i.title}</h3><p>{i.text}</p><p className="cr">{cl} · {i.year||'Date unknown'}</p></article>}
