# Clinic Patient Records System

Full-stack app: Node.js + Express (backend API), Supabase Postgres (database `patients`), HTML/CSS/JS dashboard (frontend).
Data is loaded live from Supabase on every action; nothing is hard-coded in the page.

## 1. Set up Supabase
1. Create a project at https://supabase.com
2. Open SQL Editor > New query, paste the contents of `supabase/schema.sql`, click Run.
   This creates the `patients` table and 10 fictional patients.
3. Open Project Settings > API and copy the Project URL and the `service_role` key.

## 2. Configure
Copy `.env.example` to `.env` and paste your values:
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...
Keep `.env` private. Never commit it or put the key in `public/`.

## 3. Run
    npm install
    npm start
Open http://localhost:3000

## Features
1. Register patients       POST   /api/patients
2. Display patient records GET    /api/patients
3. Edit patient info       PUT    /api/patients/:id
4. Delete patient records  DELETE /api/patients/:id
5. Search patients by name GET    /api/patients?search=name

## Table: patients
patient_id (PK, auto) | full_name | age | gender | contact_number | address
