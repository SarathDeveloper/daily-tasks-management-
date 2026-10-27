/**
 * Installs the built APK on a connected Android device.
 *
 * Finds `adb` on PATH first, then in the standard SDK locations, so the command
 * works without Android Studio or a configured PATH.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const apkCandidates = [
  join(repoRoot, 'android/app/build/outputs/apk/release/app-release.apk'),
  join(repoRoot, 'android/app/build/outputs/apk/debug/app-debug.apk'),
];

const apk = apkCandidates.find((candidate) => existsSync(candidate));
if (!apk) {
  console.error('No APK found. Run "npm run apk:release" first.');
  process.exit(1);
}

const adbCandidates = [
  'adb',
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe'),
  process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools/adb.exe'),
  process.env.ANDROID_SDK_ROOT && join(process.env.ANDROID_SDK_ROOT, 'platform-tools/adb.exe'),
].filter(Boolean);

function runAdb(args) {
  let lastError;
  for (const candidate of adbCandidates) {
    const result = spawnSync(candidate, args, { stdio: 'inherit', shell: false });
    if (!result.error) return result.status ?? 0;
    lastError = result.error;
  }
  console.error('Could not run adb. Install Android platform-tools or add it to PATH.');
  if (lastError) console.error(lastError.message);
  return 1;
}

console.log(`Installing ${apk}`);
const status = runAdb(['install', '-r', apk]);
if (status === 0) {
  console.log('\nInstalled. Launch it from the app drawer ("Daily Tasks").');
} else {
  console.error('\nInstall failed. Check that the phone is connected and USB debugging is on.');
}
process.exit(status);
