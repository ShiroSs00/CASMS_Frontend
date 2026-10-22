\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'casms_mobile_qa' THEN
    RAISE EXCEPTION 'This seed is restricted to casms_mobile_qa';
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO "User" (user_id,username,password_hash,email,status,created_at,updated_at)
VALUES ('b1000000-0000-4000-8000-000000000001','ocevie.staff.qa',crypt('OcevieStaffQa@2026',gen_salt('bf')),'staff@ocevie.example','ACTIVE',now(),now())
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO "UserRole" (user_id,role)
SELECT 'b1000000-0000-4000-8000-000000000001','ONBOARD_STAFF'
WHERE NOT EXISTS (SELECT 1 FROM "UserRole" WHERE user_id='b1000000-0000-4000-8000-000000000001' AND role='ONBOARD_STAFF');
COMMIT;
