-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. ENUMS (Enforcing strict state and severity)
create type incident_severity as enum ('SEV1', 'SEV2', 'SEV3', 'SEV4');
create type incident_status as enum ('DETECTED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'POSTMORTEM', 'CLOSED', 'ESCALATED');
create type user_role as enum ('ENGINEER', 'MANAGER', 'ADMIN');

-- 2. USERS TABLE
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text not null,
  role user_role not null default 'ENGINEER',
  created_at timestamptz default now()
);

-- 3. INCIDENTS TABLE
create table incidents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  severity incident_severity not null,
  status incident_status not null default 'DETECTED',
  owner_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. TIMELINE / AUDIT LOG (Immutable)
create table incident_events (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id) not null,
  actor_id uuid references users(id),
  event_type text not null, -- e.g., 'STATUS_CHANGE', 'COMMENT', 'ASSIGNMENT'
  old_value text,           -- Store previous state/assignee for audit
  new_value text,           -- Store new state/assignee
  comment text,
  created_at timestamptz default now()
);

-- Seed Data for Testing
INSERT INTO users (email, full_name, role) VALUES
('alex.admin@company.com', 'Alex Rivera', 'ADMIN'),
('sarah.ops@company.com', 'Sarah Chen', 'MANAGER'),
('jordan.dev@company.com', 'Jordan Smyth', 'ENGINEER');

INSERT INTO incidents (title, description, severity, status, owner_id)
VALUES 
(
  'Main API Gateway Timeout', 
  'Latency spikes across all regions. Users reporting 504 Gateway Timeouts.', 
  'SEV1', 
  'INVESTIGATING', 
  (SELECT id FROM users WHERE email = 'jordan.dev@company.com')
),
(
  'Internal Dashboard CSS Glitch', 
  'CSS files failing to load on the internal metrics dashboard.', 
  'SEV3', 
  'RESOLVED', 
  (SELECT id FROM users WHERE email = 'sarah.ops@company.com')
);

DO $$
DECLARE
    v_incident_id uuid;
    v_jordan_id uuid;
    v_sarah_id uuid;
BEGIN
    -- Get IDs for foreign keys
    SELECT id INTO v_incident_id FROM incidents WHERE title = 'Main API Gateway Timeout' LIMIT 1;
    SELECT id INTO v_jordan_id FROM users WHERE email = 'jordan.dev@company.com' LIMIT 1;
    SELECT id INTO v_sarah_id FROM users WHERE email = 'sarah.ops@company.com' LIMIT 1;

    -- 1. Initial Detection (System Event)
    INSERT INTO incident_events (incident_id, actor_id, event_type, old_value, new_value, comment)
    VALUES (v_incident_id, NULL, 'STATUS_CHANGE', NULL, 'DETECTED', 'System monitoring triggered an alert.');

    -- 2. Sarah (Manager) assigns it to Jordan
    INSERT INTO incident_events (incident_id, actor_id, event_type, old_value, new_value, comment)
    VALUES (v_incident_id, v_sarah_id, 'ASSIGNMENT', NULL, 'Jordan Smyth', 'Assigning to Jordan for triage.');

    -- 3. Jordan starts investigating
    INSERT INTO incident_events (incident_id, actor_id, event_type, old_value, new_value, comment)
    VALUES (v_incident_id, v_jordan_id, 'STATUS_CHANGE', 'DETECTED', 'INVESTIGATING', 'Looking into the load balancer logs now.');

    -- 4. A comment update
    INSERT INTO incident_events (incident_id, actor_id, event_type, comment)
    VALUES (v_incident_id, v_jordan_id, 'COMMENT', 'Identified a memory leak in the auth-middleware container.');
END $$;

SELECT 
    i.title,
    e.created_at,
    u.full_name as actor,
    e.event_type,
    e.comment
FROM incident_events e
JOIN incidents i ON e.incident_id = i.id
LEFT JOIN users u ON e.actor_id = u.id
ORDER BY e.created_at ASC;