import type { CSSProperties } from 'react';
import type { ItemView } from '@dark/shared';
import { ICON_VIEWBOX, iconPath } from './icons';
import { TwinMark } from '../TwinMark';
import { useText } from './text';
import { useItemStyles } from './itemStyles';

export function ItemArt({ item }: { item: ItemView }) {
  return <span className="item-art" aria-hidden="true">{item.art
    ? <img src={item.art} alt="" draggable={false}/>
    : <svg viewBox={item.base === 'bond-ring' ? '0 0 24 24' : ICON_VIEWBOX} fill="currentColor">{item.base === 'bond-ring' ? <TwinMark/> : <path d={iconPath(item.icon)}/>}</svg>}
  </span>;
}

/** 62, 76 and 84 px tiles; smaller existing list and flight sizes remain supported. */
export function ItemTile({ item, size = 62, onClick }: { item: ItemView; size?: number; onClick?: () => void }) {
  useItemStyles();
  const text = useText(), known = item.kind !== 'gear' || item.identified;
  const Tag = onClick ? 'button' : 'span';
  return <Tag {...(onClick ? { type: 'button' as const, onClick } : { role: 'img' })} aria-label={text(item.name)}
    className={`item-tile tier-${item.tier}${known ? '' : ' unidentified'}${known && item.radiant ? ' radiant' : ''}`}
    data-item-tile data-item-id={item.id} style={{ width: size, height: size, '--tier': `var(--color-tier-${item.tier})`, '--tile-size': `${size}px` } as CSSProperties}>
    <ItemArt item={item}/>
    {!known && <span className="tile-mystery" aria-hidden="true">?</span>}
    {known && item.upgrade > 0 && <span className="tile-upgrade" aria-hidden="true">+{item.upgrade}</span>}
    {item.kind !== 'gear' && <span className="tile-quantity" aria-hidden="true">×{item.quantity}</span>}
    {known && item.serial && <span className="tile-serial" aria-hidden="true">#{item.serial.number}/{item.serial.of}</span>}
  </Tag>;
}
