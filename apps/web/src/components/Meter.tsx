const FILLS = {
  health: 'linear-gradient(90deg, #7a1d1d, #d23a2a)',
  stamina: 'linear-gradient(90deg, #6d5a2a, #e2b23a)',
  loyalty: 'linear-gradient(90deg, #2c4a7e, #6f9be0)',
} as const;

export function Meter({ label, value, max, kind }: { label: string; value: number; max: number; kind: keyof typeof FILLS }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5 text-xs">
      <span className="text-muted">{label}</span>
      <span className="h-2 overflow-hidden rounded bg-black/35">
        <span className="block h-full transition-[width] duration-300" style={{ width: `${percent}%`, background: FILLS[kind] }} />
      </span>
      <span className="font-head text-[13px] font-extrabold">
        {value}/{max}
      </span>
    </div>
  );
}
