import type { CSSProperties } from 'react';

/**
 * A Room's battle map. Each theme has only a handful, so every Room turns and
 * mirrors its map its own way (docs/design.md → Room art): eight looks from one
 * picture, and the same Room always looks the same, in the Room and in its fights.
 * Maps are square, which is what lets them turn.
 */
export function roomArt(map: string, at?: { floor: number; room: number }): { src: string; style: CSSProperties | undefined } {
  const src = `/art/rooms/${map}.jpg`;
  if (!at) return { src, style: undefined };
  const turn = Math.abs(Math.imul(at.floor * 131 + at.room, 0x9e3779b1) >> 16) % 8;
  return { src, style: { transform: `rotate(${(turn % 4) * 90}deg)${turn >= 4 ? ' scaleX(-1)' : ''}` } };
}
