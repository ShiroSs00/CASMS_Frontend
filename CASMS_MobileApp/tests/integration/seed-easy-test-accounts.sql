\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'casms_mobile_qa' THEN
    RAISE EXCEPTION 'This seed is restricted to casms_mobile_qa';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE username IN ('khachtest','stafftest') AND user_id NOT IN ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002')) THEN
    RAISE EXCEPTION 'Test username belongs to another account; nothing was changed';
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO "User" (user_id,username,password_hash,email,status,created_at,updated_at)
VALUES
('c1000000-0000-4000-8000-000000000001','khachtest',crypt('Test123456!',gen_salt('bf')),'khachtest@ocevie.example','ACTIVE',now(),now()),
('c1000000-0000-4000-8000-000000000002','stafftest',crypt('Test123456!',gen_salt('bf')),'stafftest@ocevie.example','ACTIVE',now(),now())
ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='ACTIVE',updated_at=now();
INSERT INTO "UserRole" (user_id,role)
SELECT uid::uuid,role FROM (VALUES
('c1000000-0000-4000-8000-000000000001','PASSENGER'),
('c1000000-0000-4000-8000-000000000002','ONBOARD_STAFF')) AS roles(uid,role)
WHERE NOT EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur.user_id=uid::uuid AND ur.role=roles.role);
INSERT INTO "Passenger" (passenger_id,user_id,full_name,email,nationality,created_at)
VALUES ('c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','Khách thử nghiệm','khachtest@ocevie.example','VN',now())
ON CONFLICT (passenger_id) DO NOTHING;
INSERT INTO "Booking" (booking_id,booking_reference,booking_status,booked_by_user_id,cruise_id,agreed_fare_amount,currency,required_deposit_amount,created_at,confirmed_at,representative_booking_passenger_id)
VALUES ('c1000000-0000-4000-8000-000000000011','TEST-001','Confirmed','c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000031',420,'USD',126,now(),now(),NULL)
ON CONFLICT (booking_id) DO NOTHING;
INSERT INTO "BookingPassenger" (booking_passenger_id,booking_id,passenger_id,participation_status,requested_cabin_category)
VALUES ('c1000000-0000-4000-8000-000000000012','c1000000-0000-4000-8000-000000000011','c1000000-0000-4000-8000-000000000003','Active','INTERIOR')
ON CONFLICT (booking_passenger_id) DO NOTHING;
UPDATE "Booking" SET representative_booking_passenger_id='c1000000-0000-4000-8000-000000000012'
WHERE booking_id='c1000000-0000-4000-8000-000000000011' AND representative_booking_passenger_id IS NULL;
INSERT INTO "CabinAssignment" (cabin_assignment_id,booking_passenger_id,cabin_id,assigned_by_user_id,valid_from)
VALUES ('c1000000-0000-4000-8000-000000000013','c1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000002',now())
ON CONFLICT (cabin_assignment_id) DO NOTHING;
INSERT INTO "BookingPassengerPackage" (booking_passenger_id,tour_package_id,assigned_at,agreed_price,currency)
VALUES ('c1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000131',now(),120,'USD')
ON CONFLICT (booking_passenger_id) DO NOTHING;
INSERT INTO "ServiceRequest" (service_request_id,passenger_id,service_id,booking_id,booking_passenger_id,quantity,note,status,request_time,created_at,updated_at)
VALUES ('c1000000-0000-4000-8000-000000000021','c1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000091','c1000000-0000-4000-8000-000000000011','c1000000-0000-4000-8000-000000000012',1,'Yêu cầu thử nghiệm cho khachtest và stafftest','REQUESTED',now(),now(),now())
ON CONFLICT (service_request_id) DO NOTHING;
COMMIT;
