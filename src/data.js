import heyfield from './assets/heyfield.webp';import women from './assets/women.webp';import scoreboard from './assets/scoreboard.webp';
import tipoff from './assets/tipoff.webp';import remarkables from './assets/remarkables.webp';import lakers from './assets/lakers.webp';
export const IMG={tipoff,remarkables,lakers};
export const EAST=['Bairnsdale','Stratford','Sale','Maffra','Heyfield','Traralgon','Morwell','Moe'];
export const WEST=['Pakenham','Sherbrooke','Warragul','Poowong','Korumburra','Leongatha','Wonthaggi'];
export const LAKERS={n:'Gippsland Lakers',full:'Gippsland Nubrik Lakers',sub:'East & West Representative Team',d:'Representative'};
export const CLUBS=[...EAST.map(n=>({n,d:'East'})),...WEST.map(n=>({n,d:'West'})),LAKERS];
export const slug=n=>n.toLowerCase().replace(/\s+/g,'-');
export const byslug=s=>CLUBS.find(c=>slug(c.n)===s);
export const TYPES=['Team photograph','Newspaper clipping','Programme','Scorecard','Grand final','Social','Memorabilia'];
export const SEED=[
{id:'a1',img:heyfield,type:'Team photograph',title:'Heyfield team portrait',club:['Heyfield'],year:1983,text:'Players and staff pictured with a Gippsland Basketball League award.',alt:'Heyfield basketball team posing with a trophy'},
{id:'a2',img:women,type:'Newspaper clipping',title:'Sale v Maffra',club:['Sale','Maffra'],year:'',text:'Leanne Pleydell shoots as Sale captain Jenny Harrington defends at the country championships.',alt:'Leanne Pleydell shoots as Jenny Harrington defends'},
{id:'a3',img:scoreboard,type:'Newspaper clipping',title:'Scoreboard errs: Sale wins',club:['Sale','Traralgon'],year:'',text:'The scoresheet settled a two-point result between Sale and Traralgon.',alt:'Newspaper headline reading Scoreboard errs: Sale wins'}];
export const REC={
remarkables:['Remarkables','🏅','People whose contributions made the league memorable in any capacity: player, coach, referee, president, organiser or volunteer.'],
legends:['Legends','⭐','Individuals recognised for an exceptional or sustained contribution or achievement in Gippsland basketball.'],
tributes:['Tributes','🕯️','Respectful remembrance of people who have passed away and contributed to the league community.']};
export const GAL=[{id:'g1',img:remarkables,type:'Remarkables',title:'The Remarkables artwork',club:['League-wide'],year:'',text:'Artwork celebrating the people of the GBL era.',alt:'The Remarkables artwork celebrating the GBL era'}];
