-- Run this in Supabase: SQL Editor > New query > paste > Run

create table if not exists public.patients (
  patient_id     bigint generated always as identity primary key,
  full_name      text    not null,
  age            integer not null check (age between 0 and 130),
  gender         text    not null check (gender in ('Male', 'Female', 'Other')),
  contact_number text    not null,
  address        text    not null
);

-- Lock the table: only the server (service_role key) can read/write it.
-- The browser never talks to Supabase directly, so patient data is not public.
alter table public.patients enable row level security;