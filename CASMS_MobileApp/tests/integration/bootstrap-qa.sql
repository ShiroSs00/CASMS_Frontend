\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'casms_mobile_qa' THEN RAISE EXCEPTION 'Restricted to casms_mobile_qa'; END IF;
  -- These named PostgreSQL types are required by the existing entity mappings.
  -- Definitions match V1__initial_schema.sql; no production migration is changed.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='OperationalIssue_issue_type') THEN
    CREATE TYPE "OperationalIssue_issue_type" AS ENUM ('WEATHER','TECHNICAL','CABIN','SAFETY','OPERATIONAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='OperationalIssue_severity') THEN
    CREATE TYPE "OperationalIssue_severity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='OperationalIssue_status') THEN
    CREATE TYPE "OperationalIssue_status" AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
  END IF;
END $$;
