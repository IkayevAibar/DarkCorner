// Makes the upload key that signs the app for Google Play, once: `npm run key -w @dark/android`.
// It goes outside the repo, to ~/.dark-corner (or the folder of DARK_KEYSTORE_PROPERTIES):
//   upload.jks           the key
//   keystore.properties  where the key is and its password, for release builds (app/build.gradle)
// The password is random and written only there, so back up the folder whole. Google Play
// keeps the key that signs the app on phones (Play App Signing); a lost upload key can be
// reset through Play Console, but that takes days.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const props = process.env.DARK_KEYSTORE_PROPERTIES ?? path.join(os.homedir(), '.dark-corner', 'keystore.properties');
const dir = path.dirname(props);
const store = path.join(dir, 'upload.jks');
if (fs.existsSync(props) || fs.existsSync(store)) {
  console.error(`There is an upload key in ${dir} already. Remove it only if it has never signed an upload.`);
  process.exit(1);
}
// The JDK's keytool: JAVA_HOME's, as the Gradle build uses, else the one on PATH.
const keytool = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool')
  : 'keytool';
const password = crypto.randomBytes(24).toString('base64url');
fs.mkdirSync(dir, { recursive: true });
execFileSync(keytool, [
  '-genkeypair', '-keystore', store, '-storetype', 'PKCS12', '-alias', 'upload',
  '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', 'CN=Dark Corner',
  '-storepass:env', 'DARK_KEY_PASSWORD', '-keypass:env', 'DARK_KEY_PASSWORD',
], { stdio: 'inherit', env: { ...process.env, DARK_KEY_PASSWORD: password } });
fs.writeFileSync(props, [
  '# The upload key for Dark Corner on Google Play (apps/android/scripts/key.mjs).',
  '# Keep this folder out of every repo, and back it up whole: the password is only here.',
  'storeFile=upload.jks',
  `storePassword=${password}`,
  'keyAlias=upload',
  `keyPassword=${password}`,
  '',
].join('\n'), { mode: 0o600 });
console.log(`The upload key is in ${dir}. Back up that folder, both files, somewhere safe.`);
