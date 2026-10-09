# Codex task 25: fight effects for the new Class powers

**Branch:** `codex/class-power-effects`, based on `main` once `claude/classes-2` is merged.
**Owner of the area:** Codex (see [AGENTS.md](../../AGENTS.md)).

## Goal

Six Classes joined on 2026-10-10 (docs/design.md → Classes), and their powers already arrive in the fight events, but the stage plays most of them with no effect of their own. Give each a short effect in the style of the Rage aura and the Hunter's mark reticle, so a Player watching a fight sees what the Class did.

## Contract

The events are in `packages/shared/src/labyrinth.ts` (`fightEventSchema`); the fight log already describes each one (`apps/web/src/components/fight/presentation.ts`).

| Event | What happened | Today |
|---|---|---|
| `feature: 'smite'` (`target`) | A Paladin's Divine smite: the next event is its hit on `target`, with holy fire in it. | nothing |
| `heal: 'lay-on-hands'` | A Paladin's healing touch (on its partner when `by` is set). | the Cure wounds glow, in gold |
| `feature: 'hex'` (`target`) | A Warlock's Hex on `target`; it moves on when that monster falls, like a Hunter's mark. | the mark's reticle (`replay.ts` treats it as a mark) |
| `feature: 'ward'` on a Warlock | Armor of Agathys: frost wraps it as a hard fight begins, and soaks blows like an Abjurer's ward. | the ward's shimmer |
| `heal: 'dark-blessing'` | A Fiend Warlock feeds on a kill. | a purple heal |
| `feature: 'flurry'` | A Monk's Flurry of blows: one more strike this turn. | nothing |
| `heal: 'wholeness'` | An Open Hand Monk's Wholeness of body. | a pale heal |
| `feature: 'wild-shape'` | A Druid becomes a beast (`left` = its health, no `amount`), the beast soaks a blow (`amount`, `left`), or falls away (`left` 0). | the ward's bar shows the beast's health (`replay.ts`) |
| `feature: 'inspiration'` (`amount`) | A Bard's die lands its missed spell: the next event is that spell's hit. | nothing |
| `feature: 'cutting-words'` (`amount`, `target`) | A Bard's die turns aside `target`'s blow: the next event is that monster's miss. | nothing |
| `feature: 'quickened'` | A Sorcerer casts two attack spells this turn. | nothing |
| `blocked` with `by: 'entropic-ward'` or `'cloak-of-shadows'` | A Great Old One Warlock's or a Shadow Monk's first-blow ward. | the Aegis's gold ring |

- Hero tokens carry their Class (`Combatant.class`), so a Warlock's beams, a Druid's claws (a weapon hit while it is a beast) and a Bard's mockery can look their own way too, as a Cleric's spells come down as light and a Wizard's fly as bolts.
- Nothing outside `apps/web/src/components/fight/` changes. Fake fights for each event belong on `/sandbox`; `apps/api/scripts/fight-fixtures.ts` builds real ones if that helps.

## Done when

- Each row above has its own short effect that reads at phone width and doesn't hold up the fight's pace.
- The pull request shows each one on `/sandbox` (a short clip or stills) and passes the web tests.
