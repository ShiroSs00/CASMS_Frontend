import { mkdirSync, cpSync, writeFileSync, readFileSync, symlinkSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appRoot, checkedToolchain, expoCli, requiredAndroidPackages, validDevId } from './mobile-tooling.mjs';

if(process.argv.length>2) throw new Error('Usage: build-mobile-dev-android.bat; configure shell-local CASMS_ANDROID_PACKAGE. This command builds only, never installs.');
const tools=checkedToolchain(), required=requiredAndroidPackages(), id=validDevId(process.env.CASMS_ANDROID_PACKAGE);
for(const [label,path] of [['Build Tools',join(tools.sdk,'build-tools',required.buildTools)],['NDK',join(tools.sdk,'ndk',required.ndk)]]) if(!existsSync(path)) throw new Error(`${label} missing: ${path}. Install only with user approval.`);
// AGP 9.2.1's default was confirmed by CXX1300 in the SDK 58 native build.
if(!existsSync(join(tools.sdk,'cmake','3.22.1','bin',process.platform==='win32'?'cmake.exe':'cmake'))) throw new Error('CMake 3.22.1 is missing from the Android SDK. Install the required SDK component only with user approval.');
// AGP rejects non-ASCII project paths on Windows. Keep generated projects in
// an ASCII temporary directory; dependencies and Gradle cache stay isolated.
const stageRoot=resolve(process.env.CASMS_NATIVE_STAGE_ROOT || join(tmpdir(),'casms-native'));
if(process.platform==='win32' && /[^\x00-\x7f]/.test(stageRoot)) throw new Error('Set CASMS_NATIVE_STAGE_ROOT to an ASCII temporary directory for Android Gradle Plugin.');
const stage=join(stageRoot,`android-${Date.now()}`); mkdirSync(stage,{recursive:true});
// A fresh isolated project, never prebuild --clean in the source workspace.
for(const name of ['package.json','package-lock.json','app.json','src','assets','plugins','tsconfig.json','babel.config.js','metro.config.js']) if(existsSync(join(appRoot,name))) cpSync(join(appRoot,name),join(stage,name),{recursive:true});
symlinkSync(join(appRoot,'node_modules'),join(stage,'node_modules'),process.platform==='win32'?'junction':'dir');
const config=JSON.parse(readFileSync(join(stage,'app.json'),'utf8'));
config.expo.android={...config.expo.android,package:id};
config.expo.name+=' Dev';
writeFileSync(join(stage,'app.json'),JSON.stringify(config,null,2)+'\n');
const env={...tools.env,EXPO_NO_DOTENV:'1',EXPO_NO_TELEMETRY:'1',CI:'1',GRADLE_USER_HOME:join(appRoot,'.native-build','gradle-cache')};
delete env.EXPO_PUBLIC_API_URL; // debug launcher reads the explicitly configured Metro bundle later
function run(command,args,options={}) {
  const result=spawnSync(command,args,{cwd:stage,env,stdio:'inherit',windowsHide:true,...options});
  if(result.error||result.status!==0) throw new Error(`Build step failed (exit${result.status}): ${result.error?.message??command}. Stage retained: ${stage}`);
}
console.log(`Isolated stage: ${stage}; debug-only package ${id}; no APK installation or cloud upload.`);
writeFileSync(join(stage,'source-baseline.json'),JSON.stringify({packageHash:createHash('sha256').update(readFileSync(join(appRoot,'package-lock.json'))).digest('hex'),id,required},null,2));
run(process.execPath,['--require',join(appRoot,'scripts','windows-expo-glob.cjs'),expoCli(),'prebuild','--platform','android','--no-install'],{env:{...env,CASMS_EXPO_WINDOWS_GLOB_COMPAT:'1'}});
run(process.platform==='win32'?'cmd.exe':'sh',process.platform==='win32'?['/d','/c','gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64 -Pandroid.builder.sdkDownload=false -Porg.gradle.java.installations.auto-download=false --max-workers=2 --no-daemon']:['gradlew','assembleDebug','-PreactNativeArchitectures=x86_64','-Pandroid.builder.sdkDownload=false','-Porg.gradle.java.installations.auto-download=false','--max-workers=2','--no-daemon'],{cwd:join(stage,'android')});
const apk=join(stage,'android','app','build','outputs','apk','debug','app-debug.apk');
if(!existsSync(apk)) throw new Error('Gradle ended without the expected debug APK.');
const hash=createHash('sha256'); for await(const chunk of createReadStream(apk)) hash.update(chunk);
const result={status:'NATIVE_BUILD_PASSED',profile:'debug development client x86_64',id,apk,bytes:statSync(apk).size,sha256:hash.digest('hex'),stage};
writeFileSync(join(appRoot,'.native-build','latest-apk.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
