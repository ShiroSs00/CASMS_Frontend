\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'casms_mobile_qa' THEN
    RAISE EXCEPTION 'This seed is restricted to casms_mobile_qa';
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Synthetic QA records stored in PostgreSQL and served by the real Spring API.
-- No application fallback imports or returns these records.
INSERT INTO "User" (user_id,username,password_hash,email,status,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000001','ocevie.mobile.qa',crypt('OcevieQa@2026',gen_salt('bf')),'passenger@ocevie.example','ACTIVE',now(),now())
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO "UserRole" (user_id,role)
SELECT 'a1000000-0000-4000-8000-000000000001','PASSENGER'
WHERE NOT EXISTS (SELECT 1 FROM "UserRole" WHERE user_id='a1000000-0000-4000-8000-000000000001' AND role='PASSENGER');
INSERT INTO "Passenger" (passenger_id,user_id,full_name,email,nationality,created_at)
VALUES ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Linh Nguyễn','passenger@ocevie.example','VN',now()) ON CONFLICT DO NOTHING;
INSERT INTO "Ship" (ship_id,ship_code,ship_name,status,total_capacity,total_decks,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000003','QA-OCEVIE-ASIA','OceVie Horizon','ACTIVE',1200,13,now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "Deck" (deck_id,ship_id,deck_number,deck_name,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000003',8,'Ocean Deck',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "Cabin" (cabin_id,ship_id,deck_id,cabin_number,cabin_type,capacity,is_accessible,status,created_at,updated_at)
SELECT ('a1000000-0000-4000-8000-'||lpad((5+i)::text,12,'0'))::uuid,'a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004',num,kind,capacity,false,'AVAILABLE',now(),now()
FROM (VALUES (0,'801','BALCONY',2),(1,'802','SUITE',3),(2,'803','OCEAN_VIEW',2),(3,'804','INTERIOR',2)) AS c(i,num,kind,capacity) ON CONFLICT DO NOTHING;
INSERT INTO "Destination" (destination_id,destination_name,country_code,status,created_at,updated_at)
SELECT ('a1000000-0000-4000-8000-'||lpad((11+i)::text,12,'0'))::uuid,name,country,'ACTIVE',now(),now()
FROM (VALUES (0,'Singapore','SG'),(1,'Kuala Lumpur','MY'),(2,'Penang','MY'),(3,'Phuket','TH')) AS d(i,name,country) ON CONFLICT DO NOTHING;
INSERT INTO "Port" (port_id,destination_id,port_code,port_name,country_code,time_zone_id,status,created_at,updated_at)
SELECT ('a1000000-0000-4000-8000-'||lpad((21+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((11+i)::text,12,'0'))::uuid,code,name,country,zone,'ACTIVE',now(),now()
FROM (VALUES (0,'SGSIN-QA','Marina Bay Cruise Centre Singapore','SG','Asia/Singapore'),(1,'MYPKG-QA','Port Klang','MY','Asia/Kuala_Lumpur'),(2,'MYPEN-QA','Swettenham Pier Cruise Terminal','MY','Asia/Kuala_Lumpur'),(3,'THHKT-QA','Phuket','TH','Asia/Bangkok')) AS p(i,code,name,country,zone) ON CONFLICT DO NOTHING;
INSERT INTO "Cruise" (cruise_id,cruise_code,cruise_name,cruise_type,ship_id,departure_port_id,return_port_id,departure_datetime,return_datetime,status,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000031','QA-ASIA-2027','Singapore • Malaysia • Phuket','MULTI_DAYS','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000024','2027-11-01T07:00:00Z','2027-11-04T03:00:00Z','PUBLISHED',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "Itinerary" (itinerary_id,cruise_id,itinerary_name,itinerary_type,start_date,end_date,status,created_by_user_id,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000032','a1000000-0000-4000-8000-000000000031','Hành trình eo biển Malacca','ONE_WAY','2027-11-01','2027-11-04','OPEN_FOR_SALE','a1000000-0000-4000-8000-000000000001',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "ItineraryDay" (itinerary_day_id,itinerary_id,day_number,date,day_type,ship_time_zone_id,description)
SELECT ('a1000000-0000-4000-8000-'||lpad((41+i)::text,12,'0'))::uuid,'a1000000-0000-4000-8000-000000000032',i+1,'2027-11-01'::date+i,'PORT_DAY',zone,name
FROM (VALUES (0,'Asia/Singapore','Khởi hành từ Singapore'),(1,'Asia/Kuala_Lumpur','Port Klang & Kuala Lumpur'),(2,'Asia/Kuala_Lumpur','Khám phá Penang'),(3,'Asia/Bangkok','Đến Phuket')) AS d(i,zone,name) ON CONFLICT DO NOTHING;
INSERT INTO "CruiseStop" (cruise_stop_id,itinerary_id,arrival_itinerary_day_id,departure_itinerary_day_id,port_id,destination_id,stop_order,call_type,arrival_method,planned_arrival,planned_departure,all_aboard_time,status)
SELECT ('a1000000-0000-4000-8000-'||lpad((51+i)::text,12,'0'))::uuid,'a1000000-0000-4000-8000-000000000032',('a1000000-0000-4000-8000-'||lpad((41+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((41+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((21+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((11+i)::text,12,'0'))::uuid,i+1,'NORMAL','BERTH',arrive::timestamptz,depart::timestamptz,aboard::timestamptz,'PLANNED'
FROM (VALUES (0,'2027-11-01T04:00Z','2027-11-01T07:00Z','2027-11-01T06:30Z'),(1,'2027-11-02T01:00Z','2027-11-02T09:00Z','2027-11-02T08:30Z'),(2,'2027-11-03T00:00Z','2027-11-03T08:00Z','2027-11-03T07:30Z'),(3,'2027-11-04T01:00Z','2027-11-04T03:00Z',NULL)) AS s(i,arrive,depart,aboard) ON CONFLICT DO NOTHING;
INSERT INTO "Booking" (booking_id,booking_reference,booking_status,booked_by_user_id,cruise_id,agreed_fare_amount,currency,required_deposit_amount,created_at,confirmed_at)
SELECT ('a1000000-0000-4000-8000-'||lpad((61+i)::text,12,'0'))::uuid,ref,status,'a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000031',fare,'USD',deposit,now(),confirmed
FROM (VALUES (0,'OCV-ASIA-001','Confirmed',780,234,now()),(1,'OCV-ASIA-002','Draft',1040,312,NULL::timestamptz)) AS b(i,ref,status,fare,deposit,confirmed) ON CONFLICT DO NOTHING;
INSERT INTO "BookingPassenger" (booking_passenger_id,booking_id,passenger_id,participation_status,requested_cabin_category)
SELECT ('a1000000-0000-4000-8000-'||lpad((71+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((61+i)::text,12,'0'))::uuid,'a1000000-0000-4000-8000-000000000002','Active',kind
FROM (VALUES(0,'BALCONY'),(1,'SUITE')) AS b(i,kind) ON CONFLICT DO NOTHING;
INSERT INTO "CabinAssignment" (cabin_assignment_id,booking_passenger_id,cabin_id,assigned_by_user_id,valid_from)
SELECT ('a1000000-0000-4000-8000-'||lpad((81+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((71+i)::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad((5+i)::text,12,'0'))::uuid,'a1000000-0000-4000-8000-000000000001',now()
FROM generate_series(0,1) AS i ON CONFLICT DO NOTHING;
INSERT INTO "Service" (service_id,service_code,service_name,service_type,description,price,currency_code,capacity,status,created_at,updated_at)
SELECT ('a1000000-0000-4000-8000-'||lpad((91+i)::text,12,'0'))::uuid,code,name,kind,description,price,'USD',30,'ACTIVE',now(),now()
FROM (VALUES (0,'QA-TEA','Trà chiều trên biển','DINING','Trà và bánh ngọt tại nhà hàng trên tàu.',18),(1,'QA-SPA','Ocean Spa','WELLNESS','Liệu trình thư giãn tại khu spa.',65),(2,'QA-LAUNDRY','Giặt ủi','LAUNDRY','Dịch vụ chăm sóc trang phục trong hành trình.',12)) AS s(i,code,name,kind,description,price) ON CONFLICT DO NOTHING;
INSERT INTO "OnboardActivity" (onboard_activity_id,cruise_id,activity_code,activity_name,description,location,start_time,end_time,capacity,price,currency_code,status,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000101','a1000000-0000-4000-8000-000000000031','QA-YOGA','Sunrise Yoga','Khởi đầu ngày mới với yoga trên biển.','Sun Deck','2027-11-02T23:00Z','2027-11-03T00:00Z',24,0,'USD','OPEN',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "Supplier" (supplier_id,supplier_name,contact_name,supplier_type,status,verification_status,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000111','OceVie Shore Experiences','Bộ phận tour','SHORE_EXCURSION','ACTIVE','VERIFIED',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "ShoreExcursion" (shore_excursion_id,cruise_stop_id,supplier_id,excursion_code,excursion_name,meeting_point,start_time,planned_return_time,maximum_capacity,minimum_participants,price,currency_code,status,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000121','a1000000-0000-4000-8000-000000000052','a1000000-0000-4000-8000-000000000111','QA-KUL','Khám phá Kuala Lumpur','Sảnh chính • Deck 4','2027-11-02T02:00Z','2027-11-02T05:30Z',30,1,55,'USD','OPEN',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "TourPackage" (tour_package_id,package_code,package_name,package_type,description,price,currency_code,start_date,end_date,status,created_at,updated_at)
VALUES ('a1000000-0000-4000-8000-000000000131','QA-OCEAN','Ocean Comfort','PREMIUM','Trà chiều, yoga và quyền lợi tham quan trong hành trình.',120,'USD','2027-01-01','2027-12-31','ACTIVE',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO "TourPackageService" (tour_package_id,service_id,benefit_type) VALUES ('a1000000-0000-4000-8000-000000000131','a1000000-0000-4000-8000-000000000091','INCLUDED') ON CONFLICT DO NOTHING;
INSERT INTO "TourPackageActivity" (tour_package_id,onboard_activity_id,benefit_type) VALUES ('a1000000-0000-4000-8000-000000000131','a1000000-0000-4000-8000-000000000101','INCLUDED') ON CONFLICT DO NOTHING;
INSERT INTO "TourPackageExcursion" (tour_package_id,shore_excursion_id,benefit_type) VALUES ('a1000000-0000-4000-8000-000000000131','a1000000-0000-4000-8000-000000000121','OPTIONAL') ON CONFLICT DO NOTHING;
INSERT INTO "ItineraryChangeHistory" (change_history_id,itinerary_id,changed_entity_type,changed_entity_id,change_type,change_summary,reason,changed_by_user_id,changed_at)
VALUES ('a1000000-0000-4000-8000-000000000141','a1000000-0000-4000-8000-000000000032','ITINERARY','a1000000-0000-4000-8000-000000000032','OTHER','Hải trình Singapore — Malaysia — Phuket','Lịch ghé cảng và múi giờ đã được cập nhật.','a1000000-0000-4000-8000-000000000001',now()) ON CONFLICT DO NOTHING;
COMMIT;
