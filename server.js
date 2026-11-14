require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT = 3000 } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

// The service role key stays on the server only. Never put it in public/ files.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TABLE = 'patients';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Validation ----------
function validate(body) {
  const errors = [];
  const full_name = String(body.full_name || '').trim();
  const contact_number = String(body.contact_number || '').trim();
  const address = String(body.address || '').trim();
  const gender = String(body.gender || '').trim();
  const age = Number(body.age);

  if (!full_name) errors.push('Full name is required.');
  if (!Number.isInteger(age) || age < 0 || age > 130) errors.push('Age must be a whole number from 0 to 130.');
  if (!['Male', 'Female', 'Other'].includes(gender)) errors.push('Choose a gender.');
  if (!/^[0-9+\-\s()]{7,20}$/.test(contact_number)) errors.push('Contact number must be 7–20 digits (numbers, +, -, spaces).');
  if (!address) errors.push('Address is required.');
  return { errors, data: { full_name, age, gender, contact_number, address } };
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ errors: ['Database error. Check the server console.'] });
  });

const validId = (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.status(400).json({ errors: ['Invalid patient ID.'] }); return false; }
  return true;
};

// ---------- API ----------
// List all, or search by name (?search=)
app.get('/api/patients', wrap(async (req, res) => {
  const q = String(req.query.search || '').trim().replace(/[%_\\]/g, '\\$&');
  let query = supabase.from(TABLE).select('*').order('full_name');
  if (q) query = query.ilike('full_name', `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

// Get one
app.get('/api/patients/:id', wrap(async (req, res) => {
  if (!validId(req, res)) return;
  const { data, error } = await supabase.from(TABLE).select('*').eq('patient_id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ errors: ['Patient not found.'] });
  res.json(data);
}));

// Register
app.post('/api/patients', wrap(async (req, res) => {
  const { errors, data: row } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

// Edit
app.put('/api/patients/:id', wrap(async (req, res) => {
  if (!validId(req, res)) return;
  const { errors, data: row } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const { data, error } = await supabase.from(TABLE).update(row).eq('patient_id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ errors: ['Patient not found.'] });
  res.json(data);
}));

// Delete
app.delete('/api/patients/:id', wrap(async (req, res) => {
  if (!validId(req, res)) return;
  const { data, error } = await supabase.from(TABLE).delete().eq('patient_id', req.params.id).select();
  if (error) throw error;
  if (!data.length) return res.status(404).json({ errors: ['Patient not found.'] });
  res.json({ deleted: true });
}));

app.listen(PORT, () => console.log(`Clinic Patient Records running at http://localhost:${PORT}`));
