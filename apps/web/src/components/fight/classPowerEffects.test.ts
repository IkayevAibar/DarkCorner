import { describe, expect, it } from 'vitest';
import { fightReplaySchema } from '@dark/shared';
import { classPowerFixtures } from './classPowerFixtures';
import { REAL_FIGHTS } from '../../screens/sandbox/fightExamples';
import { advance, framesFor, initialFrame } from './replay';
import { cueFor } from './choreography';
import { powerVisual } from './powerEffects';

const fights = classPowerFixtures(REAL_FIGHTS['goblins-victory-crit']!);
describe('new Class powers', () => {
  it('validates every example and gives all thirteen contract rows a distinct visual on both sides', () => {
    const visuals = new Set<string>();
    for(const replay of Object.values(fights)) {
      fightReplaySchema.parse(replay);
      const original=JSON.stringify(replay), frames=framesFor(replay);
      replay.events.forEach((event,i)=>{
        const cue=cueFor(replay,event,false), actor=cue.actor==='ally'?replay.ally:replay.hero;
        const visual=powerVisual(event,actor?.class??null,frames[i]!.fighters[cue.actor??'hero']?.beast);
        if(visual)visuals.add(visual);
        if(event.type==='feature' && event.target)expect(cue.targets).toEqual([event.target]);
        if(event.type==='attack')expect(frames[i+1]!.fighters[event.target]!.hp).toBe(event.targetHp);
        if(event.type==='heal')expect(frames[i+1]!.fighters[event.actor]!.hp).toBe(event.hp);
        expect(cue.length).toBeLessThanOrEqual(900);
        const calm=cueFor(replay,event,true);expect([calm.contact,calm.hold,calm.slow]).toEqual([0,0,0]);
      });
      expect(JSON.stringify(replay)).toBe(original);
    }
    for(const name of ['smite','lay-on-hands','hex','agathys','dark-blessing','flurry','wholeness','wild-shape','inspiration','cutting-words','quickened','action-surge','entropic-ward','cloak-of-shadows','eldritch','thorn','mockery','fire','beast-claw'])expect(visuals.has(name),name).toBe(true);
  });
  it.each(['hero','ally'] as const)('keeps %s Hex independent of a Ranger mark, moving only on the recorded event', actor=>{
    let frame=initialFrame(fights['power-warlock']!);
    frame=advance(frame,{type:'feature',feature:'mark',target:'m1',actor:actor==='hero'?'ally':'hero'});
    frame=advance(frame,{type:'feature',feature:'hex',target:'m0',actor});
    frame=advance(frame,{type:'defeated',key:'m0'});
    expect(frame.fighters[actor]).toMatchObject({hexed:'m0',marked:null});
    const moved=advance(frame,{type:'feature',feature:'hex',target:'m1',actor});
    expect(moved.fighters[actor]!.hexed).toBe('m1');
    expect(frame.fighters[actor]!.hexed).toBe('m0');
    expect(moved.fighters[actor==='hero'?'ally':'hero']!.marked).toBe('m1');
  });
  it('tracks a partner’s beast health separately and removes the beast exactly at zero',()=>{
    const replay=fights['power-druid-partner']!,frames=framesFor(replay);
    const changes=replay.events.flatMap((e,i)=>e.type==='feature'&&e.feature==='wild-shape'?[i]:[]);
    expect(changes).toHaveLength(3);
    expect(frames[changes[0]!+1]!.fighters.ally).toMatchObject({beast:true,ward:24,beastMax:24,hp:24});
    expect(frames[changes[1]!+1]!.fighters.ally).toMatchObject({beast:true,ward:12,beastMax:24,hp:24});
    expect(frames[changes[2]!+1]!.fighters.ally).toMatchObject({beast:false,ward:0,hp:24});
    expect(frames.every(f=>!f.fighters.hero!.beast)).toBe(true);
  });
  it('keeps a Divine smite attached through its following blow and heals the named partner',()=>{
    const replay=fights['power-paladin-partner']!,frames=framesFor(replay);
    expect(frames[2]!.fighters.ally!.smite).toBe('m0');
    expect(frames[3]!.fighters.ally!.smite).toBeNull();
    expect(frames[4]!.fighters.hero!.hp).toBe(44);
    expect(frames[4]!.fighters.ally!.hp).toBe(24);
    const event=replay.events[3]!;
    expect(cueFor(replay,event,false)).toMatchObject({actor:'ally',targets:['hero']});
  });
});
