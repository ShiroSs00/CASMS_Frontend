import ship from '../assets/ship.png'
import kayak from '../assets/kayak.png'
import type { ArrivalSlot, Booking, CabinCategory, Cruise, ExperiencePackage, Passenger } from './booking-types'
export const cruiseFixtures: Cruise[] = [
 { id:'ha-long-lan-ha',title:'Hạ Long — Lan Hạ',ship:'Ocean Voyager',duration:3,departure:'2026-11-20',end:'2026-11-22',port:'Tuần Châu',route:'Tuần Châu → Lan Hạ → Hạ Long',price:4800000,image:ship,available:true,balcony:true },
 { id:'cat-ba-lan-ha',title:'Cát Bà — Lan Hạ',ship:'Aurora Dawn',duration:4,departure:'2026-11-27',end:'2026-11-30',port:'Tuần Châu',route:'Tuần Châu → Cát Bà → Lan Hạ',price:6200000,image:kayak,available:true,balcony:true },
 { id:'ha-long-signature',title:'Hạ Long Signature',ship:'Ocean Voyager',duration:2,departure:'2026-12-02',end:'2026-12-03',port:'Hòn Gai',route:'Hòn Gai → Hạ Long → Tuần Châu',price:3900000,image:ship,available:true,balcony:false },
]
export const cabinFixtures: CabinCategory[] = [
 { id:'deluxe',name:'Deluxe Ocean View',area:24,capacity:2,price:4800000,description:'Cửa sổ lớn · Double/Twin · phòng tắm riêng' },
 { id:'balcony',name:'Balcony',area:30,capacity:2,price:5800000,description:'Ban công riêng · khu ngồi · tầm nhìn mở' },
]
export const packageFixtures: ExperiencePackage[] = [
 { id:'Essential',price:0,kind:'INCLUDED',description:'Bữa ăn tiêu chuẩn · dịch vụ cơ bản' },
 { id:'Plus',price:900000,kind:'OPTIONAL',description:'Wi-Fi · 1 dining đặc biệt · kayak' },
 { id:'Premium',price:1800000,kind:'OPTIONAL',description:'Wi-Fi 2 thiết bị · spa credit · tour bờ' },
]
export const passengerFixtures: Passenger[] = [
 { id:'sample-passenger-1',name:'Nguyễn Minh Anh',birthDate:'1999-08-12',email:'minh.anh@example.com',phone:'+84 90 123 4567',surname:'NGUYEN',givenName:'MINH ANH',nationality:'Việt Nam',documentType:'Hộ chiếu',documentMasked:'••••4567',issued:'2024-08-12',expires:'2034-08-12',documentReady:false,checkin:'InProgress' },
 { id:'sample-passenger-2',name:'Trần Mai Chi',birthDate:'1996-09-07',email:'',phone:'',surname:'TRAN',givenName:'MAI CHI',nationality:'Việt Nam',documentType:'CCCD',documentMasked:'••••0123',issued:'2024-01-01',expires:'2034-01-01',documentReady:true,checkin:'Completed' },
]
export const bookingFixtures: Booking[] = [
 { id:'sample-1842',reference:'AUR-2026-001842',cruiseId:'ha-long-lan-ha',status:'Confirmed',fare:11400000,currency:'VND',requestedCategory:'Deluxe Ocean View',packageName:'Plus',passengers:passengerFixtures,payment:'Confirmed',paid:11400000,contract:'Accepted',preparationDone:3 },
 { id:'sample-1843',reference:'AUR-2026-001843',cruiseId:'cat-ba-lan-ha',status:'Draft',fare:12400000,currency:'VND',requestedCategory:'Deluxe Ocean View',packageName:'Essential',passengers:passengerFixtures,payment:'Pending',paid:0,contract:'Draft',preparationDone:0 },
]
export const arrivalFixtures:ArrivalSlot[] = [{id:'early',label:'10:30–11:00',availability:'available'},{id:'middle',label:'11:00–11:30',availability:'available'},{id:'late',label:'11:30–12:00',availability:'unavailable'}]
export const itineraryFixtures = [
 ['Tuần Châu → Lan Hạ','Lên tàu, bữa trưa, khám phá vịnh và hoàng hôn trên boong.'],
 ['Lan Hạ','Kayak / hoạt động theo lịch vận hành, thời gian tự do và trải nghiệm trên tàu.'],
 ['Lan Hạ → Tuần Châu','Bữa sáng, trả cabin và kết thúc hành trình.'],
]
export const emergencyFixture = { name:'Nguyễn Văn Bình',relationship:'Người thân',country:'+84',phone:'090 123 4567' }

