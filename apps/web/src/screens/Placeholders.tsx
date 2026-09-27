import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';

function Soon({ text }: { text: MessageKey }) {
  const { t } = useI18n();
  return (
    <div className="panel p-4">
      <p className="m-0 text-muted italic">{t(text)}</p>
    </div>
  );
}

export function City() {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <div className="mx-1 overflow-hidden rounded-sm border border-[#6e5530] bg-black shadow-[0_0_0_1px_#000,0_14px_34px_rgb(0_0_0/0.7)]">
        <img src="/art/city-map.jpg" alt={t('tab.city')} className="block h-auto w-full" draggable={false} />
      </div>
      <Soon text="city.soon" />
    </div>
  );
}

export const Labyrinth = () => <Soon text="labyrinth.soon" />;
export const Loot = () => <Soon text="loot.soon" />;
