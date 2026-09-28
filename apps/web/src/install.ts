import { useEffect, useState } from 'react';

/**
 * Putting the game on the home screen. Chrome and Edge (Android, desktop) offer
 * their own install prompt, which a button can open; Safari on an iPhone has none,
 * so the Player is shown the taps instead.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

// Listened for as the app loads: the browser offers the prompt once, early.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

/** Already opened from the home screen. */
export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const agent = navigator.userAgent;
/** iPads report themselves as Macs, with a touch screen. */
export const isIos = /iphone|ipad|ipod/i.test(agent) || (/macintosh/i.test(agent) && navigator.maxTouchPoints > 1);
export const isPhone = isIos || /android/i.test(agent);

export function useInstall() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return {
    installed: isStandalone(),
    /** The browser's own install prompt is ready to open. */
    canPrompt: deferred !== null,
    async prompt(): Promise<boolean> {
      if (!deferred) return false;
      const event = deferred;
      await event.prompt();
      const { outcome } = await event.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}
