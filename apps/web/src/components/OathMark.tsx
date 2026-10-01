/** The same two palms are cut into the Room, the Map and the oath's seal. */
export const PALM = 'M6 22 3 17 1 12q-1-3 1-3l4 4V4q0-3 2-3t2 3v6-8q0-3 2-3t2 3v8-7q0-3 2-3t2 3v8-5q0-3 2-3t2 3v9l-3 8Z';
export const FIST = 'M6 22 2 15V9q0-2 2-2h2V5q0-3 3-3h9q4 0 4 4v10l-4 6ZM6 7v7h11M10 3v7m5-7v7m5-6v6';
export function OathMark() {
  return <><path d="M3 22V7L7 2h10l4 5v15ZM1 23h22" /><g transform="translate(4 8) scale(.29)"><path d={PALM} /></g><g transform="translate(13 8) scale(.29)"><path d={PALM} /></g></>;
}
