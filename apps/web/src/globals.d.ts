/**
 * True in the solo build (`vite --mode solo`): api.ts asks the local backend in
 * src/solo.ts instead of the server. Set in vite.config.ts.
 */
declare const __SOLO__: boolean;
