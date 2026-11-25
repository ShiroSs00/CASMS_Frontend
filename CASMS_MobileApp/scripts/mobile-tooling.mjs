import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
export const require = createRequire(import.meta.url);
export function mobilePort(value = '8081') {
  if (!/^\d+$/.test(String(value)) || +value < 1024 || +value > 65535) throw new Error('CASMS_METRO_PORT must be an integer from1024 to65535.');
  return +value;
}
export function sdkPath(env = process.env) {
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || (env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (!sdk || !existsSync(join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'))) throw new Error('Android SDK/ADB not found. Set shell-local ANDROID_HOME to the existing SDK.');
  return resolve(sdk);
}
export function checkedToolchain(env = process.env) {
  const sdk = sdkPath(env), java = env.JAVA_HOME && join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!java || !existsSync(java)) throw new Error('Set shell-local JAVA_HOME to an existing compatible JDK; this script does not install Java.');
  return { sdk, java, env: { ...env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, PATH: [join(sdk,'platform-tools'),join(env.JAVA_HOME,'bin'),env.PATH].join(process.platform === 'win32' ? ';' : ':') } };
}
export function expoCli() {
  if (!existsSync(join(appRoot,'package-lock.json'))) throw new Error('Mobile lockfile not found.');
  try { return require.resolve('expo/bin/cli'); } catch { throw new Error('Expo dependencies missing. Run npm ci in CASMS_MobileApp.'); }
}
export async function assertFreePort(port) {
  await new Promise((resolveFree,reject) => {
    const server=net.createServer();
    server.once('error',()=>reject(new Error(`Port${port} is unavailable. Stop its owner or choose CASMS_METRO_PORT; no process was killed.`)));
    server.listen({port,host:'0.0.0.0',exclusive:true},()=>server.close(resolveFree));
  });
}
export function requiredAndroidPackages() {
  const versions=readFileSync(join(appRoot,'node_modules/react-native/gradle/libs.versions.toml'),'utf8');
  const get=key=>{const value=versions.match(new RegExp(`^${key} = "([^"]+)"`,'m'))?.[1]; if(!value) throw new Error(`Cannot read React Native ${key}.`); return value;};
  return {buildTools:get('buildTools'),ndk:get('ndkVersion'),compileSdk:get('compileSdk')};
}
export function validDevId(id) {
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(id ?? '') || !id.endsWith('.dev')) throw new Error('Set CASMS_ANDROID_PACKAGE to an approved reverse-domain development ID ending in .dev.');
  return id;
}
