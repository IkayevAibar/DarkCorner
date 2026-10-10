import { App } from '@capacitor/app';

/**
 * The Android app (the solo build inside Capacitor). Left alone, Android closes
 * the game on any press of the phone's back button. Here it closes what is open
 * the way Escape does (a sheet, an Item card, the fight's log, the fight), then
 * walks back through the screens, and from the first one puts the game away.
 */
export function startNative(): void {
  void App.addListener('backButton', ({ canGoBack }) => {
    // The topmost dialog is the last one on the page, as CenterModal counts them.
    const top = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);
    if (top) {
      // Sheets and cards hear Escape on the window; the fight hears it on its own panel,
      // so it starts inside the dialog even when a tap has taken the focus away.
      const focused = document.activeElement;
      const target = focused instanceof HTMLElement && top.contains(focused) ? focused : top;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      return;
    }
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}
