const {chromium}=require('C:/Users/aibar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),out='C:/Users/aibar/AppData/Local/Temp/dark-sound-evidence';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{const ctx=await browser.newContext({viewport:{width:375,height:812}}),page=await ctx.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/sfx/'))requests.push(r.url())});
await page.addInitScript(()=>{
  localStorage.setItem('dark.guideSeen','1');
  window.audioReview={started:[],stopped:0,ended:0,decoded:[],vibrations:[],contexts:0};
  const labels=new WeakMap(),rawFetch=window.fetch;window.fetch=async(...args)=>{const response=await rawFetch(...args),arrayBuffer=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{const data=await arrayBuffer();labels.set(data,String(args[0]));return data};return response};
  Object.defineProperty(navigator,'vibrate',{value:pattern=>{window.audioReview.vibrations.push(pattern);return true}});
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
    constructor(...args){super(...args);window.audioReview.contexts++;window.reviewContext=this;
      this.capture=this.createMediaStreamDestination();const chunks=[];
      this.recorder=new MediaRecorder(this.capture.stream,{mimeType:'audio/webm'});
      this.recorder.ondataavailable=e=>chunks.push(e.data);
      this.recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());window.reviewRecording=Array.from(bytes)};
      this.recorder.start();
    }
    createGain(){const node=super.createGain(),connect=node.connect.bind(node);node.connect=(dest,...args)=>{if(dest===this.destination)connect(this.capture);return connect(dest,...args)};return node}
    createBufferSource(){const node=super.createBufferSource(),start=node.start.bind(node),stop=node.stop.bind(node);
      node.start=(...args)=>{window.audioReview.started.push({file:labels.get(node.buffer),when:args[0],time:this.currentTime,duration:node.buffer?.duration});node.addEventListener('ended',()=>window.audioReview.ended++);return start(...args)};
      node.stop=(...args)=>{window.audioReview.stopped++;return stop(...args)};return node}
    async decodeAudioData(...args){const buffer=await super.decodeAudioData(...args);labels.set(buffer,labels.get(args[0]));window.audioReview.decoded.push({duration:buffer.duration,channels:buffer.numberOfChannels});return buffer}
  };
});
await page.route('**/auth/status',r=>r.fulfill({json:{devLogin:true}}));
await page.route('**/api/me',r=>r.fulfill({json:{player:{id:'preview',name:'Preview',status:'approved',isAdmin:false,locale:'ru',avatarUrl:null}}}));
await page.route('**/api/notifications*',r=>r.fulfill({json:{notifications:[],unread:0}}));
await page.route('**/api/heroes/me',r=>r.fulfill({json:{hero:null}}));
// Keep the real Shell, account sheet and SoundPreview; other sandbox scenes can make their own sounds.
await page.route('**/src/screens/Sandbox.tsx*',r=>r.fulfill({contentType:'application/javascript',body:'export { SoundPreview as Sandbox } from "/src/screens/sandbox/SoundPreview.tsx";'}));
await page.goto('http://127.0.0.1:5184/sandbox?lang=ru');const board=page.locator('[data-sound-preview]');await board.waitFor();await page.waitForTimeout(500);
if(requests.length||await page.evaluate(()=>window.audioReview.contexts))throw Error('Audio woke before a tap');
await board.locator('[data-sound=latch]').click();await page.waitForFunction(()=>window.audioReview.started.length>0);
await page.waitForTimeout(250);
const names=await board.locator('[data-sound]').evaluateAll(nodes=>nodes.map(n=>n.dataset.sound));
for(const name of names){const before=await page.evaluate(()=>window.audioReview.started.length);await board.locator(`[data-sound="${name}"]`).click();await page.waitForFunction(n=>window.audioReview.started.length>n,before);await page.waitForTimeout(100)}
const counts=[];for(const tier of ['common','uncommon','rare','epic','legendary','mythic','relic']){const before=await page.evaluate(()=>window.audioReview.started.length);await board.locator(`[data-sound-tier="${tier}"]`).click();await page.waitForTimeout(650);counts.push((await page.evaluate(()=>window.audioReview.started.length))-before)}
if(JSON.stringify(counts)!=='[1,1,1,2,3,4,4]'){fs.writeFileSync(out+'/debug.json',JSON.stringify(await page.evaluate(()=>window.audioReview),null,2));throw Error('Tier layers '+counts)}
await board.locator('[data-sound-natural]').click();await page.waitForTimeout(300);
// Decode every approved variant through the real browser codec, including variants randomness did not select.
const files=await page.evaluate(async()=>{const {FILES}=await import('/src/audio/catalog.ts');const unique=[...new Set(Object.values(FILES).flat())];for(const file of unique){const response=await fetch('/sfx/'+file+'.ogg');if(!response.ok)throw Error(file);const decoded=await window.reviewContext.decodeAudioData(await response.arrayBuffer());if(!decoded.duration)throw Error('Empty '+file)}return unique.length});
// Account sheet and sandbox share the same persistent switch.
await page.getByRole('button',{name:'Аккаунт',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.locator('button[aria-pressed]').filter({hasText:'Выкл.'}).click();
await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();
if(await board.locator('[data-sound-setting=false]').getAttribute('aria-pressed')!=='true')throw Error('Account switch not shared');
const beforeMute=await page.evaluate(()=>({starts:window.audioReview.started.length,vibes:window.audioReview.vibrations.length}));
await board.locator('[data-sound-tier=mythic]').click();await board.locator('[data-sound-natural]').click();await page.waitForTimeout(500);
const afterMute=await page.evaluate(()=>({starts:window.audioReview.started.length,vibes:window.audioReview.vibrations.length}));
if(JSON.stringify(beforeMute)!==JSON.stringify(afterMute))throw Error('Muted sound/vibration leaked');
await board.locator('[data-sound-setting=true]').click();await page.evaluate(async()=>{document.querySelector('[data-sound-tier=mythic]').click();await new Promise(resolve=>setTimeout(resolve,30));document.querySelector('[data-sound-setting=false]').click()});await page.waitForTimeout(600);
if(!(await page.evaluate(()=>window.audioReview.stopped>=3)))throw Error('Delayed layers not stopped');
for(const locale of ['ru','en']){if(locale==='en')await page.getByRole('button',{name:'EN',exact:true}).click();await board.evaluate(el=>el.scrollIntoView({block:'start'}));await page.evaluate(()=>window.scrollBy(0,-65));await page.screenshot({path:out+'/board-'+locale+'.png'});await board.screenshot({path:out+'/board-full-'+locale+'.png',style:'header.sticky,nav.fixed{visibility:hidden!important}'});if(await board.evaluate(el=>el.scrollWidth>el.clientWidth+3))throw Error('Board content overflow');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Page overflow')}
await page.setViewportSize({width:1280,height:900});await board.evaluate(el=>el.scrollIntoView({block:'start'}));await page.evaluate(()=>window.scrollBy(0,-65));await page.screenshot({path:out+'/board-desktop.png'});
const report=await page.evaluate(()=>window.audioReview);await page.evaluate(()=>window.reviewContext.recorder.stop());await page.waitForFunction(()=>window.reviewRecording);fs.writeFileSync(out+'/sound-board.webm',Buffer.from(await page.evaluate(()=>window.reviewRecording)));
const requestCount=requests.length;await page.reload();await page.locator('[data-sound-preview]').waitFor();await page.waitForTimeout(300);if(requests.length!==requestCount)throw Error('Remembered mute requested audio');
if(await page.locator('[data-sound-setting=false]').getAttribute('aria-pressed')!=='true')throw Error('Mute forgotten');
if(errors.length)throw Error(errors.join('\n'));
fs.writeFileSync(out+'/validation.json',JSON.stringify({phone:[375,812],desktop:[1280,900],languages:['ru','en'],sounds:names.length,decodedFiles:files,tierLayers:counts,firstTap:true,accountSwitch:true,mutedSilent:true,mutePersists:true,report,errors},null,2));console.log('Sound board, every Sound/Tier, 27 approved decodes, account mute, persistence, EN/RU 375px passed');
await ctx.close();}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
