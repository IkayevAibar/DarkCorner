import { useInsertionEffect } from 'react';
import css from './items.css?inline';

let users = 0, style: HTMLStyleElement | null = null;
/** One stylesheet for a Bag full of tiles; loaded only when Item UI mounts. */
export function useItemStyles() {
  useInsertionEffect(() => {
    if (users++ === 0) { style = document.createElement('style'); style.dataset.itemStyles = ''; style.textContent = css; document.head.append(style); }
    return () => { if (--users === 0) { style?.remove(); style = null; } };
  }, []);
}
