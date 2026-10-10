// Opens the Android project in Android Studio: `npm run open -w @dark/android`.
// Like `cap open android`, but also finds a Studio installed on another drive
// (or set CAPACITOR_ANDROID_STUDIO_PATH to its studio64.exe / studio.sh).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../android', import.meta.url));
const candidates = [
  process.env.CAPACITOR_ANDROID_STUDIO_PATH,
  ...['C', 'D', 'E'].map((drive) => `${drive}:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe`),
  '/Applications/Android Studio.app/Contents/MacOS/studio',
  '/opt/android-studio/bin/studio.sh',
].filter(Boolean);
const studio = candidates.find((p) => fs.existsSync(p));
if (!studio) {
  console.error(`Android Studio not found. Open ${project} from Studio (File → Open), or set CAPACITOR_ANDROID_STUDIO_PATH.`);
  process.exit(1);
}
spawn(studio, [project], { detached: true, stdio: 'ignore' }).unref();
console.log(`Opening ${project} in ${studio}`);
