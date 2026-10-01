export const en = {
  legend: 'Map legend', here: 'Your Hero', unknown: 'Unexplored Room', free: 'No Stamina',
  open: 'Open Door', locked: 'Locked Door', cracked: 'Cracked wall', secret: 'Secret Door', twin: 'Twin door',
  mini: 'Open the Floor map', exits: 'Doors from here', preview: 'Floor maps',
  fresh: 'First steps', half: 'A winding route', full: 'Almost charted', lair: 'The Dragon’s lair',
  walk: 'Walk', portal: 'Use a Waypoint', reveal: 'Reveal the path', reset: 'Reset',
  cleared: 'Cleared Room', revealed: 'Revealed, not visited',
} as const;
export type MapTextKey = keyof typeof en;
