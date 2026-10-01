import type { FightEventView, FightReplay, LocalizedText, MonsterPowerView } from '@dark/shared';
import type { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';
import { buzz, play } from '../../sound';
/** The sound of each event as it shows. */
export function sound(event: FightEventView): void {
  switch (event.type) {
    case 'initiative': play('draw'); break;
    case 'surprise': play('crit', { rate: 0.85, volume: 0.7 }); break;
    case 'escape':
      play('die');
      if (event.success) play('step', { delay: 350 });
      break;
    case 'attack':
      if (!event.hit) play('miss');
      else if (event.crit) {
        play('crit');
        play('hit', { delay: 70 });
        if (event.actor === 'hero' && event.natural === 20) buzz(60);
      } else play('hit');
      break;
    case 'burst':
      if (event.source === 'bomb') play('crit', { rate: 0.7 });
      play('hit', { rate: 0.8 });
      play('hit', { delay: 110 });
      break;
    case 'blocked': play('crit', { volume: 0.45, rate: 1.25 }); break;
    case 'defeated': play('loot', { rate: 0.75, volume: 0.7 }); break;
    case 'down': play('loot', { rate: 0.6 }); break;
    case 'death-save':
    case 'reroll':
      play('die');
      if (event.natural === 20) buzz([60, 40, 60]);
      break;
    case 'rise': play('equip'); break;
    case 'save': play('die'); break;
    case 'feature':
      if (event.feature === 'indomitable') play('equip', { rate: 0.8 });
      else if (event.feature === 'relentless') { play('crit', { rate: 0.65, volume: 0.7 }); play('equip', { rate: 0.8, delay: 90 }); }
      else if (event.feature === 'ward') play('crit', { rate: 1.4, volume: 0.4 });
      else if (event.feature === 'rage') play('crit', { rate: 0.55, volume: 0.9 });
      else if (event.feature === 'mark') play('equip', { rate: 1.4, volume: 0.6 });
      break;
    case 'tick': play('hit', { rate: 1.3, volume: 0.5 }); break;
    case 'fled': play('step'); play('step', { delay: 180 }); break;
    case 'power':
      if (event.power === 'breath' || event.power === 'explode') play('crit', { rate: 0.6 });
      else if (event.power === 'wail') play('crit', { rate: 0.5, volume: 0.8 });
      else if (event.power === 'thief') play('coins', { rate: 1.2 });
      else if (event.power === 'enrage' || event.power === 'frighten') play('crit', { rate: 0.7, volume: 0.8 });
      else if (event.power === 'undying') play('creak');
      break;
    case 'end':
      if (event.outcome === 'victory') play('coins', { delay: 150 });
      else if (event.outcome === 'dead') play('grave');
      break;
    default: break;
  }
}

/** Monster names, numbered when several share one ("Goblin 1", "Goblin 2"); in a Duo, the partner as 'ally'. */
export function displayNames(replay: FightReplay, text: (value: LocalizedText) => string): Record<string, string> {
  const names: Record<string, string> = { hero: text(replay.hero.name), ...(replay.ally ? { ally: text(replay.ally.name) } : {}) };
  const count = new Map<string, number>();
  for (const m of replay.monsters) count.set(text(m.name), (count.get(text(m.name)) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const m of replay.monsters) {
    const base = text(m.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    names[m.key] = count.get(base)! > 1 ? `${base} ${n}` : base;
  }
  return names;
}

/** The monster powers that show up as their own line in a fight. */
const POWER_LINES: Partial<Record<MonsterPowerView, MessageKey>> = {
  thief: 'fight.power.thief',
  mend: 'fight.power.mend',
  breath: 'fight.power.breath',
  drain: 'fight.power.drain',
  undying: 'fight.power.undying',
  enrage: 'fight.power.enrage',
  frighten: 'fight.power.frighten',
  explode: 'fight.power.explode',
  wail: 'fight.power.wail',
  twin: 'fight.power.twin',
};

export function describe(t: ReturnType<typeof useI18n>['t'], e: FightEventView, names: Record<string, string>): string | null {
  const n = (key: string) => names[key] ?? key;
  // Lines about a Hero that don't name one: the Hero watching, or in a Duo its partner ('ally').
  const self = n('actor' in e && e.actor ? e.actor : 'hero');
  const duo = names.ally !== undefined;
  switch (e.type) {
    case 'initiative': return t('fight.initiative', { list: e.order.map(n).join(', ') });
    case 'attack':
      if (!e.hit) return t('fight.miss', { actor: n(e.actor), target: n(e.target), d: e.natural });
      if (e.crit) return t('fight.crit', { actor: n(e.actor), target: n(e.target), n: e.damage });
      return t(e.kind === 'spell' ? 'fight.spell' : 'fight.hit', { actor: n(e.actor), target: n(e.target), n: e.damage });
    case 'blocked': return t(e.by === 'shield' ? 'fight.shield' : 'fight.blocked', { actor: n(e.actor) });
    case 'burst': return t(e.source === 'bomb' ? 'fight.bomb' : 'fight.burst', { actor: n(e.actor), n: e.targets.reduce((s, x) => s + x.damage, 0) });
    case 'heal':
      return e.by && e.by !== e.actor
        ? t('fight.heal.mend', { by: n(e.by), actor: n(e.actor), n: e.amount })
        : t(`fight.heal.${e.ability}`, { actor: n(e.actor), n: e.amount });
    case 'defeated': return t('fight.defeated', { name: n(e.key) });
    case 'down': return t('fight.down', { name: self });
    case 'death-save': return duo
      ? t('fight.deathSaveOf', { name: self, d: e.natural, s: e.successes, f: e.failures })
      : t('fight.deathSave', { d: e.natural, s: e.successes, f: e.failures });
    case 'rise': return t('fight.rise', { name: self, n: e.hp });
    case 'reroll': return t('fight.reroll', { name: self, d: e.natural });
    case 'surprise': return t(`fight.surprise.${e.side}`);
    case 'escape': return t(e.success ? 'fight.escape.yes' : 'fight.escape.no', { name: self, d: e.natural, t: e.total, dc: e.dc });
    case 'power': {
      const key = POWER_LINES[e.power];
      return key ? t(key, { actor: n(e.actor), target: n(e.target ?? 'hero'), n: e.power === 'twin' ? e.hp ?? 0 : e.amount ?? 0 }) : null;
    }
    case 'save': {
      const line = t('fight.save', { ability: t(`ability.${e.ability}`), d: e.natural, t: e.total, dc: e.dc, result: t(e.success ? 'result.success' : 'result.failure') });
      return duo ? `${self}: ${line}` : line;
    }
    case 'status': return t(`fight.status.${e.status}`, { name: n(e.target) });
    case 'expire': return t(`fight.expire.${e.status}`, { name: n(e.target) });
    case 'tick': return t(e.status === 'poisoned' ? 'fight.tickPoison' : 'fight.tick', { name: n(e.target), n: e.damage });
    case 'held': return t('fight.held', { name: n(e.target) });
    case 'feature':
      if (e.feature === 'survivor') return t('fight.feature.survivor', { name: self, n: e.amount ?? 0 });
      if (e.feature === 'indomitable') return t('fight.feature.indomitable', { name: self });
      if (e.feature === 'relentless') return t('fight.feature.relentless', { name: self });
      if (e.feature === 'rage') return t('fight.feature.rage', { name: self });
      if (e.feature === 'mark') return t('fight.feature.mark', { name: self, target: n(e.target ?? '') });
      if (e.feature === 'dodge') return t('fight.feature.dodge', { name: self });
      if (e.feature === 'help') return t('fight.feature.help', { name: self, target: n(e.target ?? '') });
      if (e.feature === 'guard') return t('fight.feature.guard', { name: self, target: n(e.target ?? '') });
      return e.amount === undefined
        ? t('fight.feature.wardUp', { name: self, n: e.left ?? 0 })
        : t('fight.feature.ward', { n: e.amount, left: e.left ?? 0 });
    case 'fled': return t('fight.fled', { name: n(e.key) });
    case 'revive': return t(e.success ? 'fight.revive.yes' : 'fight.revive.no', { actor: self, target: n(e.target), d: e.natural, t: e.total, dc: e.dc, n: e.hp });
    case 'end': return null;
  }
}
