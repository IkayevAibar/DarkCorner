import type { Edge } from '../dice.js';

export const STANCES = ['bold', 'steady', 'wary'] as const;
export type StanceId = (typeof STANCES)[number];

export interface StanceDef {
  id: StanceId;
  /** The Hero's attack rolls. */
  attackEdge: Edge;
  /** Monsters' attack rolls against the Hero. */
  defendEdge: Edge;
  ac: number;
  toHit: number;
  /** Below this share of its max health the Hero makes Escape rolls instead of attacking (0: never). */
  escapeBelow: number;
}

/**
 * How a Hero fights (docs/design.md → Dice and fights, v0). The Player sets it
 * before a fight: the one lever on a fight that otherwise plays itself. Names
 * and descriptions for the screen live in the web's i18n (stance.*).
 */
export const STANCE_DEFS: Record<StanceId, StanceDef> = {
  /** Hit harder, get hit harder, never run. */
  bold: { id: 'bold', attackEdge: 'advantage', defendEdge: 'advantage', ac: 0, toHit: 0, escapeBelow: 0 },
  steady: { id: 'steady', attackEdge: 'normal', defendEdge: 'normal', ac: 0, toHit: 0, escapeBelow: 0.2 },
  wary: { id: 'wary', attackEdge: 'normal', defendEdge: 'normal', ac: 2, toHit: -2, escapeBelow: 0.5 },
};

export const DEFAULT_STANCE: StanceId = 'steady';
