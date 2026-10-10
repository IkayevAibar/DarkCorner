import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './src/i18n';
import { Cups } from './src/screens/labyrinth/Cups';
import { deal } from './src/screens/sandbox/CupsPreview';
const host=document.createElement('div');document.body.replaceChildren(host);const root=createRoot(host);
const picks:(number|'cheat')[]=[];export const game=deal(1,false,false,20);
export function mount(value=game,key=0){root.render(<StrictMode><I18nProvider><Cups key={key} cups={{maxBet:60,game:value}} busy={false} onBet={()=>{}} onPick={p=>picks.push(p)}/></I18nProvider></StrictMode>)}
export const results=()=>picks;export const unmount=()=>root.unmount();
