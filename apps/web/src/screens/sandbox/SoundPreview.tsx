import { TIERS, type LocalizedText } from '@dark/shared';
import { FILES, type Sound } from '../../audio/catalog';
import { buzz, play, playTier, useSoundSetting } from '../../sound';
import { useI18n } from '../../i18n';

const LABELS: Record<Sound, LocalizedText> = {
  door: { en: 'Door', ru: 'Дверь' }, creak: { en: 'Creak', ru: 'Скрип' },
  step: { en: 'Footstep', ru: 'Шаг' }, draw: { en: 'Draw weapon', ru: 'Оружие из ножен' },
  hit: { en: 'Hit', ru: 'Удар' }, miss: { en: 'Miss', ru: 'Промах' }, crit: { en: 'Critical hit', ru: 'Критический удар' },
  grave: { en: 'Death / destroyed Item', ru: 'Гибель / разрушение предмета' },
  anvil: { en: 'Forge strike', ru: 'Удар в кузнице' }, die: { en: 'd20', ru: 'd20' },
  dice: { en: 'Ability dice', ru: 'Кости характеристик' }, shake: { en: 'Goblin’s dice', ru: 'Кости гоблина' },
  coins: { en: 'Gold / victory', ru: 'Золото / победа' }, chips: { en: 'Upgrade', ru: 'Улучшение' },
  loot: { en: 'Loot', ru: 'Добыча' }, latch: { en: 'Chest latch', ru: 'Замок сундука' },
  tick: { en: 'Spin tick', ru: 'Щелчок вращения' }, reveal: { en: 'Reveal', ru: 'Раскрытие' },
  page: { en: 'Scroll', ru: 'Свиток' }, equip: { en: 'Equip', ru: 'Снаряжение' },
};

export function SoundPreview() {
  const { locale, t } = useI18n(), [on, setOn] = useSoundSetting();
  const title = locale === 'ru' ? 'Звуки Лабиринта' : 'Sounds of the Labyrinth';
  return <section className="panel grid gap-3 p-4" data-sound-preview aria-label={title}>
    <h2 className="sub-heading m-0">{title}</h2>
    <p className="m-0 text-sm text-muted">{locale === 'ru'
      ? 'Нажмите на звук или ранг. Общий переключатель останавливает звуки и вибрацию во всей игре.'
      : 'Tap a sound or Tier. The shared switch stops sound and vibration throughout the game.'}</p>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{t('account.sound')}</span>
      {([true, false] as const).map(value => <button key={String(value)} type="button"
        className={`btn btn-small ${on === value ? 'btn-primary' : ''}`} aria-pressed={on === value}
        data-sound-setting={String(value)} onClick={() => setOn(value)}>{t(value ? 'account.on' : 'account.off')}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(FILES) as Sound[]).map(sound => <button key={sound} type="button" className="btn btn-small"
        style={{ minHeight: 44 }} data-sound={sound} onClick={() => play(sound)}>{LABELS[sound][locale]}</button>)}
    </div>
    <div className="flex flex-wrap gap-2">
      {TIERS.map(tier => <button key={tier} type="button" className="btn btn-small"
        style={{ minHeight: 44, color: `var(--color-tier-${tier})` }} data-sound-tier={tier}
        onClick={() => playTier(tier)}>{t(`tier.${tier}`)}</button>)}
      <button type="button" className="btn btn-small" style={{ minHeight: 44 }} data-sound-natural
        onClick={() => { play('die'); play('crit', { delay: 150 }); buzz(60); }}>
        {locale === 'ru' ? 'Натуральная 20' : 'Natural 20'}
      </button>
    </div>
  </section>;
}
