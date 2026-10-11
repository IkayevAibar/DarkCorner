// Builds the solo game for Google Play as a signed Android App Bundle: `npm run aab -w @dark/android`.
// It needs the upload key (`npm run key -w @dark/android`), and a version Play hasn't had:
// raise "version" in apps/android/package.json before each upload (app/build.gradle reads it).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const props = process.env.DARK_KEYSTORE_PROPERTIES ?? path.join(os.homedir(), '.dark-corner', 'keystore.properties');
if (!fs.existsSync(props)) {
  console.error(`No upload key at ${props}. Make it once with \`npm run key -w @dark/android\`.`);
  process.exit(1);
}
const project = fileURLToPath(new URL('..', import.meta.url));
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: project, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run('npm', ['run', 'sync']);
run('node', ['scripts/gradle.mjs', 'bundleRelease']);
const { version } = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
console.log(`\nDark Corner ${version}: ${path.join(project, 'android/app/build/outputs/bundle/release/app-release.aab')}`);
