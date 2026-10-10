import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './src/i18n';
import { LockPick, type LockView } from './src/screens/labyrinth/LockPick';
import { EventPanel } from './src/screens/labyrinth/EventPanel';
import { SheetProvider } from './src/components/Sheet';
const host = document.createElement('div'); document.body.replaceChildren(host);
const root = createRoot(host); const taps: number[] = [];
export const lock: LockView = { pins: [{ period:1400, phase:0, center:.5, width:.12 }, { period:1200, phase:.2, center:.6, width:.12 }, { period:1000, phase:0, center:.5, width:.12 }], picks:2, set:0, broken:0 };
export function mount(value=lock,busy=false){root.render(<StrictMode><I18nProvider><LockPick lock={value} busy={busy} onTap={ms=>taps.push(ms)}/></I18nProvider></StrictMode>)}
export function results(){return taps}
export function unmount(){root.unmount()}
function EventHarness(){const [busy,setBusy]=useState(false),[done,setDone]=useState(false);return done?<p data-report>Chest report</p>:<EventPanel event={{kind:'lockpicking',done:false,lock:{...lock,set:2}}} view={{} as never} busy={busy} act={async fn=>{setBusy(true);await fn();setDone(true);setBusy(false)}}/>}
export function event(){root.render(<I18nProvider><SheetProvider><EventHarness/></SheetProvider></I18nProvider>)}
