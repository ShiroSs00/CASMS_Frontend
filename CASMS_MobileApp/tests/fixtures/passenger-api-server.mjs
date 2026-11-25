// Local, in-memory UI fixture. Never run against a real database or deploy this server.
// node tests/fixtures/passenger-api-server.mjs (127.0.0.1:18085)
import http from 'node:http';
import { randomUUID } from 'node:crypto';
const ids = { user: '66666666-6666-4666-8666-666666666666', cruise: '11111111-1111-4111-8111-111111111111', cabin: '22222222-2222-4222-8222-222222222222', booking: '33333333-3333-4333-8333-333333333333', bp: '44444444-4444-4444-8444-444444444444', activity: '55555555-5555-4555-8555-555555555555', itinerary: '77777777-7777-4777-8777-777777777777', stop: '88888888-8888-4888-8888-888888888888', excursion: '99999999-9999-4999-8999-999999999999', service: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', package: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const permissions = ['NOTIFICATION_READ','DECK_READ','BOOKING_READ','PAYMENT_READ','BOOKING_CANCEL','CRUISE_READ','ITINERARY_READ','ITINERARY_DAY_READ','ITINERARY_CHANGE_READ','CRUISE_STOP_READ','EXCURSION_READ','EXCURSION_BOOKING','ACTIVITY_READ','ACTIVITY_REGISTRATION','SERVICE_READ','SERVICE_REQUEST_CREATE','TOUR_PACKAGE_ASSIGN'];
const session = { accessToken: 'local-fixture-only', tokenType: 'Bearer', expiresIn: 3600, userId: ids.user, username: 'ui-passenger', email: 'fixture@example.test', roles: ['PASSENGER'], effectivePermissions: permissions };
const cruise = { cruiseId: ids.cruise, cruiseCode: 'FIXTURE', cruiseName: 'Chuyến kiểm thử giao diện', shipName: 'Tàu kiểm thử', status: 'PUBLISHED', departureDatetime: '2027-11-01T03:00:00Z', returnDatetime: '2027-11-04T03:00:00Z' };
const person = { bookingPassengerId: ids.bp, passengerId: ids.user, fullName: 'Hành khách kiểm thử', email: session.email, participationStatus: 'Active', cabinId: ids.cabin, cabinNumber: '101', cabinType: 'BALCONY', deckNumber: 1, tourPackageId: null, tourPackageName: null, agreedPackagePrice: null };
const detail = { ...cruise, bookingId: ids.booking, bookingReference: 'BK-UI-FIXTURE', bookingStatus: 'Confirmed', agreedFareAmount: 500, currency: 'USD', passengerCount: 1, createdAt: new Date().toISOString(), shipName: 'Tàu kiểm thử', requiredDepositAmount: 150, passengers: [person], installments: [], contractSigningInstructions: 'Dữ liệu kiểm thử cục bộ, không phải đặt chỗ thật.' };
Object.assign(detail, { totalPaidAmount: 350.1234, outstandingBalance: 149.8766, fullyPaid: false, contractStatus: 'Accepted', installments: [
  { sequenceNo: 1, requiredAmount: 150, currency: 'USD', status: 'Scheduled', paidAmount: 150, outstandingAmount: 0, paid: true },
  { sequenceNo: 2, requiredAmount: 350, currency: 'USD', status: 'Scheduled', paidAmount: 200.1234, outstandingAmount: 149.8766, paid: false },
] });
const draftId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; const draftPerson = { ...person, bookingPassengerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' };
const bookings = [detail, { ...detail, bookingId: draftId, bookingReference: 'BK-UI-DRAFT', bookingStatus: 'Draft', contractStatus: 'Draft', totalPaidAmount: 500, outstandingBalance: 0, fullyPaid: true, installments: [{ sequenceNo: 1, requiredAmount: 500, currency: 'USD', status: 'Scheduled', paidAmount: 500, outstandingAmount: 0, paid: true }], passengers: [draftPerson] }];
const service = { id: ids.service, code: 'TEA', name: 'Trà chiều kiểm thử', description: 'Chỉ phục vụ kiểm tra giao diện cục bộ.', type: 'Ẩm thực', price: 10, currency: 'USD', capacity: 20, status: 'ACTIVE', requiresSchedule: true, canBuyPreCruise: true, canBuyOnboard: true, unitCode: 'VISIT', categoryId: ids.service, categoryName: 'Ẩm thực', preCruiseUsagePolicy: 'PER_CRUISE' };
const activity = { id: ids.activity, code: 'YOGA', name: 'Yoga kiểm thử', description: 'Dữ liệu kiểm thử', cruiseId: ids.cruise, startTime: '2027-11-02T00:00:00Z', endTime: '2027-11-02T01:00:00Z', location: 'Deck 4', capacity: 20, price: 0, currencyCode: 'USD', status: 'OPEN' };
const excursion = { shoreExcursionId: ids.excursion, cruiseStopId: ids.stop, excursionName: 'Tham quan cảng kiểm thử', startTime: activity.startTime, plannedReturnTime: activity.endTime, meetingPoint: 'Sảnh chính', status: 'OPEN', price: 15, currencyCode: 'USD', availableCapacity: 10 };
const pkg = { id: ids.package, code: 'BASIC', name: 'Gói thư giãn kiểm thử', description: 'Gói dữ liệu kiểm thử, không bán thật.', type: 'BASIC', price: 30, currency: 'USD', status: 'ACTIVE', startDate: '2027-01-01', endDate: '2027-12-31' };
// Optional UI-only scenarios: slow responses or a failed service catalogue.
const scenario = process.env.UI_FIXTURE_SCENARIO ?? 'normal';
if (!['normal', 'slow', 'service-error'].includes(scenario)) throw new Error('Unknown UI fixture scenario');
const requests = []; const registrations = []; const assignments = [];
const page = list => ({ content: list, number: 0, totalPages: list.length ? 1 : 0, totalElements: list.length });
const notificationClients = new Set();
const notifications = [{ notificationId:'10101010-1010-4010-8010-101010101010', bookingPassengerId:ids.bp, notificationType:'CRUISE_SCHEDULE_CHANGE', title:'Lịch trình kiểm thử đã cập nhật', content:'Chỉ là thông báo UI fixture cục bộ; không phải thay đổi chuyến thực tế.', createdAt:new Date().toISOString(), readAt:null }];
const unread = () => notifications.filter(row => !row.readAt).length;
const broadcast = (name,data) => { for (const client of notificationClients) client.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`); };
http.createServer(async (req,res) => {
  const origin=req.headers.origin;
  if(['http://localhost:8084','http://127.0.0.1:8084','http://[::1]:8084','http://127.0.0.1:8086','http://localhost:8086','http://10.0.2.2:8086'].includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
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
  if(path==='/notifications/stream'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});
    res.write('event: connected\ndata: {"connected":true}\n\n'); notificationClients.add(res); res.on('close',()=>notificationClients.delete(res)); return;
  }
  if(path==='/notifications/unread-count'){send({unreadCount:unread()});return;}
  if(path==='/notifications/read-all'&&method==='PATCH'){const updatedCount=unread();for(const row of notifications)row.readAt??=new Date().toISOString();broadcast('unread-count',{unreadCount:unread()});send({updatedCount});return;}
  if(path==='/notifications'){send(notifications);return;}
  const readNotification=path.match(/^\/notifications\/([^/]+)\/read$/);
  if(readNotification&&method==='PATCH'){const row=notifications.find(item=>item.notificationId===readNotification[1]);if(!row){send('Not found',404);return;}row.readAt??=new Date().toISOString();broadcast('unread-count',{unreadCount:unread()});send(row);return;}
  if(path==='/__ui/emit'&&method==='POST'){const row={...notifications[0],notificationId:randomUUID(),title:'Cập nhật trực tiếp kiểm thử',createdAt:new Date().toISOString(),readAt:null};notifications.unshift(row);broadcast('notification',{notification:row,unreadCount:unread()});send({emitted:true});return;}

  if(path.endsWith('/cruise-package-entitlements')){send([{grantId:ids.package,bookingPassengerId:ids.bp,benefitName:'Quyền lợi trà kiểm thử',inclusion:'LIMITED_INCLUDED',sourcePackageName:'Gói kiểm thử cục bộ',grantedAt:'2026-11-01T00:00:00Z',status:'ACTIVE',usagePolicy:null,usageUnit:null,serviceUnitCode:'VISIT',grantedQuantity:3,usedQuantity:1,remainingQuantity:2,requiresReservation:true,usageStartsAt:null,usageEndsAt:null,occurrences:[{resourceType:'SERVICE',resourceId:ids.service,name:service.name}],registrations:[],blockers:[],canRegister:true}]);return;}
  if(path==='/booking'&&method==='GET'){send(page(bookings));return;}
  if(path.startsWith('/payment/booking/')&&method==='GET'){const bookingId=path.split('/').at(-1);send(bookings.some(b=>b.bookingId===bookingId)?[{paymentId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',bookingId,operationType:'Collect',requestedAmount:400,confirmedAmount:400,currency:'USD',status:'Confirmed',confirmedAt:'2026-11-10T00:00:00Z'}]:[]);return;}
  if(path==='/booking'&&method!=='GET'){send('Ticket booking is not supported in Mobile',405);return;}
  const matchBooking=path.match(/^\/booking\/([^/]+)(\/cancel)?$/);
  if(matchBooking){const b=bookings.find(b=>b.bookingId===matchBooking[1]);if(!b){send('Not found',404);return;}if(method==='POST'){b.bookingStatus='Cancelled';b.cancellationReason=body.reason;}send(b);return;}
  if(path==='/cruise'){send(page([cruise]));return;}
  if(path.startsWith('/cruise/')){send(cruise);return;}
  const itinerary={itineraryId:ids.itinerary,cruiseId:ids.cruise,itineraryName:'Hải trình kiểm thử',startDate:'2027-11-01',endDate:'2027-11-04',status:'ACTIVE'};
  if(path==='/itineraries/mine'){send(bookings.filter(b=>b.bookingStatus==='Confirmed').map(b=>({...b,bookingPassengerId:b.passengers[0].bookingPassengerId,participationStatus:'Active',cruiseStatus:cruise.status,itineraryId:ids.itinerary,itineraryStatus:'ACTIVE',startDate:itinerary.startDate,endDate:itinerary.endDate})));return;}
  if(path==='/itineraries'){send(page([itinerary]));return;}
  if(path.endsWith('/days')){send([
    {itineraryDayId:'12121212-1212-4212-8212-121212121212',itineraryId:ids.itinerary,dayNumber:1,date:'2027-11-01',dayType:'PORT_DAY',shipTimeZoneId:'Asia/Singapore',description:'Ngày tại cảng kiểm thử'},
    {itineraryDayId:'13131313-1313-4313-8313-131313131313',itineraryId:ids.itinerary,dayNumber:2,date:'2027-11-02',dayType:'SEA_DAY',shipTimeZoneId:'Asia/Bangkok',description:'Ngày trên biển kiểm thử'}]);return;}
  if(path.startsWith('/itineraries/')){send(itinerary);return;}
  if(path.startsWith('/itinerary-change-history/')){send([]);return;}
  if(path.startsWith('/cruise-stops/by-itinerary/')){send([{cruiseStopId:ids.stop,itineraryId:ids.itinerary,status:'PLANNED',stopOrder:1,portName:'Cảng kiểm thử',portTimeZoneId:'Asia/Tokyo',arrivalItineraryDayId:ids.stop}]);return;}
  if(path==='/shore-excursions'){send([excursion]);return;}
  if(path.startsWith('/shore-excursions/')){send(excursion);return;}
  if(path==='/servicepackage/services'){send([service]);return;}
  if(path.endsWith('/availability')&&path.startsWith('/servicepackage/')){send({serviceId:ids.service,requestedQuantity:Number(url.searchParams.get('quantity')||1),available:true});return;}
  if(path===`/servicepackage/services/${ids.service}/schedules`){send([{id:ids.cabin,serviceId:ids.service,cruiseId:ids.cruise,startsAt:activity.startTime,endsAt:activity.endTime,location:'Sảnh kiểm thử',capacity:20,remainingCapacity:20,status:'OPEN',timeZoneId:'Asia/Tokyo'}]);return;}
  if(path===`/servicepackage/services/${ids.service}`){send(service);return;}
  if(path==='/servicepackage/requests/by-operation-key'){const row=requests.find(r=>r.idempotencyKey===url.searchParams.get('key'));send(row??'Not found',row?200:404);return;}
  if(path==='/servicepackage/requests'){
    if(method==='POST'){const prior=requests.find(r=>r.idempotencyKey===body.idempotencyKey);if(prior){send(prior);return;}requests.push({...body,id:randomUUID(),passengerId:ids.user,bookingId:ids.booking,scheduleId:body.serviceScheduleId,unitPriceSnapshot:service.price,currencySnapshot:service.currency,status:'REQUESTED',requestTime:new Date().toISOString(),completedAt:null});}send(method==='POST'?requests.at(-1):requests,method==='POST'?201:200);return;
  }
  const request=path.match(/^\/servicepackage\/requests\/([^/]+)(\/cancel)?$/);
  if(request){const row=requests.find(r=>r.id===request[1]);if(!row){send('Not found',404);return;}if(method==='PUT')Object.assign(row,body);if(request[2])row.status='CANCELLED';send(row);return;}
  if(path===`/activities/${ids.activity}`){send(activity);return;}
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
}).listen(Number(process.env.UI_FIXTURE_PORT ?? 18085),'127.0.0.1',()=>console.log('In-memory passenger UI fixture ready on port '+Number(process.env.UI_FIXTURE_PORT ?? 18085)+'; no real data'));
