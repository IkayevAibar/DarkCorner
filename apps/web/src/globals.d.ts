/**
 * True in the solo build (`vite --mode solo`): api.ts asks the local backend in
 * src/solo.ts instead of the server. Set in vite.config.ts.
 */
declare const __SOLO__: boolean;

/** The app's version, apps/android/package.json's (vite.config.ts): shown in the solo build's Account. */
declare const __APP_VERSION__: string;
