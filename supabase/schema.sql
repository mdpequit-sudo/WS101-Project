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

-- Fictional sample data for classroom testing
insert into public.patients (full_name, age, gender, contact_number, address) values
  ('Maria Santos',     34, 'Female', '0917-555-0101', '12 Rizal St., Bislig City'),
  ('Juan Dela Cruz',   52, 'Male',   '0918-555-0102', '45 Mabini Ave., Bislig City'),
  ('Ana Reyes',         8, 'Female', '0919-555-0103', '7 Sampaguita Lane, Mangagoy'),
  ('Carlo Mendoza',    27, 'Male',   '0920-555-0104', '88 Narra Rd., Coleto'),
  ('Liza Villanueva',  61, 'Female', '0921-555-0105', '3 Acacia St., Maharlika'),
  ('Pedro Ramos',      45, 'Male',   '0922-555-0106', '19 Mahogany Dr., San Roque'),
  ('Grace Aquino',     19, 'Female', '0923-555-0107', '102 Bonifacio St., Poblacion'),
  ('Miguel Torres',    73, 'Male',   '0924-555-0108', '5 Ilang-Ilang Rd., Caramcam'),
  ('Sofia Navarro',     3, 'Female', '0925-555-0109', '60 Molave St., Mangagoy'),
  ('Alex Rivera',      39, 'Other',  '0926-555-0110', '27 Lauan Ave., Bucto');
