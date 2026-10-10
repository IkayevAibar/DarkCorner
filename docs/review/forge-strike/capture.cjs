const {chromium}=require('C:/Users/aibar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');const out='C:/Users/aibar/AppData/Local/Temp/dark-forge-evidence';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:375,height:812}}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('dark.guideSeen','1');localStorage.setItem('dc.sound','off');});
await page.route('**/auth/status',r=>r.fulfill({json:{devLogin:true}}));await page.route('**/api/me',r=>r.fulfill({json:{player:{id:'preview',name:'Preview',status:'approved',isAdmin:false,locale:'ru',avatarUrl:null}}}));await page.route('**/api/notifications*',r=>r.fulfill({json:{notifications:[],unread:0}}));
await page.goto('http://127.0.0.1:5184/sandbox?lang=ru');const scene=page.locator('[data-forge-preview]');await scene.waitFor();
for(const locale of ['ru','en']){if(locale==='en')await page.getByRole('button',{name:'EN',exact:true}).click();
for(const outcome of ['success','failed','dropped','saved','destroyed','ten']){
await scene.locator('[data-upgrade="'+outcome+'"]').click();await scene.locator('.forge-stage').scrollIntoViewIfNeeded();await page.waitForTimeout(outcome==='saved'?1080:1000);await page.screenshot({path:out+'/'+outcome+'-'+locale+'.png'});
await scene.locator('[data-finished=true]').waitFor();if(!(await scene.locator('.forge-d100').innerText()).match(/\d/))throw Error('Missing recorded roll');
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');}}
await page.emulateMedia({reducedMotion:'reduce'});await scene.locator('[data-upgrade=saved]').click();await scene.locator('[data-finished=true]').waitFor({timeout:500});await page.screenshot({path:out+'/reduced-en.png'});
await page.emulateMedia({reducedMotion:'no-preference'});
const fixtures=await page.evaluate(async()=>{const f=await import('/src/screens/sandbox/ForgePreview.tsx');const s=await import('/@fs/C:/Users/aibar/.codex/worktrees/visual-backlog/browser-game/packages/shared/src/index.ts');for(const value of Object.values(f.UPGRADES))s.upgradeResultSchema.parse(value);return {item:f.FORGE_ITEM,results:f.UPGRADES}});
let current=fixtures.item,posts=0,kind='success';const hero=()=>({...fixtures.results.success.hero,bag:current?[current]:[],gold:100000});
await page.route('**/api/forge',r=>r.fulfill({json:{hero:hero(),recipes:[]}}));
await page.route('**/api/heroes/me',r=>r.fulfill({json:{hero:hero()}}));
await page.route('**/api/items/forge-sword/forge',r=>r.fulfill({json:{item:current,upgrade:{to:current.upgrade+1,chance:40,cost:{gold:10,materials:[]},risky:true,protectionScrolls:1,preview:{...current,upgrade:current.upgrade+1}},reforge:null,salvage:null,blocked:null}}));
await page.route('**/api/items/forge-sword/upgrade',r=>{posts++;if(r.request().postDataJSON().protect!==true)throw Error('Protection option lost');const result=fixtures.results[kind];current=result.item;return r.fulfill({json:result});});
await page.goto('http://127.0.0.1:5184/city/forge?lang=en');await page.getByRole('button',{name:'Sword of the Watch',exact:true}).click();
await page.getByRole('button',{name:'Strike for +8',exact:true}).click();await page.locator('[role=dialog] [data-landed=true]').waitFor();await page.screenshot({path:out+'/forge-sheet-success.png'});await page.locator('[role=dialog] [data-finished=true]').waitFor();
await page.getByRole('button',{name:'Strike for +9',exact:true}).waitFor();kind='destroyed';await page.getByRole('button',{name:'Strike for +9',exact:true}).click();await page.locator('[role=dialog] [data-outcome=destroyed][data-finished=true]').waitFor();
if(await page.getByRole('button',{name:/Strike for/}).count())throw Error('Destroyed Item still actionable');if(posts!==2)throw Error('Extra Upgrade requests');await page.screenshot({path:out+'/forge-sheet-destroyed.png'});
if(errors.length)throw Error(JSON.stringify(errors));const video=page.video();await context.close();await video.saveAs(out+'/forge-strikes.webm');fs.writeFileSync(out+'/validation.json',JSON.stringify({viewport:[375,812],locales:['ru','en'],outcomes:6,reducedMotion:true,apiIntegration:{upgrades:posts,protection:true,destroyedActionsRemoved:true},errors},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

