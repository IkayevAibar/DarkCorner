const PATHS = {
  city: 'M3 21h18M5 21V10l3-2.5 3 2.5v11M13 21V6.5l3-3 3 3V21M8 13v.01M16 10v.01M16 14v.01',
  labyrinth: 'M4 3.5 15 14.5M20 3.5 9 14.5M13 17l4 4 2-2-4-4M11 17l-4 4-2-2 4-4',
  loot: 'M3 11c0-4 4-6.5 9-6.5s9 2.5 9 6.5v9H3zM3 11h18M10.5 11v3.5h3V11',
  heroes: 'M5 20.5c0-4 3.1-7 7-7s7 3 7 7M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  close: 'M6 6l12 12M18 6 6 18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  news: 'M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7M8 4a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2h3M8 4a2 2 0 0 1 2 2M10 9h6M10 13h6M10 17h4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'size-6' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
