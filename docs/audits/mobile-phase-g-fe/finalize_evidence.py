from pathlib import Path
import hashlib, json, re, subprocess

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
APP=ROOT/'CASMS_MobileApp'
EV=OUT/'evidence'
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name): return (EV/name).read_text(encoding='utf-8-sig',errors='replace')
def git(*args,cwd=ROOT): return subprocess.check_output(['git',*args],cwd=cwd,encoding='utf-8').strip()

tests=read('tests.txt'); export=read('export.txt'); doctor=read('doctor.txt')
module_counts={}
for label,platform in [('Android','android'),('iOS','ios'),('Web','web'),('λ','renderer')]:
    match=re.search(re.escape(label)+r' Bundled[^\n]*\((\d+) modules\)',export)
    if match: module_counts[platform]=int(match.group(1))
assert re.search(r'tests 198',tests) and re.search(r'pass 198',tests) and re.search(r'fail 0',tests)
assert 'Exported: dist/phase-g' in export and 'Static routes (36)' in export
assert '19/20 checks passed' in doctor
assert 'Found outdated dependencies' in read('dependency-check.txt')
assert not re.search(r'error TS\d+',read('typecheck.txt'))
assert not re.search(r'\b[1-9]\d* (?:errors?|warnings?)\b',read('lint.txt'))
assert git('diff','--check')==''

bundles={}
for phase in ['f','g']:
    base=APP/f'dist/phase-{phase}/_expo/static/js'
    bundles[phase]={}
    for platform in ['android','ios','web']:
        rows=[dict(file=p.relative_to(APP).as_posix(),bytes=p.stat().st_size,sha256=digest(p)) for p in sorted((base/platform).rglob('*')) if p.is_file()]
        bundles[phase][platform]={'files':rows,'total_bytes':sum(r['bytes'] for r in rows)}
assert len(bundles['g']['android']['files'])==1 and len(bundles['g']['ios']['files'])==1
(EV/'bundle-metrics.json').write_text(json.dumps({'measurement':'Filesystem exported artifacts; not runtime memory or startup','phases':bundles},indent=2),encoding='utf-8')
matches=[]
for p in (APP/'dist/phase-g').rglob('*'):
    if p.is_file() and p.suffix in ['.js','.html','.json','.hbc']:
        data=p.read_bytes()
        # Bare port digits also occur in Reanimated worklet hashes (e.g. 9106121518086).
        if re.search(rb'(?:127\.0\.0\.1|localhost|10\.0\.2\.2):1808[56]',data) or b'__ui/emit' in data:
            matches.append(p.relative_to(APP).as_posix())
assert not matches, matches

baseline=json.loads(read('baseline-hashes.json'))
changed=json.loads(read('changed-files.json'))
protected=['pos-api.ts','pos-contracts.ts','pos-lifecycle.ts','pos-scope.ts','pos-storage.ts','pos-transport.ts','PosUsage.tsx','PosLayout.tsx','PosActivities.tsx','PosScanner.tsx','PosCardAction.tsx','nfc-reader.ts','card-reader.ts','session-store.ts','booking-financials.ts','spending-foundation.ts','PassengerSpendingScreen.tsx','PassengerCardScreen.tsx','service-operation-store.ts','notification-queries.ts','NotificationSync.tsx']
confirmed={}
for row in baseline:
    p=Path(row['path'])
    if p.name in protected:
        assert digest(p)==row['sha256'].lower(),str(p)
        confirmed[p.relative_to(ROOT).as_posix()]=True
for row in changed: assert digest(ROOT/row['path'])==row['sha256'],row['path']

be=ROOT.parent/'CASMS_Backend'
be_status=git('status','--short',cwd=be)
assert be_status=='?? qa/',be_status
assert not git('diff','--name-only','--','CASMS_WebAdmin','CASMS_WebBooking')
version={'package_json_sha256':digest(APP/'package.json'),'package_lock_sha256':digest(APP/'package-lock.json'),'app_json_sha256':digest(APP/'app.json'),'note':'G did not mutate these baseline B files; their existing uncommitted changes are preserved.'}
log_hashes={p.name:digest(p) for p in EV.glob('*.txt')}
verification={
 'date':'2026-11-25','timezone':'Asia/Saigon','acceptance':'UI_UX_SOURCE_READY_RUNTIME_QA_BLOCKED',
 'frontend_head':git('rev-parse','HEAD'),'branch':git('branch','--show-current'),'upstream':git('rev-parse','--abbrev-ref','@{upstream}'),
 'backend_head':git('rev-parse','HEAD',cwd=be),'backend_status':be_status,
 'tests':{'baseline':189,'total':198,'pass':198,'fail':0,'skipped':0,'new':9},
 'sse_tests':{'pass':13,'subset_of_full_suite':True,'mode':'FAKE_STREAM_TIMERS_UNIT_CONTROLLER'},
 'typecheck':{'exit_code':0},'lint':{'exit_code':0,'errors':0,'warnings':0},
 'dependency_check':{'exit_code':1,'mismatches':11,'online':True,'changed_in_G':False},
 'doctor':{'exit_code':1,'checks_pass':19,'checks_total':20,'failure':'11 pre-existing version mismatches'},
 'export':{'exit_code':0,'platforms':['android','ios','web'],'static_routes':36,'modules':module_counts,'source_freeze':read('source-freeze.txt').strip(),'initial_export':'FAILED mid-edit new-file map; retained export-initial.txt; --clear rerun passed; final export rerun after POS pane auto-basis change passed'},
 'git_diff_check':{'exit_code':0},'rendered_ui':'RENDERED_UI_BLOCKED','native_sse':'NOT_RUN','real_api':'NOT_RUN','nfc_device':'NOT_RUN','talkback_voiceover':'NOT_RUN','runtime_performance':'NOT_MEASURED',
 'G0':'BLOCKER_IDENTIFIED_HANDOFF_READY_RENDERED_GATE_BLOCKED','G1':'SOURCE_READY_RENDERED_ACCEPTANCE_PENDING','G2':'SOURCE_LOGIC_READY_DEVICE_BENCHMARK_PENDING',
 'screen_inventory':{'route_layout_files':32,'screen_redirect_entries':29,'layouts':3},'reports':15,
 'changed_mobile_source_test_docs':changed,'protected_baseline_files_unchanged':confirmed,'package_config_hashes':version,
 'production_fixture_scan':{'suffixes':['.js','.html','.json','.hbc'],'markers':['(127.0.0.1|localhost|10.0.2.2):1808[56]','__ui/emit'],'matches':matches,'note':'Bare 18086 was verified in Reanimated __workletHash=9106121518086, not an endpoint. URL-aware scan excludes that false positive.'},
 'web_modified_in_G':False,'backend_modified_in_G':False,'database_mutated':False,'commit_push':False,
 'helpers':'AVD and known fixture/Metro helper PIDs stopped; no unrelated user apps stopped',
 'log_sha256':log_hashes,
 'phase_M_readiness':'Handoff ready for approved native build/connectivity/rendered/accessibility/performance work; no M/H executed.'
}
(EV/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'acceptance':verification['acceptance'],'tests_pass':198,'reports':15,'changed_files':len(changed),'fixture_matches':0,'protected_unchanged':len(confirmed),'G_native_bytes':{p:bundles['g'][p]['total_bytes'] for p in ['android','ios']}},ensure_ascii=False))
