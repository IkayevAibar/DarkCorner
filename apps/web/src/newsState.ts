/** Kept separate so the navigation's unread dot does not load every patch note. */
export const LATEST_NEWS_ID = '2026-10-07-routes';
const SEEN_KEY = 'dc.news.seen';

export function newsUnread(): boolean {
  try { return localStorage.getItem(SEEN_KEY) !== LATEST_NEWS_ID; }
  catch { return false; }
}

export function markNewsRead(): void {
  try { localStorage.setItem(SEEN_KEY, LATEST_NEWS_ID); }
  catch { /* Private windows can refuse storage; the dot just stays. */ }
}
