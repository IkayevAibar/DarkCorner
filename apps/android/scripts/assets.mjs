// Makes the Android launcher icons and splash screens from the web app's icons
// (apps/web/public/icons), so the app wears the same dragon. Needs ffmpeg on PATH.
//   node scripts/assets.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const icons = path.resolve(here, '../../web/public/icons');
const res = path.resolve(here, '../android/app/src/main/res');
const any = path.join(icons, 'icon-512.png');
const maskable = path.join(icons, 'icon-maskable-512.png');
/** The icons' own background, and the game's theme color. */
const BACKGROUND = '0b0a09';

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const scaled = (input, size, output) => ffmpeg('-i', input, '-vf', `scale=${size}:${size}:flags=lanczos`, output);

// Launcher icons: 48 dp before Android 8; after it, an adaptive icon's 108 dp foreground on a plain background.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(DENSITIES)) {
  const dir = path.join(res, `mipmap-${density}`);
  scaled(any, 48 * scale, path.join(dir, 'ic_launcher.png'));
  scaled(any, 48 * scale, path.join(dir, 'ic_launcher_round.png'));
  scaled(maskable, 108 * scale, path.join(dir, 'ic_launcher_foreground.png'));
}
fs.writeFileSync(
  path.join(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#${BACKGROUND.toUpperCase()}</color>\n</resources>\n`,
);

// Splash screens: the dragon in the middle of the dark, at every size the template ships.
for (const dir of fs.readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const file = path.join(res, dir, 'splash.png');
  if (!fs.existsSync(file)) continue;
  const [width, height] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file])
    .toString().trim().split(',').map(Number);
  const size = Math.round(Math.min(width, height) * 0.45);
  ffmpeg(
    '-f', 'lavfi', '-i', `color=c=0x${BACKGROUND}:s=${width}x${height}`, '-i', maskable,
    '-filter_complex', `[1]scale=${size}:${size}:flags=lanczos[icon];[0][icon]overlay=(W-w)/2:(H-h)/2`, '-frames:v', '1', file,
  );
}
console.log('icons and splash screens written');
