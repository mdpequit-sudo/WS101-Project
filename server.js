require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT = 3000 } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const TABLE = "patients";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validate(body) {
  const errors = [];
  const full_name = String(body.full_name || "").trim();
  const contact_number = String(body.contact_number || "").trim();
  const address = String(body.address || "").trim();
  const gender = String(body.gender || "").trim();
  const age = Number(body.age);

  if (!full_name) errors.push("Full name is required.");
  if (!Number.isInteger(age) || age < 0 || age > 130)
    errors.push("Age must be a whole number from 0 to 130.");
  if (!["Male", "Female", "Other"].includes(gender))
    errors.push("Choose a gender.");
  if (!/^[0-9+\-\s()]{7,20}$/.test(contact_number))
    errors.push("Contact number must be 7–20 digits (numbers, +, -, spaces).");
  if (!address) errors.push("Address is required.");
  return { errors, data: { full_name, age, gender, contact_number, address } };
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res
      .status(500)
      .json({ errors: ["Database error. Check the server console."] });
  });

const validId = (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ errors: ["Invalid patient ID."] });
    return false;
  }
  return true;
};

// List all (sorted by Patient ID), or search by name (?search=)
app.get(
  "/api/patients",
  wrap(async (req, res) => {
    const q = String(req.query.search || "")
      .trim()
      .replace(/[%_\\]/g, "\\$&");
    let query = supabase
      .from(TABLE)
      .select("*")
      .order("patient_id", { ascending: true });
    if (q) query = query.ilike("full_name", `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  }),
);

// Get one
app.get(
  "/api/patients/:id",
  wrap(async (req, res) => {
    if (!validId(req, res)) return;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("patient_id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ errors: ["Patient not found."] });
    res.json(data);
  }),
);

// Register
app.post(
  "/api/patients",
  wrap(async (req, res) => {
    const { errors, data: row } = validate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const { data, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  }),
);

// Edit
app.put(
  "/api/patients/:id",
  wrap(async (req, res) => {
    if (!validId(req, res)) return;
    const { errors, data: row } = validate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const { data, error } = await supabase
      .from(TABLE)
      .update(row)
      .eq("patient_id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ errors: ["Patient not found."] });
    res.json(data);
  }),
);

// Delete
app.delete(
  "/api/patients/:id",
  wrap(async (req, res) => {
    if (!validId(req, res)) return;
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("patient_id", req.params.id)
      .select();
    if (error) throw error;
    if (!data.length)
      return res.status(404).json({ errors: ["Patient not found."] });
    res.json({ deleted: true });
  }),
);

// ---------- Address suggestions (OpenStreetMap data via Photon) ----------
const placeCache = new Map();

function placeLabel(p) {
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const parts = [
    p.name,
    street,
    p.district,
    p.city || p.county,
    p.state,
  ].filter(Boolean);
  const seen = new Set();
  return parts
    .filter((x) => !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
    .join(", ");
}

app.get("/api/places", async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 100);
  if (q.length < 2) return res.json([]);

  const key = q.toLowerCase();
  if (placeCache.has(key)) return res.json(placeCache.get(key));

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("lang", "en");
    url.searchParams.set("lat", "7.19"); // bias toward Mindanao
    url.searchParams.set("lon", "125.46");
    url.searchParams.set("bbox", "116.9,4.5,126.7,21.2"); // Philippines only

    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return res.json([]);
    const json = await r.json();

    const labels = [
      ...new Set(
        (json.features || [])
          .map((f) => placeLabel(f.properties))
          .filter(Boolean),
      ),
    ];
    if (placeCache.size > 300) placeCache.clear();
    placeCache.set(key, labels);
    res.json(labels);
  } catch (err) {
    res.json([]); // if the service is down, typing the address by hand still works
  }
});

app.listen(PORT, () =>
  console.log(`Clinic Patient Records running at http://localhost:${PORT}`),
);
