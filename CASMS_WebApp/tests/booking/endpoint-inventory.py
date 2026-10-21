"""Read-only source/OpenAPI reconciliation. No network, credentials or BE writes.

Run from CASMS_WebApp: python tests/booking/endpoint-inventory.py
The OpenAPI snapshot is evidence of schema, NOT of runtime availability.
"""
from pathlib import Path
import collections
import datetime
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BE = ROOT.parent.parent / 'CASMS_Backend'
SNAPSHOT = BE / 'openapi.json'

def canonical(path):
    return re.sub(r'\{[^}]+\}', '{}', path.rstrip('/') or '/')

def arguments(source, end):
    cursor = end
    while cursor < len(source) and source[cursor].isspace(): cursor += 1
    if cursor >= len(source) or source[cursor] != '(': return '', end
    start, depth, quoted, escaped = cursor + 1, 1, False, False
    cursor += 1
    while depth:
        ch = source[cursor]
        if escaped: escaped = False
        elif quoted and ch == '\\': escaped = True
        elif ch == '"': quoted = not quoted
        elif not quoted:
            if ch == '(': depth += 1
            elif ch == ')': depth -= 1
        cursor += 1
    return source[start:cursor - 1], cursor

def source_operations():
    result = {}
    for file in sorted((BE / 'src/main/java').rglob('*Controller.java')):
        source = file.read_text(encoding='utf-8-sig')
        class_at = source.find('public class ')
        matches = list(re.finditer(r'@(Get|Post|Put|Patch|Delete|Request)Mapping\b', source))
        base, previous = '', class_at
        for match in matches:
            args, end = arguments(source, match.end())
            strings = re.findall(r'"([^"\n]*)"', args)
            path = strings[0] if strings else ''
            if match.start() < class_at:
                base = path
                continue
            verb = match.group(1).upper()
            if verb == 'REQUEST':
                verbs = re.findall(r'RequestMethod\.(GET|POST|PUT|PATCH|DELETE)', args)
                if not verbs: raise RuntimeError('Unresolved mapping: ' + str(file))
            else: verbs = [verb]
            # Current controllers put @PreAuthorize before the HTTP mapping.
            section = source[previous:match.start()]
            permissions = re.findall(r'@PreAuthorize\("((?:[^"\\]|\\.)*)"\)', section)
            if not permissions:
                permissions = re.findall(r'@PreAuthorize\("((?:[^"\\]|\\.)*)"\)', source[:class_at])
            permission = permissions[-1] if permissions else 'URL SecurityConfig / no method annotation'
            signature = re.search(r'public\s+([^\n{]+?)\s+(\w+)\s*\(', source[end:])
            method = signature.group(2) if signature else '?'
            method_args, _ = arguments(source, end + signature.end() - 1) if signature else ('?',0)
            full = (base.rstrip('/') + '/' + path.lstrip('/')).rstrip('/')
            for verb in verbs:
                key = (verb, canonical(full))
                if key in result: raise RuntimeError('Duplicate source operation ' + str(key))
                result[key] = dict(verb=verb, path=full, permission=permission,
                    source=str(file.relative_to(BE)).replace('\\', '/'),
                    line=source[:match.start()].count('\n') + 1, method=method,
                    contract=' '.join(method_args.split()) + ' → ' + signature.group(1) if signature else '?')
            previous = end
    return result

def contract(schema):
    if not schema: return '—'
    if '$ref' in schema: return schema['$ref'].split('/')[-1]
    if schema.get('type') == 'array': return 'List<' + contract(schema.get('items')) + '>'
    return schema.get('type', str(schema)) + (':' + schema['format'] if 'format' in schema else '')

CORE = {
 ('GET','/cruise'): ('Discovery/search/pagination', 'liveCruiseCatalogApi.list; realBookingApi.cruises', '/; /cruises; cabin selection', 'v15-contract + landing/refinement browser'),
 ('GET','/cruise/{}'): ('Published detail', 'liveCruiseCatalogApi.detail', '/cruises/:id', 'v15-contract + v15-integration browser'),
 ('GET','/booking/available-cabins'): ('Per-passenger cabin/capacity', 'realBookingApi.cabins', '/booking/cabin-experience', 'v15-contract + v13-scenarios browser'),
 ('GET','/servicepackage/packages'): ('Optional active package', 'realBookingApi.packages', '/booking/cabin-experience', 'v15-contract + complete-integration browser'),
 ('POST','/booking'): ('Guest create/review/result', 'realBookingApi.create', '/booking/review', 'v15-contract + v12/v13 browser'),
 ('GET','/booking/lookup'): ('Reference + contact proof', 'realBookingApi.lookup', '/booking/lookup', 'v15-contract + v13 browser'),
 ('GET','/booking'): ('Owned list', 'realBookingApi.list', '/my-bookings', 'v15-contract + v15-integration browser'),
 ('GET','/booking/{}'): ('Owned detail/contract/schedule', 'realBookingApi.get', '/my-bookings/:id', 'v15-contract + v15-integration browser'),
 ('POST','/booking/{}/confirm'): ('Existing authorized Booking operation', 'realBookingApi.confirm', 'existing permission-gated Booking detail; ordinary customer hidden', 'v15-contract + v15-integration browser'),
 ('POST','/booking/{}/cancel'): ('Existing authorized Booking operation', 'realBookingApi.cancel', 'existing permission-gated Booking detail; ordinary customer hidden', 'v15-contract + v15-integration browser'),
 ('POST','/booking/change-cabin'): ('Existing authorized cabin change', 'realBookingApi.changeCabin', 'existing permission-gated Booking detail; ordinary customer hidden', 'v15-contract + v15-integration browser'),
 ('GET','/ships/{}'): ('Authorized ship supplement', 'liveCruiseCatalogApi.ship', '/cruises/:id', 'v15-contract + v15-integration browser'),
 ('GET','/itineraries'): ('Authorized itinerary lookup', 'liveCruiseCatalogApi.itinerary', '/cruises/:id', 'v15-contract + v15-integration browser'),
 ('GET','/itineraries/{}/days'): ('Authorized days', 'liveCruiseCatalogApi.days', '/cruises/:id', 'v15-contract + v15-integration browser'),
 ('GET','/cruise-stops/by-itinerary/{}'): ('Authorized stops', 'liveCruiseCatalogApi.stops', '/cruises/:id', 'v15-contract + v15-integration browser'),
}
EXTRAS = {
 ('GET','/servicepackage/packages/{}'): ('Package detail', 'package', '/booking/cabin-experience → selected package details'),
 ('GET','/activities'): ('Same-cruise activity catalog', 'activities', 'activity selector'),
 ('GET','/activities/{}'): ('Activity detail', 'activity', 'selected activity'),
 ('GET','/activities/{}/availability'): ('Live remaining seats', 'activityAvailability', 'selected activity'),
 ('GET','/activities/registrations'): ('Own registrations including existing excursions', 'registrations', 'Đăng ký của tôi → reload'),
 ('GET','/activities/registrations/{}'): ('Own registration detail', 'registration', 'registration → details'),
 ('POST','/activities/{}/registrations'): ('Register own passenger on confirmed Booking', 'registerActivity', 'activity → submit'),
 ('POST','/activities/registrations/{}/confirm'): ('Confirm registration, not payment/check-in', 'confirmRegistration', 'pending registration → confirm'),
 ('PUT','/activities/registrations/{}'): ('Edit pending registration', 'updateRegistration', 'pending registration → save'),
 ('POST','/activities/registrations/{}/cancel'): ('Cancel own registration', 'cancelRegistration', 'registration → cancel'),
 ('GET','/servicepackage/services'): ('Active add-on catalog with SERVICE_READ', 'services', 'service selector'),
 ('GET','/servicepackage/services/{}'): ('Service detail', 'service', 'selected service'),
 ('GET','/servicepackage/services/{}/availability'): ('Quantity availability', 'serviceAvailability', 'service quantity field'),
 ('GET','/servicepackage/requests'): ('Own requests on this Booking', 'requests', 'Yêu cầu của tôi → reload'),
 ('GET','/servicepackage/requests/{}'): ('Own request detail', 'request', 'request → details'),
 ('POST','/servicepackage/requests'): ('Request own passenger service', 'createRequest', 'service → submit'),
 ('PUT','/servicepackage/requests/{}'): ('Edit requested service', 'updateRequest', 'request → save'),
 ('POST','/servicepackage/requests/{}/cancel'): ('Cancel own request', 'cancelRequest', 'request → cancel'),
 ('GET','/shore-excursions'): ('Tours at proven same-cruise stop', 'excursions', 'authorized stop → excursion selector'),
 ('GET','/shore-excursions/{}'): ('Raw excursion detail', 'excursion', 'selected excursion'),
 ('GET','/shore-excursions/{}/availability'): ('Raw availability for requested participants', 'excursionAvailability', 'excursion quantity field'),
 ('POST','/activities/excursions/{}/registrations'): ('Register own excursion with confirmed Booking', 'registerExcursion', 'excursion → submit'),
}
BLOCKED = {
 '/ports/active': 'Published destination/port discovery needs narrow public port read',
 '/ports/{}': 'Port details need narrow public port read',
 '/destinations/active': 'Destination discovery needs narrow public destination read',
 '/destinations/{}': 'Destination detail needs narrow public destination read',
 '/decks/{}': 'Deck detail needs DECK_READ; cabin DTO currently provides only basic metadata',
 '/decks/{}/cabins': 'Deck cabin content needs DECK_READ/CABIN_READ; never replace booking availability with full cabin catalog',
 '/decks/by-ship/{}': 'Ship deck navigation requires DECK_READ; absent from saved OpenAPI',
 '/cabins/by-ship/{}': 'Ship cabin catalog requires CABIN_READ; use available-cabins for live choice',
 '/cabins/by-deck/{}': 'Deck cabin catalog requires CABIN_READ; use available-cabins for live choice',
 '/cabins/{}': 'Cabin amenities/detail needs CABIN_READ; booking availability is already wired',
 '/itineraries/{}': 'Direct itinerary metadata requires ITINERARY_READ; list currently supplies authorized metadata',
 '/servicepackage/packages/{}/benefits': 'Package benefits require TOUR_PACKAGE_MANAGE/ASSIGN, not guest/PASSENGER',
 '/servicepackage/packages/{}/services': 'Package service composition requires management permission',
 '/servicepackage/packages/{}/activities': 'Package activity composition requires management permission',
 '/servicepackage/packages/{}/excursions': 'Package excursion composition requires management permission',
 '/servicepackage/package-assignments': 'Agreed package charge read requires assignment/management permission; Booking supplies package selection only',
 '/servicepackage/package-assignments/{}': 'Per-passenger agreed package charge requires assignment/management permission',
}
EXCURSION = {'/shore-excursions', '/shore-excursions/{}', '/shore-excursions/{}/availability'}

def classify(key):
    verb, path = key
    if key in CORE:
        workflow, function, route, test = CORE[key]
        kind = 'REQUIRED_STAFF_BOOKING' if verb == 'POST' and path not in ['/booking'] else 'REQUIRED_SUPPORTING' if path.startswith(('/ships','/itineraries','/cruise-stops')) else 'REQUIRED_CUSTOMER'
        access = 'PUBLIC_ACCESS_BLOCKED for ordinary customer; authorized-capability path wired' if kind != 'REQUIRED_CUSTOMER' else 'runtime/ownership not live-verified'
        return kind, workflow, 'WIRED / CONTRACT_TESTED / RUNTIME_BLOCKED', function, route, test, access
    if key in EXTRAS:
        workflow, function, route = EXTRAS[key]
        gap = 'Services additionally PUBLIC_ACCESS_BLOCKED for default PASSENGER (no service permissions)' if path.startswith('/servicepackage/') and function != 'package' else 'Effective permission + server ownership; no live mutations'
        if path in EXCURSION or 'excursions' in path: gap = 'WIRED only with EXCURSION_READ + ITINERARY_READ + CRUISE_STOP_READ; write additionally EXCURSION_BOOKING. Ordinary PASSENGER is PUBLIC_ACCESS_BLOCKED on stop mapping. No invented cruise ID or privileged token.'
        return 'REQUIRED_CUSTOMER', workflow, 'WIRED / CONTRACT_TESTED / RUNTIME_BLOCKED', 'customerExtrasApi.' + function, route if function == 'package' else '/my-bookings/:id/experiences → ' + route, 'complete-contract + complete-integration browser', gap
    if path.startswith('/auth/'):
        return 'REQUIRED_CUSTOMER', 'Existing authenticated session continuity', 'WIRED / CONTRACT_TESTED / RUNTIME_BLOCKED', 'AuthProvider apiRequest + decodeSessionAccess' if path == '/auth/me' else 'authApi.' + path.split('/')[-1], '/login; AuthProvider/authSession; existing account logout', 'complete-auth + booking-recovery-logout + booking-logout browser', 'Current /auth/me unavailable; no live credentials used'
    if verb == 'GET' and path in BLOCKED:
        return 'REQUIRED_SUPPORTING', BLOCKED[path], 'PUBLIC_ACCESS_BLOCKED / RUNTIME_BLOCKED', '—', 'Discovery/detail/package supporting content', 'source permission inspection only; NOT wired/tested', 'BE narrow public/owned read contract required'
    if (verb == 'GET' and path in EXCURSION) or (verb == 'POST' and path == '/activities/excursions/{}/registrations'):
        return 'REQUIRED_CUSTOMER', 'Excursion discovery/registration for correct Booking cruise', 'CONTRACT_GAP / RUNTIME_BLOCKED', '—', '/my-bookings/:id/experiences → explicit blocked state', 'source DTO/permission inspection only; NOT wired/tested', 'Excursion DTO has cruiseStopId but no cruiseId; guest/PASSENGER cannot read stop→itinerary→cruise mapping'
    if path.endswith('/schedule-check') and path.startswith('/servicepackage') or path.endswith('/sales'):
        return 'OUT_OF_SCOPE', 'NOT_IMPLEMENTED: source returns 501; no supported customer scheduling/POS workflow', 'NOT_IMPLEMENTED', '—', '—', 'source 501 inspection', 'No fake scheduling or sale'
    reason = '3D model / BLE tracking / ship installation configuration; not Booking Web' if any(token in path for token in ['models','/model','ble-','3d-configuration','ship-model-assets']) else 'Admin/operations catalog, lifecycle, staffing, assignment or internal configuration; no approved customer control'
    if verb == 'GET':
        if path in ['/cruise-stops/{}','/itinerary-days/by-itinerary/{}','/itinerary-days/{}']: reason = 'Alternative point/day read; customer already receives the DTO through wired stops/days aggregate, no additional customer action requires this route'
        elif path == '/ships': reason = 'Fleet catalog for administration; customer selects published cruise then uses wired ship detail'
        elif path in ['/decks','/cabins']: reason = 'Unscoped inventory catalog; Booking uses available-cabins and needs scoped safe detail contracts, not whole fleet inventory'
        elif path in ['/ports','/destinations']: reason = 'Unrestricted catalog includes operational records; public workflow requires the ACTIVE/detail scoped reads listed as blockers'
        elif path.startswith(('/tour-groups','/tour-group-passengers')): reason = 'Staff tour-group allocation/contact/attendance workflow; no approved owner-scoped customer self-service contract'
        elif '/regulations' in path or path.startswith('/operational-'): reason = 'Operational regulation/issue/safety administration, not published customer Booking terms'
        elif path.endswith(('/availability','/readiness','/capacity-summary','/current-cruise','/affected-cruises','/validate-capacity','/validate-schedule','/validate-ship-availability','/duration','/port-availability','/capacity','/validate-ship','/capacity-check','/compatibility-check','/assignments','/schedule-check')): reason = 'Operational readiness/scheduling/allocation validation; not passenger cabin availability or customer reservation'
        elif path.startswith('/servicepackage/products'): reason = 'Product/POS catalog outside Booking; corresponding sale capability is not implemented'
        elif path.startswith('/activities/participations'): reason = 'Staff attendance read requires ACTIVITY_ATTENDANCE, no owned customer participation read'
        elif path.startswith('/identity'): reason = 'Account administration; customer identity/session uses /auth/me'
        elif path == '/destinations/{}/ports': reason = 'Destination-maintenance hierarchy; no supported customer cruise destination filter/navigation consumes this full relation'
    return 'OUT_OF_SCOPE', reason, 'NOT_APPLICABLE', '—', 'Admin/operations owner', '—', 'Do not add customer UI to inflate endpoint coverage'

def cell(value): return str(value).replace('|',' / ').replace('\n',' ').replace('<','&lt;').replace('>','&gt;')

def main():
    data = json.loads(SNAPSHOT.read_text(encoding='utf-8-sig'))
    sources = source_operations()
    operations = {}
    for path, methods in data['paths'].items():
        for verb, op in methods.items():
            if verb.upper() not in ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']: continue
            operations[(verb.upper(), canonical(path))] = dict(path=path, verb=verb.upper(), op=op)
    missing_source = set(operations) - set(sources)
    missing_snapshot = set(sources) - set(operations)
    if missing_source: raise RuntimeError('Snapshot operations absent from source: ' + str(missing_source))
    for key in missing_snapshot:
        src = sources[key]
        operations[key] = dict(path=src['path'],verb=src['verb'],op=None)
    rev = subprocess.check_output(['git','rev-parse','HEAD'],cwd=BE,text=True).strip()
    head = f'Observed **{len(sources)} current Java controller operations** on {len(set(s["path"] for s in sources.values()))} paths. Saved OpenAPI has **268 operations on {len(data["paths"])} paths**: all matched source, but **{len(missing_snapshot)} current source operations are absent from that snapshot**. Source is authoritative for these additions; their signature is retained below instead of a fabricated Swagger DTO. BE HEAD `{rev}`. OpenAPI snapshot SHA256 `{hashlib.sha256(SNAPSHOT.read_bytes()).hexdigest()}`; mtime UTC {datetime.datetime.fromtimestamp(SNAPSHOT.stat().st_mtime,datetime.timezone.utc).isoformat()}. This is a local saved snapshot, not a successful live Swagger fetch. No BE files changed. Context path `/api` precedes every path below. Runtime probes are in the handoff; RUNTIME_BLOCKED is a service-level blocker, not an assertion that every endpoint was individually called.'
    inventory = ['# Booking endpoint inventory','',head,'','Classification follows the user-approved customer journey and current source permissions. Required staff Booking rows retain existing authorized operations only. OUT_OF_SCOPE never implies missing implementation.','', '| Method/path | Classification | Rationale/status | Query/body → response | Permission | Source method |','|---|---|---|---|---|---|']
    coverage = ['# Booking API coverage','',head,'','WIRED means a real route/control calls the shared live transport. CONTRACT_TESTED/fixture browser tests do not establish LIVE_VERIFIED. No endpoint is currently LIVE_VERIFIED. Customer personas require the permissions shown, plus server ownership for object reads/writes.','', '| Workflow / persona | Method/path | Query/body → response | Permission | FE function / route/control | Proof | State / gap |','|---|---|---|---|---|---|---|']
    counts = collections.Counter()
    for key, item in sorted(operations.items()):
        src, op = sources[key], item['op'] or {}
        kind, rationale, status, function, route, test, gap = classify(key)
        counts[kind] += 1
        counts['wired'] += status.startswith('WIRED')
        params = ', '.join(p['in'] + ':' + p['name'] + ('*' if p.get('required') else '') + '=' + contract(p.get('schema')) for p in op.get('parameters',[]))
        body = op.get('requestBody',{}).get('content',{})
        body = ', '.join(contract(c.get('schema')) for c in body.values())
        responses = ', '.join(code + ':' + '/'.join(contract(c.get('schema')) for c in r.get('content',{}).values()) for code,r in op.get('responses',{}).items())
        shape = (params + (' body:' + body if body else '') + ' → ' + responses).strip() if item['op'] else 'OPENAPI_SNAPSHOT_MISSING: ' + src['contract']
        endpoint = item['verb'] + ' ' + item['path']
        inventory.append('| ' + ' | '.join(map(cell,[endpoint,kind,rationale + '; ' + status,shape,src['permission'],src['source'] + ':' + str(src['line']) + ' ' + src['method']])) + ' |')
        if kind != 'OUT_OF_SCOPE': coverage.append('| ' + ' | '.join(map(cell,[rationale + ' / ' + ('authorized staff only' if kind=='REQUIRED_STAFF_BOOKING' else 'guest/customer, effective permissions'),endpoint,shape,src['permission'],function + ' / ' + route,test,status + '; ' + gap])) + ' |')
    tail = '\n\n## Counts and absent capabilities\n\n' + json.dumps(dict(counts),sort_keys=True) + '\n\nCheckinController, PaymentController and NotificationController contain TODO bodies and no operation mappings. Passenger document/profile editing, change-request submission, boarding pass, arrival slots, invoice/payment settlement and signing have no verified customer endpoint. Service schedule-check and product sales map routes but return 501 NOT_IMPLEMENTED; excluded from customer controls. Activity schedule-check detects operational venue conflicts, not passenger availability. Package assignment writes remain Admin-only. GET cabin assignment/capacity/compatibility operations are internal allocation; public available-cabins already supplies customer selection. Cruise regulation assignment endpoints manage operational regulations, not an approved customer policy-document contract.\n'
    (ROOT / 'OCV_BOOKING_ENDPOINT_INVENTORY.md').write_text('\n'.join(inventory)+tail,encoding='utf-8')
    (ROOT / 'OCV_BOOKING_API_COVERAGE.md').write_text('\n'.join(coverage)+tail,encoding='utf-8')
    print(json.dumps(dict(counts),sort_keys=True))

if __name__ == '__main__': main()
