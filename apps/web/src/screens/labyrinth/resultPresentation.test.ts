import { describe, expect, it } from 'vitest';
import type { LabyrinthResult, LiveFight } from '@dark/shared';
import { REAL_FIGHTS } from '../sandbox/fightExamples';
import { OATH_CASES, OATH_NOTICES, TRUST_VIEW, trustChest } from '../sandbox/trustFixtures';
import { initialPresentation, resultPresentation, type ResultPresentation } from './resultPresentation';

const result = (extra: Partial<LabyrinthResult> = {}): LabyrinthResult => ({
  view: TRUST_VIEW, fight: null, loot: [], gold: 0, xp: 0, levelUp: null, died: false,
  notices: [], checks: [], duel: null, run: null, deeds: [], oath: null, closedChest: null, ...extra,
});
const receive = (state: ResultPresentation, next: LabyrinthResult) => resultPresentation(state, { type: 'receive', result: next });
const finish = (state: ResultPresentation) => {
  if (!state.scene) throw new Error('Expected an active result scene');
  return resultPresentation(state, { type: 'finish', scene: state.scene });
};
const atRoom = () => receive(initialPresentation, result());
const replay = REAL_FIGHTS['goblins-victory-crit']!;

describe('one-shot Labyrinth result presentation', () => {
  it.each(Object.entries(OATH_CASES))('keeps the receiving Player’s %s oath and original rewards until the reveal ends', (_, oath) => {
    const next = result({ oath, notices: OATH_NOTICES.kept, loot: [trustChest().items[0]!.item], gold: 12 });
    const revealing = receive(atRoom(), next);
    expect(revealing.scene?.kind).toBe('oath');
    expect(revealing.scene?.result.oath).toBe(oath);
    expect(revealing.report).toBeNull();
    const done = finish(revealing);
    expect(done.report).toBe(next);
    expect(done.view).toBe(next.view);
    expect(receive(done, result()).scene).toBeNull();
  });

  it('queues partner news and empty looks without interrupting a reveal or losing rewards', () => {
    const first = result({ oath: OATH_CASES.kept, notices: OATH_NOTICES.kept, gold: 12 });
    let state = receive(atRoom(), first);
    const scene = state.scene;
    const later = result({ gold: 7, xp: 9, loot: [trustChest().items[1]!.item], notices: OATH_NOTICES.taken });
    state = receive(receive(state, later), result());
    expect(state.scene).toBe(scene);
    expect(state.report).toBeNull();
    state = finish(state);
    expect(state.scene).toBeNull();
    expect(state.waiting).toEqual([]);
    expect(state.report).toMatchObject({ gold: 19, xp: 9, loot: later.loot, oath: first.oath, notices: [...first.notices, ...later.notices] });
  });

  it('retains the previous Room and partner for a final Chest even when the Duo has ended at home', () => {
    const chest = trustChest();
    const before = { ...TRUST_VIEW, chest };
    const home = { ...TRUST_VIEW, location: 'city' as const, room: null, floor: null, duo: null, chest: null };
    const closedChest = { ...chest, turn: null, items: chest.items.map(entry => ({ ...entry, takenBy: 'partner' as const })) };
    let state = receive(receive(initialPresentation, result({ view: before })), result({ view: home, closedChest }));
    expect(state.scene?.kind).toBe('chest');
    expect(state.scene?.before).toBe(before);
    expect(state.view).toBe(before);
    expect(state.report).toBeNull();
    state = finish(state);
    expect(state.view).toBe(home);
    expect(state.report?.closedChest).toBe(closedChest);
  });

  it('presents a closed Chest received on the first look, with no invented previous ownership', () => {
    const closedChest = { ...trustChest(), turn: null };
    const state = receive(initialPresentation, result({ closedChest }));
    expect(state.view).toBe(TRUST_VIEW);
    expect(state.scene).toMatchObject({ kind: 'chest', before: null });
    expect(finish(state).report?.closedChest).toBe(closedChest);
  });

  it('plays every receipt before the report and ignores a completion callback from the previous picture', () => {
    const next = result({ oath: OATH_CASES.cracked, closedChest: { ...trustChest(), turn: null }, fight: replay });
    let state = receive(atRoom(), next);
    const old = state.scene!;
    state = finish(state);
    expect(state.scene?.kind).toBe('chest');
    expect(resultPresentation(state, { type: 'finish', scene: old })).toBe(state);
    expect(state.report).toBeNull();
    state = finish(state);
    expect(state.scene?.kind).toBe('fight');
    expect(state.report).toBeNull();
    state = finish(state);
    expect(state.scene).toBeNull();
    expect(state.report).toBe(next);
  });

  it('gives consecutive queued reveals distinct identities so their animation restarts', () => {
    let state = receive(atRoom(), result({ oath: OATH_CASES.kept }));
    const first = state.scene!;
    state = receive(state, result({ oath: OATH_CASES.cracked }));
    state = finish(state);
    expect(state.scene?.kind).toBe('oath');
    expect(state.scene?.id).not.toBe(first.id);
    expect(resultPresentation(state, { type: 'finish', scene: first })).toBe(state);
  });

  it('keeps an Auto fight ahead of its report', () => {
    const next = result({ fight: replay, xp: 21 });
    const state = receive(atRoom(), next);
    expect(state.scene?.kind).toBe('fight');
    expect(state.report).toBeNull();
    expect(finish(state).report).toBe(next);
  });

  it('keeps a Manual fight on its existing board for the last blows', () => {
    const fight: LiveFight = { ...replay, events: replay.events.slice(0, 1), mine: true, auto: false, deadline: null,
      turn: { hero: 'hero', round: 1, continuing: false, actions: ['attack'], targets: replay.monsters.map(monster => monster.key), cure: [], rage: false, mark: false, attacks: 1, spells: 0, heals: 0, potions: 0 } };
    const before = { ...TRUST_VIEW, fight };
    const next = result({ fight: replay, xp: 21 });
    const state = receive(receive(initialPresentation, result({ view: before })), next);
    expect(state.scene?.kind).toBe('ending');
    expect(state.view?.fight).toBe(fight);
    expect(state.report).toBeNull();
    expect(finish(state).report).toBe(next);
  });
});
