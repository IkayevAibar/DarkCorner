import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

interface SheetContent {
  title: string;
  body: ReactNode;
}

interface SheetApi {
  openSheet: (content: SheetContent) => void;
  closeSheet: () => void;
}

const SheetContext = createContext<SheetApi | null>(null);

/**
 * The bottom sheet: buildings, Item cards and account actions slide up from the
 * bottom of the screen, where a thumb can reach them on a phone.
 */
export function SheetProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SheetContent | null>(null);
  const [open, setOpen] = useState(false);

  const openSheet = useCallback((next: SheetContent) => {
    setContent(next);
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const closeSheet = useCallback(() => {
    setOpen(false);
    setTimeout(() => setContent(null), 220);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSheet]);

  return (
    <SheetContext.Provider value={{ openSheet, closeSheet }}>
      {children}
      {content && createPortal(<SheetView content={content} open={open} onClose={closeSheet} />, document.body)}
    </SheetContext.Provider>
  );
}

function SheetView({ content, open, onClose }: { content: SheetContent; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={content.title}>
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`absolute bottom-0 left-1/2 max-h-[88vh] w-full max-w-[560px] -translate-x-1/2 overflow-y-auto rounded-t border-t border-brass bg-sheet px-4 pt-3.5 pb-[calc(22px+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgb(0_0_0/0.6)] transition-transform duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)] ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ backgroundImage: 'var(--noise)' }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="m-0 font-head text-[22px] font-extrabold text-[#e8cf9a]">{content.title}</h2>
          <button type="button" className="chip size-[34px] justify-center p-0" aria-label={t('close')} onClick={onClose}>
            <Icon name="close" className="size-5" />
          </button>
        </div>
        {content.body}
      </div>
    </div>
  );
}

export function useSheet(): SheetApi {
  const value = useContext(SheetContext);
  if (!value) throw new Error('useSheet outside SheetProvider');
  return value;
}
