// Local, in-memory UI fixture. Never run against a real database or deploy this server.
// node tests/fixtures/passenger-api-server.mjs (127.0.0.1:18085)
import http from 'node:http';
import { randomUUID } from 'node:crypto';
const ids = { user: '66666666-6666-4666-8666-666666666666', cruise: '11111111-1111-4111-8111-111111111111', cabin: '22222222-2222-4222-8222-222222222222', booking: '33333333-3333-4333-8333-333333333333', bp: '44444444-4444-4444-8444-444444444444', activity: '55555555-5555-4555-8555-555555555555', itinerary: '77777777-7777-4777-8777-777777777777', stop: '88888888-8888-4888-8888-888888888888', excursion: '99999999-9999-4999-8999-999999999999', service: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', package: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const permissions = ['BOOKING_READ','BOOKING_CREATE','BOOKING_CANCEL','CRUISE_READ','ITINERARY_READ','ITINERARY_DAY_READ','ITINERARY_CHANGE_READ','CRUISE_STOP_READ','EXCURSION_READ','EXCURSION_BOOKING','ACTIVITY_READ','ACTIVITY_REGISTRATION','SERVICE_READ','SERVICE_REQUEST_CREATE','TOUR_PACKAGE_ASSIGN'];
const session = { accessToken: 'local-fixture-only', tokenType: 'Bearer', expiresIn: 3600, userId: ids.user, username: 'ui-passenger', email: 'fixture@example.test', roles: ['PASSENGER'], effectivePermissions: permissions };
const cruise = { cruiseId: ids.cruise, cruiseCode: 'FIXTURE', cruiseName: 'Chuyến kiểm thử giao diện', shipName: 'Tàu kiểm thử', status: 'PUBLISHED', departureDatetime: '2027-11-01T03:00:00Z', returnDatetime: '2027-11-04T03:00:00Z' };
const person = { bookingPassengerId: ids.bp, passengerId: ids.user, fullName: 'Hành khách kiểm thử', email: session.email, participationStatus: 'Active', cabinId: ids.cabin, cabinNumber: '101', cabinType: 'BALCONY', deckNumber: 1, tourPackageId: null, tourPackageName: null, agreedPackagePrice: null };
const detail = { ...cruise, bookingId: ids.booking, bookingReference: 'BK-UI-FIXTURE', bookingStatus: 'Confirmed', agreedFareAmount: 500, currency: 'USD', passengerCount: 1, createdAt: new Date().toISOString(), shipName: 'Tàu kiểm thử', requiredDepositAmount: 150, passengers: [person], installments: [], contractSigningInstructions: 'Dữ liệu kiểm thử cục bộ, không phải đặt chỗ thật.' };
const draftId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; const draftPerson = { ...person, bookingPassengerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' };
const bookings = [detail, { ...detail, bookingId: draftId, bookingReference: 'BK-UI-DRAFT', bookingStatus: 'Draft', passengers: [draftPerson] }];
const service = { id: ids.service, code: 'TEA', name: 'Trà chiều kiểm thử', description: 'Chỉ phục vụ kiểm tra giao diện cục bộ.', type: 'Ẩm thực', price: 10, currency: 'USD', capacity: 20, status: 'ACTIVE' };
const activity = { id: ids.activity, code: 'YOGA', name: 'Yoga kiểm thử', description: 'Dữ liệu kiểm thử', cruiseId: ids.cruise, startTime: '2027-11-02T00:00:00Z', endTime: '2027-11-02T01:00:00Z', location: 'Deck 4', capacity: 20, price: 0, currencyCode: 'USD', status: 'OPEN' };
const excursion = { shoreExcursionId: ids.excursion, cruiseStopId: ids.stop, excursionName: 'Tham quan cảng kiểm thử', startTime: activity.startTime, plannedReturnTime: activity.endTime, meetingPoint: 'Sảnh chính', status: 'OPEN', price: 15, currencyCode: 'USD', availableCapacity: 10 };
const pkg = { id: ids.package, code: 'BASIC', name: 'Gói thư giãn kiểm thử', description: 'Gói dữ liệu kiểm thử, không bán thật.', type: 'BASIC', price: 30, currency: 'USD', status: 'ACTIVE', startDate: '2027-01-01', endDate: '2027-12-31' };
// Optional UI-only scenarios: slow responses or a failed service catalogue.
const scenario = process.env.UI_FIXTURE_SCENARIO ?? 'normal';
if (!['normal', 'slow', 'service-error'].includes(scenario)) throw new Error('Unknown UI fixture scenario');
const requests = []; const registrations = []; const assignments = [];
const page = list => ({ content: list, number: 0, totalPages: list.length ? 1 : 0, totalElements: list.length });
http.createServer(async (req,res) => {
  const origin=req.headers.origin;
  if(['http://localhost:8084','http://127.0.0.1:8084','http://[::1]:8084'].includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const send = (data,status=200) => {res.writeHead(status);res.end(JSON.stringify({success:status<400,data,...(status>=400?{message:data}: {})}));};
  const url=new URL(req.url,'http://127.0.0.1');const path=url.pathname.replace(/^\/api/,'');const method=req.method;
  let text='';for await(const chunk of req)text+=chunk;
  let body;try{body=text?JSON.parse(text):{};}catch{send('Invalid JSON',400);return;}
  if(path==='/auth/login'||path==='/auth/refresh'){send(session);return;}
  if(req.headers.authorization!==`Bearer ${session.accessToken}`){send('Fixture token required',401);return;}
  if(scenario==='slow') await new Promise(resolve => setTimeout(resolve, 900));
  if(scenario==='service-error' && path==='/servicepackage/services'){send('Dịch vụ kiểm thử tạm thời không khả dụng.',503);return;}
  if(path==='/auth/me'){send({...session,status:'ACTIVE'});return;}
  if(path==='/booking'&&method==='GET'){send(page(bookings));return;}
  if(path==='/booking'&&method==='POST'){
    const next={...detail,bookingId:randomUUID(),bookingReference:`BK-UI-${bookings.length+1}`,bookingStatus:'Draft',paymentPlan:body.paymentPlan,passengers:body.passengers.map(p=>({...person,...p,bookingPassengerId:randomUUID()}))};bookings.push(next);send(next,201);return;
  }
  if(path==='/booking/available-cabins'){send([{cabinId:ids.cabin,cabinNumber:'101',deckId:ids.stop,deckNumber:1,deckName:'Deck khách',cabinType:'BALCONY',capacity:2,remainingCapacity:2,isAccessible:true}]);return;}
  const matchBooking=path.match(/^\/booking\/([^/]+)(\/cancel)?$/);
  if(matchBooking){const b=bookings.find(b=>b.bookingId===matchBooking[1]);if(!b){send('Not found',404);return;}if(method==='POST'){b.bookingStatus='Cancelled';b.cancellationReason=body.reason;}send(b);return;}
  if(path==='/cruise'){send(page([cruise]));return;}
  if(path.startsWith('/cruise/')){send(cruise);return;}
  const itinerary={itineraryId:ids.itinerary,cruiseId:ids.cruise,itineraryName:'Hải trình kiểm thử',startDate:'2027-11-01',endDate:'2027-11-04',status:'ACTIVE'};
  if(path==='/itineraries'){send(page([itinerary]));return;}
  if(path.endsWith('/days')){send([]);return;}
  if(path.startsWith('/itineraries/')){send(itinerary);return;}
  if(path.startsWith('/itinerary-change-history/')){send([]);return;}
  if(path.startsWith('/cruise-stops/by-itinerary/')){send([{cruiseStopId:ids.stop,stopOrder:1}]);return;}
  if(path==='/shore-excursions'){send([excursion]);return;}
  if(path.startsWith('/shore-excursions/')){send(excursion);return;}
  if(path==='/servicepackage/services'){send([service]);return;}
  if(path.endsWith('/availability')&&path.startsWith('/servicepackage/')){send({serviceId:ids.service,requestedQuantity:Number(url.searchParams.get('quantity')||1),available:true});return;}
  if(path==='/servicepackage/requests'){
    if(method==='POST')requests.push({...body,id:randomUUID(),passengerId:ids.user,bookingId:ids.booking,status:'REQUESTED',requestTime:new Date().toISOString()});send(method==='POST'?requests.at(-1):requests,method==='POST'?201:200);return;
  }
  const request=path.match(/^\/servicepackage\/requests\/([^/]+)(\/cancel)?$/);
  if(request){const row=requests.find(r=>r.id===request[1]);if(!row){send('Not found',404);return;}if(method==='PUT')Object.assign(row,body);if(request[2])row.status='CANCELLED';send(row);return;}
  if(path==='/activities'){send([activity]);return;}
  if(path.endsWith('/availability')&&path.startsWith('/activities/')){send({activityId:ids.activity,capacity:20,availableSeats:20,status:'OPEN'});return;}
  if(path==='/activities/registrations'){send(registrations);return;}
  const register=path.match(/^\/activities\/(excursions\/)?([^/]+)\/registrations$/);
  if(register){const row={...body,id:randomUUID(),passengerId:ids.user,activityId:register[1]?null:register[2],excursionId:register[1]?register[2]:null,status:'PENDING',registeredAt:new Date().toISOString()};registrations.push(row);send(row,201);return;}
  const registration=path.match(/^\/activities\/registrations\/([^/]+)(\/(confirm|cancel))?$/);
  if(registration){const row=registrations.find(r=>r.id===registration[1]);if(!row){send('Not found',404);return;}if(method==='PUT')Object.assign(row,body);if(registration[3])row.status=registration[3]==='confirm'?'CONFIRMED':'CANCELLED';send(row);return;}
  if(path==='/servicepackage/packages'){send([pkg]);return;}
  if(path.endsWith('/benefits')){send({packageInfo:pkg,services:[{serviceId:ids.service,benefitType:'INCLUDED'}],activities:[{activityId:ids.activity,benefitType:'OPTIONAL'}],excursions:[]});return;}
  if(path==='/servicepackage/package-assignments'){send(assignments.filter(a=>bookings.find(b=>b.bookingId===url.searchParams.get('bookingId'))?.passengers.some(p=>p.bookingPassengerId===a.bookingPassengerId)));return;}
  if(path.startsWith('/servicepackage/package-assignments/')){const bpId=path.split('/').at(-1);const index=assignments.findIndex(a=>a.bookingPassengerId===bpId);if(index>=0)assignments.splice(index,1);if(method!=='DELETE')assignments.push({bookingPassengerId:bpId,packageId:body.tourPackageId,agreedPrice:30,currency:'USD',assignedAt:new Date().toISOString()});send(assignments.at(-1)||null);return;}
  send('Fixture endpoint not implemented',404);
}).listen(18085,'127.0.0.1',()=>console.log('In-memory passenger UI fixture http://127.0.0.1:18085/api; no real data'));
