// Every player-facing string lives here and in ru.ts, under the same keys.
export const en = {
  brand: 'Dark Corner',
  tagline: 'A dark labyrinth, one season at a time.',
  loading: 'Lighting the torches…',
  error: 'Something went wrong. Try again in a moment.',
  retry: 'Try again',
  close: 'Close',

  'tab.city': 'City',
  'tab.labyrinth': 'Labyrinth',
  'tab.loot': 'Loot',
  'tab.heroes': 'Heroes',

  'signin.title': 'Enter Dark Corner',
  'signin.sso': 'Sign in with Discord',
  'signin.devTitle': 'Local dev login',
  'signin.devHint': 'Only on your own computer: sign in as anyone, no Discord needed.',
  'signin.devName': 'Name',
  'signin.devAdmin': 'Make this player an admin',
  'signin.devSubmit': 'Sign in',

  'pending.title': 'Waiting at the gate',
  'pending.body': 'An admin has to let you in before you can create a hero. Ask in your Discord.',
  'banned.title': 'The gate is shut',
  'banned.body': 'An admin has closed the gate for this account.',
  signOut: 'Sign out',

  'account.title': 'Account',
  'account.language': 'Language',
  'account.admin': 'Admin: players',

  'city.soon': 'The Tavern, Shops, Forge, Market and Temple open here soon.',
  'labyrinth.soon': 'Ten floors down, the ancient Dragon waits. The Labyrinth opens in week 3.',
  'loot.soon': 'Chests, identifying and the Forge arrive in week 4.',
  'heroes.soon': 'Hero creation arrives in week 2.',

  'admin.title': 'Players',
  'admin.empty': 'No players yet.',
  'admin.approve': 'Approve',
  'admin.ban': 'Ban',
  'admin.reset': 'Reset',
  'admin.you': 'you',
  'status.pending': 'Pending',
  'status.approved': 'Approved',
  'status.banned': 'Banned',

  'sandbox.title': 'Sandbox',
  'sandbox.body': 'Visual components built with fake data (Codex works here).',
};

export type MessageKey = keyof typeof en;
