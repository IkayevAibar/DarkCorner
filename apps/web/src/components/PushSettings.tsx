import { useEffect, useState } from 'react';
import type { PushKind, PushView } from '@dark/shared';
import { api } from '../api';
import { useI18n } from '../i18n';
import { isIos, isStandalone } from '../install';
import { type DevicePush, devicePush, syncPush, testPush, turnPushOff, turnPushOn } from '../push';

/** Every kind, in the order the sheet lists them; a Record so a new kind can't be missed. Types only from shared: its values bring zod along. */
const ORDER: Record<PushKind, number> = { stamina: 0, camp: 1, market: 2, gate: 3 };
const KINDS = (Object.keys(ORDER) as PushKind[]).sort((a, b) => ORDER[a] - ORDER[b]);

/** Push notifications for this device, and which kinds of news the Player wants. */
export function PushSettings() {
  const { t, locale } = useI18n();
  const [device, setDevice] = useState<DevicePush | null>(null);
  const [view, setView] = useState<PushView | null>(null);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const state = await devicePush();
      if (!live) return;
      setDevice(state);
      if (state === 'unsupported' || state === 'blocked') return;
      const shared = state === 'on' ? await syncPush(locale).catch(() => null) : null;
      const fresh = shared ?? (await api.push().catch(() => null));
      if (live) setView(fresh);
    })();
    return () => {
      live = false;
    };
  }, [locale]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await work();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const on = () =>
    run(async () => {
      const key = view?.key ?? (await api.push()).key;
      const result = await turnPushOn(key, locale);
      if (result === 'blocked') setDevice('blocked');
      else {
        setView(result);
        setDevice('on');
      }
    });
  const off = () =>
    run(async () => {
      const result = await turnPushOff();
      if (result) setView(result);
      setDevice('off');
      setTested(null);
    });
  const toggle = (kind: PushKind) =>
    run(async () => {
      const current = view?.off ?? [];
      setView(await api.pushPrefs(current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]));
    });
  const test = () =>
    run(async () => {
      setTested(await testPush());
    });

  if (device === null) return null;
  return (
    <div className="grid gap-2">
      <span className="sub-heading">{t('push.title')}</span>
      {device === 'unsupported' ? (
        <p className="m-0 text-sm text-muted">{isIos && !isStandalone() ? t('push.ios') : t('push.unsupported')}</p>
      ) : device === 'blocked' ? (
        <p className="m-0 text-sm text-muted">{t('push.blocked')}</p>
      ) : (
        <>
          <div className="flex gap-2">
            {([true, false] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                className={`btn btn-small ${value === (device === 'on') ? 'btn-primary' : ''}`}
                disabled={busy}
                onClick={() => void (value ? on() : off())}
              >
                {value ? t('account.on') : t('account.off')}
              </button>
            ))}
          </div>
          {device === 'on' && view && (
            <div className="grid gap-1.5">
              {KINDS.map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!view.off.includes(kind)} disabled={busy} onChange={() => void toggle(kind)} />
                  {t(`push.kind.${kind}`)}
                </label>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" className="btn btn-small" disabled={busy} onClick={() => void test()}>{t('push.test')}</button>
                {tested === true && <span className="text-sm text-muted">{t('push.testSent')}</span>}
                {tested === false && <span className="text-sm text-[#ff9a8a]">{t('push.testFailed')}</span>}
              </div>
            </div>
          )}
          <p className="m-0 text-xs text-muted">{device === 'on' ? t('push.quiet') : t('push.why')}</p>
        </>
      )}
      {failed && <p className="m-0 text-sm text-[#ff9a8a]">{t('push.failed')}</p>}
    </div>
  );
}
