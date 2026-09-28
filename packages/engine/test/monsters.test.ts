import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, ELITE_CHANCE, ELITES, type FightEvent, type FightInput, type HeroCombat, type MonsterInstance, createRng,
  floorMight, heroCombat, instantiate, monsterById, restUses, simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

/** A Hero of a Class and level, in its Starter kit or with the main weapon swapped. */
function hero(cls: ClassId, level = 5, weapon?: string): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * 10;
  const kit = CLASS_DEFS[cls].starterKit.map((base, i) => (i === 0 && weapon ? weapon : base));
  const worn = kit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  return heroCombat({ name: 'Test', class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
}

const fight = (seed: string, h: HeroCombat, monsters: MonsterInstance[], extra: Partial<FightInput> = {}) =>
  simulateFight(createRng(seed), { hero: h, monsters, uses: restUses(h.class, h.level), potions: 0, runPowers: { deathless: false, lucky: false }, stance: 'bold', ...extra });

const mon = (id: string, floor: number, key = 'm0') => instantiate(monsterById(id), floor, key);
const of = <T extends FightEvent['type']>(events: FightEvent[], type: T) => events.filter((e): e is Extract<FightEvent, { type: T }> => e.type === type);

describe('monster powers', () => {
  it('lets a cutpurse snatch gold and run with it, unless it falls first', () => {
    let ran = 0;
    let caught = 0;
    for (let i = 0; i < 300; i++) {
      const r = fight(`thief-${i}`, { ...hero('wizard', 1), hp: 999, maxHp: 999 }, [mon('goblin-cutpurse', 2)], { gold: 50 });
      const grabs = of(r.events, 'power').filter((e) => e.power === 'thief');
      expect(grabs.length).toBeLessThanOrEqual(1);
      if (grabs.length === 0) continue;
      expect(grabs[0]!.amount).toBeGreaterThan(0);
      expect(grabs[0]!.amount).toBeLessThanOrEqual(50);
      if (of(r.events, 'fled').length > 0) {
        ran++;
        expect(r.goldStolen).toBe(grabs[0]!.amount);
        expect(r.xp).toBe(0);
      } else {
        caught++;
        expect(r.goldStolen).toBe(0);
      }
    }
    expect(ran).toBeGreaterThan(0);
    expect(caught).toBeGreaterThan(0);
    // No gold carried, nothing to take.
    const broke = fight('broke', hero('fighter', 1), [mon('goblin-cutpurse', 2)], { gold: 0 });
    expect(of(broke.events, 'power')).toHaveLength(0);
  });

  it('breaks skeletons with blunt weapons and lets points slip through', () => {
    const perHit = (weapon: string) => {
      let damage = 0;
      let hits = 0;
      for (let i = 0; i < 300; i++) {
        const r = fight(`bones-${weapon}-${i}`, { ...hero('fighter', 5, weapon), hp: 999, maxHp: 999 }, [mon('skeleton', 5)]);
        for (const e of of(r.events, 'attack')) {
          if (e.actor === 'hero' && e.hit && !e.crit) {
            damage += e.damage;
            hits++;
          }
        }
      }
      return damage / hits;
    };
    const blunt = perHit('warhammer');
    const edge = perHit('longsword');
    const point = perHit('rapier');
    expect(blunt).toBeGreaterThan(edge * 1.2);
    expect(point).toBeLessThan(edge * 0.9);
  });

  it('paralyzes only after a failed CON save, and the Hero loses that turn', () => {
    let held = 0;
    for (let i = 0; i < 200; i++) {
      const r = fight(`ghoul-${i}`, { ...hero('wizard', 5), hp: 999, maxHp: 999 }, [mon('ghoul', 5)]);
      const saves = of(r.events, 'save');
      for (const s of saves) expect(s.ability).toBe('con');
      const statuses = of(r.events, 'status').filter((e) => e.status === 'paralyzed');
      expect(statuses.length).toBe(saves.filter((s) => !s.success).length);
      held += of(r.events, 'held').length;
    }
    expect(held).toBeGreaterThan(0);
  });

  it('keeps a zombie standing at 1 health once in a while, never twice', () => {
    let rose = 0;
    for (let i = 0; i < 300; i++) {
      const r = fight(`zombie-${i}`, { ...hero('fighter', 5), hp: 999, maxHp: 999 }, [mon('zombie', 5)]);
      const ups = of(r.events, 'power').filter((e) => e.power === 'undying');
      expect(ups.length).toBeLessThanOrEqual(1);
      if (ups.length === 1) {
        rose++;
        expect(ups[0]!.hp).toBe(1);
      }
      expect(r.outcome).toBe('victory');
    }
    expect(rose).toBeGreaterThan(20);
  });

  it('opens a Dragon fight with fear and then fire, each with a save', () => {
    const r = fight('dragon', { ...hero('fighter', 20), hp: 9999, maxHp: 9999 }, [instantiate(monsterById('ancient-dragon'), 10, 'm0')]);
    const powers = of(r.events, 'power');
    expect(powers[0]).toMatchObject({ power: 'frighten', actor: 'm0' });
    const firstBreath = r.events.findIndex((e) => e.type === 'power' && e.power === 'breath');
    const firstBite = r.events.findIndex((e) => e.type === 'attack' && e.actor === 'm0');
    expect(firstBreath).toBeGreaterThan(-1);
    expect(firstBite === -1 || firstBreath < firstBite).toBe(true);
    expect(r.events[firstBreath - 1]).toMatchObject({ type: 'save', ability: 'dex' });
    expect(powers.filter((e) => e.power === 'enrage').length).toBeLessThanOrEqual(1);
  });

  it('lets a cultist mend a badly hurt friend once', () => {
    let mends = 0;
    for (let i = 0; i < 200; i++) {
      // A sturdy cultist outlives the brute it tends, so the Hero (who hits the weakest first) hurts the brute.
      const cultist = { ...mon('cultist', 8, 'm0'), hp: 500, maxHp: 500 };
      const r = fight(`cult-${i}`, { ...hero('fighter', 8), hp: 999, maxHp: 999 }, [cultist, mon('demon-brute', 8, 'm1')]);
      const mended = of(r.events, 'power').filter((e) => e.power === 'mend');
      expect(mended.length).toBeLessThanOrEqual(1);
      if (mended.length === 1) {
        mends++;
        expect(mended[0]!.target).toBe('m1');
        expect(mended[0]!.amount).toBeGreaterThan(0);
      }
    }
    expect(mends).toBeGreaterThan(0);
  });

  it('sets the Hero burning on an imp’s hit, and the fire bites each turn', () => {
    let ticks = 0;
    for (let i = 0; i < 100; i++) {
      const r = fight(`imp-${i}`, { ...hero('fighter', 7), hp: 999, maxHp: 999 }, [mon('imp', 7)]);
      if (of(r.events, 'status').some((e) => e.status === 'burning' && e.target === 'hero')) ticks += of(r.events, 'tick').length;
    }
    expect(ticks).toBeGreaterThan(0);
  });

  it('gives wolves advantage while a friend stands', () => {
    const rate = (label: string, monsters: () => MonsterInstance[]) => {
      let hits = 0;
      let swings = 0;
      for (let i = 0; i < 300; i++) {
        const r = fight(`wolf-${label}-${i}`, { ...hero('fighter', 3), hp: 999, maxHp: 999 }, monsters(), { stance: 'steady' });
        for (const e of of(r.events, 'attack')) {
          if (e.actor !== 'm0') continue;
          swings++;
          if (e.hit) hits++;
        }
      }
      return hits / swings;
    };
    const alone = rate('alone', () => [mon('wolf', 3, 'm0')]);
    const pack = rate('pack', () => [mon('wolf', 3, 'm0'), { ...mon('giant-rat', 3, 'm1'), hp: 500, maxHp: 500 }]);
    expect(pack).toBeGreaterThan(alone + 0.1);
  });

  it('poisons only after a failed CON save, and the poison bites at the start of the Hero’s next 2 turns', () => {
    let poisonings = 0;
    for (let i = 0; i < 200; i++) {
      const r = fight(`spider-${i}`, { ...hero('fighter', 1), hp: 999, maxHp: 999 }, [mon('giant-spider', 1)]);
      r.events.forEach((e, at) => {
        if (e.type !== 'status' || e.status !== 'poisoned') return;
        poisonings++;
        const save = r.events[at - 1];
        expect(save).toMatchObject({ type: 'save', ability: 'con', success: false });
        expect(e.turns).toBe(2);
      });
      const ticks = of(r.events, 'tick').filter((e) => e.status === 'poisoned');
      for (const tick of ticks) expect(tick.damage).toBeGreaterThanOrEqual(1);
      expect(ticks.length).toBeLessThanOrEqual(2 * of(r.events, 'status').filter((e) => e.status === 'poisoned').length);
    }
    expect(poisonings).toBeGreaterThan(20);
  });

  it('sets off a sapper’s bomb as it falls: a DEX save halves it', () => {
    let blasts = 0;
    for (let i = 0; i < 200; i++) {
      const r = fight(`sapper-${i}`, { ...hero('fighter', 1), hp: 999, maxHp: 999 }, [mon('goblin-sapper', 1)]);
      const fell = r.events.findIndex((e) => e.type === 'defeated' && e.key === 'm0');
      if (fell < 0) continue;
      blasts++;
      expect(r.events[fell + 1]).toMatchObject({ type: 'save', ability: 'dex' });
      const blast = r.events[fell + 2];
      expect(blast).toMatchObject({ type: 'power', power: 'explode', actor: 'm0', target: 'hero' });
      const saved = (r.events[fell + 1] as { success: boolean }).success;
      expect((blast as { amount: number }).amount).toBeLessThanOrEqual(saved ? 4 : 8);
    }
    expect(blasts).toBeGreaterThan(150);
  });

  it('lets a last blast drop a winning Hero, who then makes death saves', () => {
    for (let i = 0; i < 100; i++) {
      const r = fight(`last-blast-${i}`, { ...hero('fighter', 3), hp: 1, maxHp: 30 }, [{ ...mon('goblin-sapper', 1), hp: 1, maxHp: 1 }], { stance: 'steady' });
      // Whatever happens, a Hero never walks off a winner with no health.
      expect(r.hp > 0 || r.outcome === 'dead').toBe(true);
      if (of(r.events, 'down').length > 0) expect(r.outcome === 'victory' ? r.hp > 0 : true).toBe(true);
    }
  });

  it('halves weapon hits on a swarm, and doubles bombs and bursts', () => {
    const avg = (label: string, target: () => MonsterInstance) => {
      let damage = 0;
      let hits = 0;
      for (let i = 0; i < 300; i++) {
        const r = fight(`swarm-${label}-${i}`, { ...hero('fighter', 3), hp: 999, maxHp: 999 }, [{ ...target(), hp: 500, maxHp: 500 }], { stance: 'steady' });
        for (const e of of(r.events, 'attack')) {
          if (e.actor !== 'hero' || !e.hit || e.crit) continue;
          damage += e.damage;
          hits++;
        }
      }
      return damage / hits;
    };
    const swarm = avg('on', () => mon('bat-swarm', 2));
    const plain = avg('off', () => ({ ...mon('bat-swarm', 2), powers: [] }));
    expect(swarm / plain).toBeGreaterThan(0.4);
    expect(swarm / plain).toBeLessThan(0.6);

    const bombed = fight('swarm-bomb', { ...hero('fighter', 3), hp: 999, maxHp: 999 }, [
      { ...mon('bat-swarm', 2, 'm0'), hp: 500, maxHp: 500 }, { ...mon('goblin', 2, 'm1'), hp: 500, maxHp: 500 },
    ], { bomb: { dice: 2, sides: 6, bonus: 4 } });
    const burst = of(bombed.events, 'burst')[0]!;
    expect(burst.targets[0]!.damage).toBe(2 * burst.targets[1]!.damage);
  });

  it('opens with a banshee’s wail: a WIS save halves it', () => {
    for (let i = 0; i < 100; i++) {
      const h = { ...hero('cleric', 5), hp: 999, maxHp: 999 };
      const r = fight(`banshee-${i}`, h, [mon('banshee', 4)]);
      const at = r.events.findIndex((e) => e.type === 'power' && e.power === 'wail');
      expect(at).toBeGreaterThan(0);
      expect(r.events[at - 1]).toMatchObject({ type: 'save', ability: 'wis' });
      const wail = r.events[at] as { amount: number; hp: number };
      expect(wail.hp).toBe(999 - wail.amount);
      expect(r.events.slice(0, at).some((e) => e.type === 'attack')).toBe(false);
    }
  });
});

describe('elite packs and escorts', () => {
  it('turns a group’s strongest monster elite now and then, from Floor 2 down', () => {
    for (let i = 0; i < 300; i++) {
      expect(spawnEncounter(createRng(`f1-${i}`), 1, 'fight').every((m) => m.elite === null)).toBe(true);
    }
    let elites = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const group = spawnEncounter(createRng(`f5-${i}`), 5, 'fight');
      const elite = group.filter((m) => m.elite !== null);
      expect(elite.length).toBeLessThanOrEqual(1);
      if (elite.length === 1) {
        elites++;
        expect(elite[0]!.maxHp).toBe(Math.max(...group.map((m) => m.maxHp)));
      }
    }
    expect(elites / n).toBeGreaterThan(ELITE_CHANCE.crypts - 0.03);
    expect(elites / n).toBeLessThan(ELITE_CHANCE.crypts + 0.03);
  });

  it('gives each elite gift its edge, and double XP', () => {
    const plain = mon('ghoul', 5);
    const gifted = Object.fromEntries(ELITES.map((e) => [e, instantiate(monsterById('ghoul'), 5, 'm0', 0, e)]));
    expect(Math.abs(gifted.gilded!.maxHp - plain.maxHp * 1.5)).toBeLessThanOrEqual(1);
    expect(gifted.frenzied!.damageFactor).toBe(1.5);
    expect(gifted.armored!.ac).toBe(plain.ac + 3);
    expect(gifted.vampiric!.powers.map((p) => p.id)).toContain('drain');
    expect(gifted.swift!.powers.map((p) => p.id)).toEqual(expect.arrayContaining(['quick', 'multiattack']));
    // Double XP, give or take the rounding of the Floor scaling.
    for (const e of ELITES) expect(Math.abs(gifted[e]!.xp - plain.xp * 2)).toBeLessThanOrEqual(1);
  });

  it('leaves Floors 1 and 2 as they are and makes every Floor below tougher', () => {
    expect(floorMight(1)).toEqual({ hp: 1, hit: 0, damage: 0 });
    expect(floorMight(2)).toEqual({ hp: 1, hit: 0, damage: 0 });
    for (let floor = 3; floor <= 10; floor++) {
      const above = floorMight(floor - 1);
      const here = floorMight(floor);
      expect(here.hp).toBeGreaterThan(above.hp);
      expect(here.hit).toBeGreaterThanOrEqual(above.hit);
      expect(here.damage).toBeGreaterThanOrEqual(above.damage);
    }
    // A Floor 6 ghoul: two Floors into the crypts, and four below Floor 2.
    const ghoul = mon('ghoul', 6);
    const def = monsterById('ghoul');
    expect(ghoul.maxHp).toBe(Math.round(def.hp * 1.3 * floorMight(6).hp));
    expect(ghoul.attack).toBe(def.attack + 2 + floorMight(6).hit);
  });

  it('keeps the Dragon to its own measure, and grows the monsters that turn up anywhere as if they lived there', () => {
    const dragon = monsterById('ancient-dragon');
    expect(mon('ancient-dragon', 10)).toMatchObject({ maxHp: dragon.hp, attack: dragon.attack });
    // A mimic on Floor 9 (the depths' third Floor) is as deep into its theme as the Floor's own monsters.
    const mimic = monsterById('mimic');
    expect(mon('mimic', 9).attack).toBe(mimic.attack + 2 + floorMight(9).hit);
    expect(mon('mimic', 1).attack).toBe(mimic.attack);
  });

  it('brings Mini-bosses with their escorts', () => {
    const chief = spawnEncounter(createRng('chief'), 2, 'miniboss');
    expect(chief.map((m) => m.id)).toEqual(['goblin-chieftain', 'goblin-archer']);
    expect(chief.map((m) => m.key)).toEqual(['m0', 'm1']);
    expect(spawnEncounter(createRng('dragon'), 10, 'boss').map((m) => m.id)).toEqual(['ancient-dragon']);
  });
});
