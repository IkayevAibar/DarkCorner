import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LocalizedText } from '@dark/shared';
import { useI18n } from '../../../i18n';
import { useText } from '../../../components/items/text';
import { useReducedMotion } from '../../../components/loot/motion';
import { OathScene, type SettledOath, type TrustPair } from './OathScene';
import { useTrustCopy } from './copy';

export function OathReveal({ result, hero, partner, notices, onDone }: TrustPair & { result: SettledOath; notices: LocalizedText[]; onDone: () => void }) {
  const { t } = useI18n(), text = useText(), copy = useTrustCopy(), reduced = useReducedMotion();
  const [ready, setReady] = useState(reduced), button = useRef<HTMLButtonElement>(null), done = useRef(onDone);
  done.current = onDone;
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 1800); return () => clearTimeout(timer); }, [reduced]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    button.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Tab') { event.preventDefault(); button.current?.focus(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (ready) done.current(); else setReady(true); }
    };
    window.addEventListener('keydown', key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); };
  }, [ready]);
  return createPortal(<div className="oath-reveal-dialog" role="dialog" aria-modal="true" aria-label={t('room.oathstone')}>
    <section><header>{t('room.oathstone')}</header><OathScene hero={hero} partner={partner} result={result} revealed={ready} />
      <div className="oath-reveal-notices" aria-live="polite">{ready && notices.map((notice, i) => <p key={i}>{text(notice)}</p>)}</div>
      <button ref={button} className="btn btn-primary" type="button" aria-disabled={!ready} onClick={() => { if (ready) onDone(); }}>{ready ? copy.continue : copy.resolving}</button>
    </section>
  </div>, document.body);
}
