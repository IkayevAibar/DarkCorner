import { Container, Graphics } from 'pixi.js';
import type { Combatant, FightEventView } from '@dark/shared';
import type { Frame } from './replay';
import type { Cue } from './choreography';
import type { Spray } from './particles';

interface Token {
  root: Container; art: Container; radius: number; x: number; y: number; who: Combatant;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const GOLD = 0xffdc86, VIOLET = 0xc59aed, ICE = 0xb9e8ed, LEAF = 0xb5cb83, PALE = 0xeee6cc;

/** Selects a visual, never a combat result. Kept independent of the renderer for fixture coverage. */
export function powerVisual(event: FightEventView | null, heroClass: Combatant['class'], beast = false): string | null {
  if (!event) return null;
  if (event.type === 'feature') {
    if (event.feature === 'ward') return heroClass === 'warlock' ? 'agathys' : null;
    return ['smite', 'hex', 'flurry', 'wild-shape', 'inspiration', 'cutting-words', 'quickened', 'action-surge'].includes(event.feature) ? event.feature : null;
  }
  if (event.type === 'heal') return ['lay-on-hands', 'wholeness', 'dark-blessing'].includes(event.ability) ? event.ability : null;
  if (event.type === 'blocked') return ['entropic-ward', 'cloak-of-shadows'].includes(event.by) ? event.by : null;
  if (event.type === 'attack') {
    if (event.kind === 'weapon' && beast) return 'beast-claw';
    if (event.kind === 'spell') return ({ warlock: 'eldritch', druid: 'thorn', bard: 'mockery', sorcerer: 'fire' } as Partial<Record<NonNullable<Combatant['class']>, string>>)[heroClass!] ?? null;
  }
  return null;
}

/** One reusable ink layer: bounded geometry, no timers, driven by the same pause/speed clock as blows. */
export class PowerEffects {
  private ink = new Graphics();
  private frame: Frame | null = null;
  private before: Frame | null = null;
  private event: FightEventView | null = null;
  private cue: Cue | null = null;
  private calm = false;
  private emitted = false;
  private fallen: string | null = null;
  constructor(world: Container, private tokens: Map<string, Token>, private spray: (x: number, y: number, options: Spray) => void) { world.addChild(this.ink); }
  show(frame: Frame, before: Frame, event: FightEventView | null, cue: Cue, calm: boolean) {
    this.frame = frame; this.before = before; this.event = event; this.cue = cue; this.calm = calm; this.emitted = false;
    if (event?.type === 'defeated') this.fallen = event.key;
  }
  private line(points: number[], color: number, width = 3, alpha = 1) {
    this.ink.poly(points, false).stroke({ color: 0x130e19, width: width + 4, alpha: alpha * .75 })
      .poly(points, false).stroke({ color, width, alpha });
  }
  private star(x: number, y: number, radius: number, color: number, alpha: number, count = 8) {
    for (let i = 0; i < count; i++) { const a = i * Math.PI * 2 / count;
      this.line([x + Math.cos(a) * radius * .4, y + Math.sin(a) * radius * .4, x + Math.cos(a) * radius, y + Math.sin(a) * radius], color, 3, alpha);
    }
  }
  private hex(x: number, y: number, r: number, angle: number, alpha = 1) {
    const points = Array.from({ length: 6 }, (_, i) => [x + Math.cos(angle + i * Math.PI / 3) * r, y + Math.sin(angle + i * Math.PI / 3) * r]).flat();
    this.ink.poly(points).fill({ color: 0x23112e, alpha: .08 }).stroke({ color: 0x190d23, width: 7, alpha })
      .poly(points).stroke({ color: VIOLET, width: 2, alpha });
    for (let i = 0; i < 6; i++) { const a = angle + i * Math.PI / 3;
      this.ink.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, 3).fill({ color: VIOLET, alpha });
    }
  }
  draw(time: number, world: number) {
    const frame = this.frame, event = this.event, cue = this.cue;
    this.ink.clear();
    if (!frame || !cue || event?.type === 'end') return;
    for (const key of ['hero', 'ally']) {
      const state = frame.fighters[key], token = this.tokens.get(key);
      if (!state || !token || state.fallen || state.fled) continue;
      const x = token.root.x, y = token.root.y, r = token.radius + 12;
      if (state.hexed) {
        const target = this.tokens.get(state.hexed), moving = event?.type === 'feature' && event.feature === 'hex' && cue.actor === key;
        const oldKey = this.before?.fighters[key]?.hexed, old = oldKey ? this.tokens.get(oldKey) : undefined;
        if (target) {
          const p = this.calm || !moving ? 1 : clamp(time / Math.max(1, cue.contact));
          const hx = old && moving ? old.root.x + (target.root.x - old.root.x) * p : target.root.x;
          const hy = old && moving ? old.root.y + (target.root.y - old.root.y) * p - Math.sin(p * Math.PI) * 38 : target.root.y;
          this.hex(hx, hy, target.radius + 10, this.calm ? 0 : world / -2300);
        }
      }
      if (state.beast) {
        // A beast's ears and jaw frame the existing portrait; the Player can still recognize both Heroes.
        this.line([x-r, y-8, x-r*.9, y-r, x-r*.35, y-r*.65], LEAF, 5);
        this.line([x+r, y-8, x+r*.9, y-r, x+r*.35, y-r*.65], LEAF, 5);
        this.line([x-r*.9,y+r*.35,x-r*.55,y+r*.8,x,y+r*.93,x+r*.55,y+r*.8,x+r*.9,y+r*.35],LEAF,4);
        for (const side of [-1,1]) this.line([x+side*r*.42,y+r*.62,x+side*r*.28,y+r*.83], PALE, 3);
        // Beast HP is the recorded buffer, independent of the Hero's red health bar.
        this.ink.roundRect(x-r*.6,y-r-18,r*1.2,8,3).fill(0x162012)
          .roundRect(x-r*.6,y-r-18,r*1.2*Math.min(1,state.ward/Math.max(1,state.beastMax)),8,3).fill(LEAF);
      } else if (state.ward > 0 && token.who.class === 'warlock') {
        const shards = Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return [x+Math.cos(a)*(r+(i%2?0:9)),y+Math.sin(a)*(r+(i%2?0:9))];}).flat();
        this.ink.poly(shards).fill({color:ICE,alpha:.08}).stroke({color:ICE,width:3,alpha:.85});
        for(let i=0;i<6;i++){const a=i*Math.PI/3;this.line([x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82,x+Math.cos(a)*r,y+Math.sin(a)*r],ICE,2,.6);}
      }
    }
    if (!event) return;
    const a = cue.actor ? this.tokens.get(cue.actor) : undefined, b = cue.targets[0] ? this.tokens.get(cue.targets[0]) : undefined;
    const actorKey = cue.actor ?? 'hero';
    const visual = powerVisual(event, a?.who.class ?? null, this.before?.fighters[actorKey]?.beast);
    const p = this.calm ? .55 : clamp(time / Math.max(1,cue.length)), fade = this.calm ? .85 : Math.sin(p*Math.PI);
    const age = time-cue.contact;
    if (event.type === 'attack' && event.hit && a && b && this.before?.fighters[actorKey]?.smite === event.target) {
      const light = this.calm ? .8 : Math.max(0,1-Math.abs(age)/300);
      this.star(b.root.x,b.root.y,b.radius+45,GOLD,light);
      this.line([b.x,b.y-b.radius-70,b.x,b.y+b.radius],GOLD,7,light);
    }
    if (!visual) return;
    const target = b ?? a; if (!target) return;
    const x = target.root.x, y = target.root.y, r = target.radius;
    const color = ['smite','lay-on-hands','inspiration','action-surge'].includes(visual) ? GOLD : ['wild-shape','beast-claw','thorn'].includes(visual) ? LEAF : visual==='agathys'?ICE:VIOLET;
    if (!this.calm && age>=0 && !this.emitted) {
      this.emitted=true;this.spray(x,y,{color,count:14,speed:85,up:30,gravity:0,life:450,size:6,shape:'chip'});
    }
    if (visual==='hex') return; // Its geometry is persistent and moves between targets above.
    if (visual==='smite') {
      this.line([x,y-r-85,x,y+r*.5],GOLD,6,fade);
      this.line([x-23,y-r-20,x+23,y-r-20],GOLD,5,fade);
      this.star(x,y-r-20,56,GOLD,fade);
    } else if (visual==='agathys') {
      for(let i=0;i<8;i++){const angle=i*Math.PI/4, radius=r+16+p*32;
        this.line([x+Math.cos(angle)*r,y+Math.sin(angle)*r,x+Math.cos(angle)*radius,y+Math.sin(angle)*radius],ICE,5,fade);}
    } else if (visual==='wild-shape') {
      for(let i=0;i<7;i++){const angle=i*Math.PI*2/7+(this.calm?0:p*2),radius=r+20+(event.type==='feature'&&event.left===0?p:1-p)*35;
        const lx=x+Math.cos(angle)*radius,ly=y+Math.sin(angle)*radius;
        this.ink.moveTo(lx,ly-15).bezierCurveTo(lx+14,ly-5,lx+10,ly+9,lx,ly+15)
          .bezierCurveTo(lx-9,ly+3,lx-7,ly-8,lx,ly-15).fill({color:LEAF,alpha:fade*.7}).stroke({color:0x35432b,width:2,alpha:fade});
        this.line([lx,ly-11,lx,ly+11],0x5a6c42,1,fade);}
    } else if (visual==='flurry' || visual==='action-surge') {
      const origin=a??target, dx=origin.x,dy=origin.y;
      for(let i=0;i<3;i++){const offset=this.calm?18+i*16:18+i*19+p*28;
        if(visual==='flurry') this.line([dx-r-offset,dy+24-i*24,dx+r+offset,dy-18-i*24],PALE,4,fade*(1-i*.2));
        else this.line([dx-r-offset,dy+28,dx-r-offset+22,dy,dx-r-offset,dy-28],GOLD,5,fade*(1-i*.2));}
    } else if (visual==='inspiration' || visual==='cutting-words' || visual==='mockery') {
      const origin=a??target, targetX=x, targetY=y;
      for(let i=0;i<3;i++){
        const q=this.calm?.6:clamp(p*1.7-i*.15),px=origin.x+(targetX-origin.x)*q,py=origin.y+(targetY-origin.y)*q;
        if(visual==='cutting-words') this.line([px-30,py-18,px+20,py,px-30,py+18],VIOLET,4,fade);
        else this.ink.ellipse(px,py,18+i*10,34+i*12).stroke({color:visual==='inspiration'?GOLD:0xd09ec9,width:3,alpha:fade});
      }
      if(event.type==='feature'&&event.amount!==undefined){this.ink.poly([x,y-r-45,x+17,y-r-27,x,y-r-9,x-17,y-r-27]).stroke({color:PALE,width:3,alpha:fade});}
    } else if (visual==='quickened') {
      for(const side of [-1,1]){const angle=(this.calm?.8:p*5)*side;
        this.ink.moveTo(x+Math.cos(angle)*(r+22),y+Math.sin(angle)*(r+22)).arc(x,y,r+22,angle,angle+2).stroke({color:side===1?0xffaf68:VIOLET,width:6,alpha:fade});
        this.ink.circle(x+Math.cos(angle)*(r+22),y+Math.sin(angle)*(r+22),8).fill({color:PALE,alpha:fade});}
    } else if (visual==='lay-on-hands') {
      for(const side of [-1,1]){
        this.line([x+side*(r+15),y-20,x+side*(r+8),y+20,x+side*18,y+42],GOLD,7,fade);
        for(let i=0;i<4;i++)this.line([x+side*(r+5-i*8),y+18,x+side*(r+2-i*8),y-17-i*3],GOLD,3,fade);
      }
      if(a&&a!==b)this.ink.moveTo(a.x,a.y).quadraticCurveTo((a.x+x)/2,y-70,x,y).stroke({color:GOLD,width:5,alpha:fade});
    } else if (visual==='wholeness') {
      for(let i=0;i<5;i++){const angle=i*Math.PI/5;
        this.ink.ellipse(x+(i-2)*14,y+r*.65,12,25+Math.sin(angle)*15).stroke({color:PALE,width:3,alpha:fade});}
      this.line([x,y+r*.45,x,y-r-22],PALE,3,fade*.65);
    } else if (visual==='dark-blessing') {
      const source=this.fallen?this.tokens.get(this.fallen):undefined;
      for(let i=0;i<3;i++)this.ink.moveTo(source?.x??x-75,source?.y??y-80).bezierCurveTo(x-80+i*25,y-100,x+90-i*20,y+25,x,y)
        .stroke({color:VIOLET,width:2+i,alpha:fade});
      this.hex(x,y,r+16,this.calm?0:-p,fade);
    } else if (visual==='entropic-ward') {
      this.hex(x,y,r+20,this.calm?0:p*2,fade);
      this.ink.ellipse(x,y,35,13).stroke({color:VIOLET,width:4,alpha:fade}).circle(x,y,6).fill({color:PALE,alpha:fade});
    } else if (visual==='cloak-of-shadows') {
      for(let i=0;i<3;i++)this.ink.ellipse(x+(this.calm?0:(p-.5)*50),y,r+8+i*9,r+12).fill({color:0x312d48,alpha:fade*(.24-i*.05)});
      this.line([x-r-10,y-r*.4,x-r*.4,y-r-20,x+r*.5,y-r-10,x+r+12,y+r*.4],0xaaa3c5,4,fade);
      if(!this.calm)target.art.alpha=1-fade*.55;
    } else if (visual==='beast-claw') {
      for(let i=-1;i<=1;i++)this.line([x-35+i*22,y-r*.8,x+i*22,y,x+25+i*22,y+r*.7],LEAF,5,fade);
    } else if (a) {
      const q=this.calm?1:clamp(time/Math.max(1,cue.contact));
      const tx=x+(event.type==='attack'&&!event.hit?r+45:0),py=a.y+(y-a.y)*q,px=a.x+(tx-a.x)*q;
      if(visual==='eldritch'){
        for(let i=-1;i<=1;i++)this.ink.moveTo(a.x,a.y).bezierCurveTo(a.x+55+i*18,a.y-80,px-50,py+60+i*15,px,py).stroke({color:i?VIOLET:0xeaf5d4,width:i?3:5,alpha:fade});
      } else if(visual==='thorn'){
        this.ink.moveTo(a.x,a.y).quadraticCurveTo((a.x+px)/2+40,py+30,px,py).stroke({color:LEAF,width:5,alpha:fade});
        for(let i=1;i<7;i++){const u=i/7;this.line([a.x+(px-a.x)*u,a.y+(py-a.y)*u,a.x+(px-a.x)*u+12,a.y+(py-a.y)*u-14],LEAF,3,fade);}
      } else if(visual==='fire'){
        this.ink.ellipse(px,py,15,22).fill({color:0xff9753,alpha:fade}).circle(px,py,7).fill({color:GOLD,alpha:fade});
        this.line([a.x,a.y,px,py],0xf0844a,3,fade*.5);
      }
    }
  }
}
