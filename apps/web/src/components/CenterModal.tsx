import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';

/**
 * A card in the middle of the screen over a dimmed page: how the Labyrinth shows
 * what needs the Player (monsters, events, reports, the Map, the belt). It sits
 * above the tab bar and below bottom sheets and the fight playback, so an Item
 * tapped inside it still opens its sheet on top. The head shares its row with the
 * close button, so nothing runs under it.
 */
export function CenterModal({ label, head, onClose, closeLabel, children, width = 380 }: {
  label: string;
  head: ReactNode;
  /** Without it the card can't be put aside, only answered. */
  onClose?: () => void;
  closeLabel?: string;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onClose) return;
    // Escape closes only what is on top: a sheet or a later card over this one goes first.
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (e.key === 'Escape' && dialogs[dialogs.length - 1] === ref.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      className="fixed inset-0 z-[35] grid place-items-center overflow-y-auto overscroll-contain bg-[rgb(5_4_3/0.72)] p-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel anim-pop grid w-full gap-3.5 p-4" style={{ maxWidth: width }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 self-center">{head}</div>
          {onClose && (
            <button
              type="button"
              aria-label={closeLabel ?? t('close')}
              title={closeLabel ?? t('close')}
              className="-mt-1.5 -mr-1.5 grid size-11 shrink-0 place-items-center rounded-[2px] border border-brass-dim bg-panel-2 p-0 text-bone"
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
