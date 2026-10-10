// Runs the Android project's Gradle wrapper on any system: `node scripts/gradle.mjs assembleDebug`.
// Always the wrapper, never a Gradle on PATH: the wrapper pins the version the project needs.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../android', import.meta.url));
const wrapper = path.join(cwd, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const result = spawnSync(wrapper, process.argv.slice(2), { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
