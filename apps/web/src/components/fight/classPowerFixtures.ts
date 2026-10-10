import type { FightEventView, FightReplay } from '@dark/shared';

/** Short, recorded-value visual examples, deliberately separate from the untouched engine replays. */
export function classPowerFixtures(base: FightReplay): Record<string, FightReplay> {
  const hit = (actor = 'hero', kind: 'spell' | 'weapon' = 'weapon', target = 'm0', hp = 28): Extract<FightEventView, { type: 'attack' }> =>
    ({ type: 'attack', actor, target, natural: 16, total: 21, hit: true, crit: false, damage: 8, targetHp: hp, kind });
  const miss = (actor = 'm0'): Extract<FightEventView, { type: 'attack' }> =>
    ({ type: 'attack', actor, target: 'hero', natural: 11, total: 15, hit: false, crit: false, damage: 0, targetHp: 24, kind: 'weapon' });
  const examples: Array<[NonNullable<FightReplay['hero']['class']>, FightEventView[]]> = [
    ['paladin', [
      { type: 'feature', feature: 'smite', target: 'm0' }, hit(),
      { type: 'heal', actor: 'ally', by: 'hero', ability: 'lay-on-hands', amount: 20, hp: 44 },
      { type: 'heal', actor: 'hero', ability: 'lay-on-hands', amount: 20, hp: 44 },
    ]],
    ['warlock', [
      { type: 'feature', feature: 'ward', left: 12 },
      { type: 'feature', feature: 'hex', target: 'm0' }, hit('hero', 'spell', 'm0', 0),
      { type: 'defeated', key: 'm0' },
      { type: 'heal', actor: 'hero', ability: 'dark-blessing', amount: 8, hp: 32 },
      { type: 'feature', feature: 'hex', target: 'm1' }, hit('hero', 'spell', 'm1', 28),
      { type: 'feature', feature: 'ward', amount: 7, left: 5 },
      { type: 'blocked', actor: 'm1', target: 'hero', by: 'entropic-ward' }, miss('m1'),
      { type: 'feature', feature: 'ward', amount: 5, left: 0 },
    ]],
    ['monk', [
      { type: 'feature', feature: 'flurry' }, hit(), hit('hero', 'weapon', 'm0', 20),
      { type: 'heal', actor: 'hero', ability: 'wholeness', amount: 18, hp: 42 },
      { type: 'blocked', actor: 'm0', target: 'hero', by: 'cloak-of-shadows' },
      { ...miss(), targetHp: 42 },
    ]],
    ['druid', [
      { type: 'feature', feature: 'wild-shape', left: 24 }, hit(),
      { type: 'feature', feature: 'wild-shape', amount: 12, left: 12 },
      { ...hit('m0', 'weapon', 'hero', 24), damage: 0 }, hit('hero', 'weapon', 'm0', 20),
      { type: 'feature', feature: 'wild-shape', amount: 12, left: 0 },
      { ...hit('m0', 'weapon', 'hero', 24), damage: 0 }, hit('hero', 'spell', 'm0', 12),
    ]],
    ['bard', [
      { type: 'feature', feature: 'inspiration', amount: 5 }, hit('hero', 'spell'),
      { type: 'feature', feature: 'cutting-words', target: 'm0', amount: 4 }, miss(),
      hit('hero', 'spell', 'm0', 20),
    ]],
    ['sorcerer', [
      { type: 'feature', feature: 'quickened' }, hit('hero', 'spell'), hit('hero', 'spell', 'm0', 20),
    ]],
    ['fighter', [
      hit(), { type: 'feature', feature: 'action-surge' }, hit('hero', 'weapon', 'm0', 20),
    ]],
  ];
  const portraits = { paladin: 'human-paladin-2', warlock: 'human-warlock-1', monk: 'human-monk-1', druid: 'human-druid-1', bard: 'human-bard-2', sorcerer: 'human-sorcerer-2', fighter: 'human-fighter-2' };
  const names = { paladin: 'Паладин', warlock: 'Колдун', monk: 'Монах', druid: 'Друид', bard: 'Бард', sorcerer: 'Чародей', fighter: 'Воин' };
  const result: Record<string, FightReplay> = {};
  for (const [calling, events] of examples) {
    const id = calling as keyof typeof portraits;
    const replay: FightReplay = { ...base, hero: { ...base.hero, key: 'hero', class: calling,
      name: { en: calling[0]!.toUpperCase()+calling.slice(1), ru: names[id] }, hp: 24, maxHp: 60,
      art: '/art/portraits/'+portraits[id]+'.webp' },
      ally: { ...base.hero, key: 'ally', class: 'fighter', hp: 24, maxHp: 60, name: { en: 'Partner', ru: 'Напарник' }, art: '/art/portraits/human-fighter-2.webp' },
      monsters: [0,1].map(i=>({...base.monsters[0]!,key:'m'+i,hp:calling==='warlock'&&i===0?8:36,maxHp:36})),
      events: [{type:'initiative',order:['hero','ally','m0','m1']},...events,{type:'end',outcome:'escaped'}], outcome:'escaped' };
    result['power-'+calling] = replay;
    result['power-'+calling+'-partner'] = partnerSide(replay);
  }
  return result;
}

function partnerSide(replay: FightReplay): FightReplay {
  const swap = (key: string) => key === 'hero' ? 'ally' : key === 'ally' ? 'hero' : key;
  return { ...replay, hero: { ...replay.ally!, key:'hero' }, ally: { ...replay.hero,key:'ally' },
    events: replay.events.map(event => {
      if(event.type==='initiative')return {...event,order:event.order.map(swap)};
      if(event.type==='feature')return {...event,actor:swap(event.actor??'hero'),...(event.target?{target:swap(event.target)}:{})};
      if(event.type==='attack')return {...event,actor:swap(event.actor),target:swap(event.target)};
      if(event.type==='heal')return {...event,actor:swap(event.actor),...(event.by?{by:swap(event.by)}:{})};
      if(event.type==='blocked')return {...event,actor:swap(event.actor),target:swap(event.target??'hero')};
      return event;
    }),
  };
}
