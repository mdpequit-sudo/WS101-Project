const $ = (id) => document.getElementById(id);
const rowsEl = $('rows'), emptyEl = $('empty'), searchEl = $('search');
const formDialog = $('formDialog'), deleteDialog = $('deleteDialog');
let pendingDelete = null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function highlight(name, q) {
  const safe = esc(name);
  if (!q) return safe;
  const re = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw body.errors || ['Something went wrong. Try again.'];
  return body;
}

async function updateStats() {
  const all = await api('/api/patients');
  $('statTotal').textContent = all.length;
  $('statAge').textContent = all.length ? Math.round(all.reduce((s, p) => s + p.age, 0) / all.length) : '–';
  for (const g of ['Female', 'Male', 'Other']) {
    $('stat' + g).textContent = all.filter((p) => p.gender === g).length;
  }
}

async function load() {
  const q = searchEl.value.trim();
  const patients = await api('/api/patients?search=' + encodeURIComponent(q));
  rowsEl.innerHTML = patients.map((p) => `
    <tr>
      <td class="id">${p.patient_id}</td>
      <td class="name">${highlight(p.full_name, q)}</td>
      <td class="num">${p.age}</td>
      <td>${esc(p.gender)}</td>
      <td>${esc(p.contact_number)}</td>
      <td>${esc(p.address)}</td>
      <td><div class="actions">
        <button class="btn small" data-edit="${p.patient_id}">Edit</button>
        <button class="btn small danger-text" data-delete="${p.patient_id}" data-name="${esc(p.full_name)}">Delete</button>
      </div></td>
    </tr>`).join('');
  emptyEl.hidden = patients.length > 0;
  emptyEl.textContent = q ? `No patients match “${q}”. Check the spelling or clear the search.` : 'No patients yet. Select “Register patient” to add the first one.';
  updateStats();
}

function openForm(patient) {
  $('patientForm').reset();
  $('formErrors').hidden = true;
  $('formTitle').textContent = patient ? 'Edit patient' : 'Register patient';
  $('patientId').value = patient ? patient.patient_id : '';
  if (patient) for (const k of ['full_name', 'age', 'gender', 'contact_number', 'address']) $(k).value = patient[k];
  formDialog.showModal();
  $('full_name').focus();
}

$('addBtn').onclick = () => openForm();
$('cancelBtn').onclick = () => formDialog.close();

$('patientForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('patientId').value;
  const payload = {};
  for (const k of ['full_name', 'age', 'gender', 'contact_number', 'address']) payload[k] = $(k).value;
  try {
    await api(id ? '/api/patients/' + id : '/api/patients', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    formDialog.close();
    toast(id ? 'Patient updated' : 'Patient registered');
    load();
  } catch (errors) {
    const ul = $('formErrors');
    ul.innerHTML = errors.map((m) => `<li>${esc(m)}</li>`).join('');
    ul.hidden = false;
  }
};

rowsEl.onclick = async (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');
  if (edit) openForm(await api('/api/patients/' + edit.dataset.edit));
  if (del) {
    pendingDelete = del.dataset.delete;
    $('deleteText').textContent = `${del.dataset.name} will be removed permanently.`;
    deleteDialog.showModal();
  }
};

$('deleteCancel').onclick = () => deleteDialog.close();
$('deleteConfirm').onclick = async () => {
  await api('/api/patients/' + pendingDelete, { method: 'DELETE' });
  deleteDialog.close();
  toast('Patient deleted');
  load();
};

let timer;
searchEl.oninput = () => { clearTimeout(timer); timer = setTimeout(load, 200); };

load();
