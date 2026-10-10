const {chromium}=require('C:/Users/aibar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const out='C:/Users/aibar/AppData/Local/Temp/dark-class-power-evidence';
const scenes=[['smite','paladin',2,330],['lay-on-hands','paladin',4,540],['agathys','warlock',2,350],['hex','warlock',3,400],['eldritch','warlock',4,300],['dark-blessing','warlock',6,450],['hex-moves','warlock',7,220],['entropic-ward','warlock',10,330],['flurry','monk',2,340],['wholeness','monk',5,430],['cloak-of-shadows','monk',6,350],['wild-shape','druid',2,400],['beast-claw','druid',3,340],['beast-hurt','druid',4,400],['beast-ends','druid',7,400],['thorn','druid',9,280],['inspiration','bard',2,350],['mockery','bard',3,300],['cutting-words','bard',4,350],['quickened','sorcerer',2,350],['fire','sorcerer',3,300],['action-surge','fighter',3,350]];
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('dark.guideSeen','1');localStorage.setItem('dc.sound','off');});
await page.route('**/auth/status',r=>r.fulfill({json:{devLogin:true}}));
await page.route('**/api/me',r=>r.fulfill({json:{player:{id:'preview',name:'Preview',status:'approved',isAdmin:false,locale:'ru',avatarUrl:null}}}));
await page.route('**/api/notifications*',r=>r.fulfill({json:{notifications:[],unread:0}}));
await page.goto('http://127.0.0.1:5184/sandbox?lang=ru');
await page.getByRole('button',{name:'power-paladin',exact:true}).waitFor();
await page.clock.install({time:new Date('2026-10-10T06:00:00Z')});await page.clock.pauseAt(new Date('2026-10-10T06:00:01Z'));
for(const [name,calling,step,ms]of scenes){await page.getByRole('button',{name:'power-'+calling,exact:true}).click();await page.locator('[data-fight-ready="true"]').waitFor();
for(let n=0;Number(await page.locator('[data-fight-step]').getAttribute('data-fight-step'))<step;n++){if(n>15)throw Error(name+' never reached');await page.clock.fastForward(3000);}
await page.clock.runFor(ms);await page.screenshot({path:out+'/'+name+'.png'});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow '+name);
if(await page.locator('.fight-fallback').count())throw Error('Renderer fallback '+name);
await page.locator('[data-fight-skip]').click();console.log(name);}
for(const calling of ['paladin','warlock','monk','druid','bard','sorcerer','fighter']){
await page.getByRole('button',{name:'power-'+calling+'-partner',exact:true}).click();await page.locator('[data-fight-ready="true"]').waitFor();
for(let i=0;i<20;i++){if(await page.locator('[data-fight-complete="true"]').count())break;await page.clock.fastForward(3000);}
if(!(await page.locator('[data-fight-complete="true"]').count()))throw Error('Partner did not finish '+calling);
await page.locator('[data-fight-skip]').click();}
await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'power-druid-partner',exact:true}).click();await page.locator('[data-fight-ready="true"]').waitFor();
await page.clock.fastForward(3000);await page.clock.fastForward(3000);await page.clock.runFor(160);await page.screenshot({path:out+'/reduced-druid-partner.png'});
await page.locator('[data-fight-skip]').click();
if(errors.length)throw Error(JSON.stringify(errors));fs.writeFileSync(out+'/validation.json',JSON.stringify({viewport:[375,812],locale:'ru',screenshots:scenes.map(s=>s[0]),partnerReplays:7,reducedMotion:true,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
