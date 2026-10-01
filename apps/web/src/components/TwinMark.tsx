/** Two carved halves with a keystone between them. Shared by Doors, Bond rings and the Feed. */
export const TWIN_MARK = 'M10 2C-1 4-1 20 10 22V18C4 16 4 8 10 6V2ZM14 2V6C20 8 20 16 14 18V22C25 20 25 4 14 2ZM12 9L15 12 12 15 9 12Z';

export function TwinMark() {
  return <path d={TWIN_MARK} fill="currentColor" stroke="none" />;
}
