const $ = (id) => document.getElementById(id);
const rowsEl = $("rows"),
  emptyEl = $("empty"),
  searchEl = $("search");
const formDialog = $("formDialog"),
  deleteDialog = $("deleteDialog");
let pendingDelete = null;

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function highlight(name, q) {
  const safe = esc(name);
  if (!q) return safe;
  const re = new RegExp(
    "(" + esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
    "ig",
  );
  return safe.replace(re, "<mark>$1</mark>");
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2400);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw body.errors || ["Something went wrong. Try again."];
  return body;
}

async function updateStats() {
  const all = await api("/api/patients");
  $("statTotal").textContent = all.length;
  $("statAge").textContent = all.length
    ? Math.round(all.reduce((s, p) => s + p.age, 0) / all.length)
    : "–";
  for (const g of ["Female", "Male", "Other"]) {
    $("stat" + g).textContent = all.filter((p) => p.gender === g).length;
  }
}

async function load() {
  const q = searchEl.value.trim();
  const patients = await api("/api/patients?search=" + encodeURIComponent(q));
  rowsEl.innerHTML = patients
    .map(
      (p) => `
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
    </tr>`,
    )
    .join("");
  emptyEl.hidden = patients.length > 0;
  emptyEl.textContent = q
    ? `No patients match “${q}”. Check the spelling or clear the search.`
    : "No patients yet. Select “Register patient” to add the first one.";
  updateStats();
}

function openForm(patient) {
  $("patientForm").reset();
  $("formErrors").hidden = true;
  $("formTitle").textContent = patient ? "Edit patient" : "Register patient";
  $("patientId").value = patient ? patient.patient_id : "";
  if (patient)
    for (const k of ["full_name", "age", "gender", "contact_number", "address"])
      $(k).value = patient[k];
  formDialog.showModal();
  $("full_name").focus();
}

$("addBtn").onclick = () => openForm();
$("cancelBtn").onclick = () => formDialog.close();

$("patientForm").onsubmit = async (e) => {
  e.preventDefault();
  const id = $("patientId").value;
  const payload = {};
  for (const k of ["full_name", "age", "gender", "contact_number", "address"])
    payload[k] = $(k).value;
  try {
    await api(id ? "/api/patients/" + id : "/api/patients", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    formDialog.close();
    toast(id ? "Patient updated" : "Patient registered");
    load();
  } catch (errors) {
    const ul = $("formErrors");
    ul.innerHTML = errors.map((m) => `<li>${esc(m)}</li>`).join("");
    ul.hidden = false;
  }
};

rowsEl.onclick = async (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  if (edit) openForm(await api("/api/patients/" + edit.dataset.edit));
  if (del) {
    pendingDelete = del.dataset.delete;
    $("deleteText").textContent =
      `${del.dataset.name} will be removed permanently.`;
    deleteDialog.showModal();
  }
};

$("deleteCancel").onclick = () => deleteDialog.close();
$("deleteConfirm").onclick = async () => {
  await api("/api/patients/" + pendingDelete, { method: "DELETE" });
  deleteDialog.close();
  toast("Patient deleted");
  load();
};

let timer;
searchEl.oninput = () => {
  clearTimeout(timer);
  timer = setTimeout(load, 200);
};

load();

// ---------- Address suggestions ----------
const addressEl = $("address"),
  suggestEl = $("addressSuggest");
let suggestTimer,
  suggestSeq = 0,
  suggestions = [],
  activeIdx = -1;

function hideSuggest() {
  suggestSeq++;
  suggestEl.hidden = true;
  suggestEl.innerHTML = "";
  suggestions = [];
  activeIdx = -1;
  addressEl.setAttribute("aria-expanded", "false");
  addressEl.removeAttribute("aria-activedescendant");
}

function showSuggest(list) {
  if (!list.length) return hideSuggest();
  suggestions = list;
  activeIdx = -1;
  suggestEl.innerHTML =
    list
      .map(
        (label, i) =>
          `<li role="option" id="sug-${i}" data-i="${i}">${esc(label)}</li>`,
      )
      .join("") +
    '<li class="suggest-credit" aria-hidden="true">Suggestions from OpenStreetMap</li>';
  suggestEl.hidden = false;
  addressEl.setAttribute("aria-expanded", "true");
}

function setActive(i) {
  const items = suggestEl.querySelectorAll('[role="option"]');
  items.forEach((el, n) => el.classList.toggle("active", n === i));
  activeIdx = i;
  addressEl.setAttribute("aria-activedescendant", "sug-" + i);
  items[i].scrollIntoView({ block: "nearest" });
}

function pickSuggestion(i) {
  addressEl.value = suggestions[i];
  hideSuggest();
  addressEl.focus();
}

addressEl.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  const q = addressEl.value.trim();
  if (q.length < 2) return hideSuggest();
  suggestTimer = setTimeout(async () => {
    const seq = ++suggestSeq;
    try {
      const list = await api("/api/places?q=" + encodeURIComponent(q));
      if (seq === suggestSeq && document.activeElement === addressEl)
        showSuggest(list);
    } catch {
      /* typing the address by hand still works */
    }
  }, 300);
});

addressEl.addEventListener("keydown", (e) => {
  if (suggestEl.hidden) return;
  const n = suggestions.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActive((activeIdx + 1) % n);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive(activeIdx <= 0 ? n - 1 : activeIdx - 1);
  } else if (e.key === "Enter" && activeIdx >= 0) {
    e.preventDefault();
    pickSuggestion(activeIdx);
  } else if (e.key === "Escape") {
    e.preventDefault();
    hideSuggest();
  }
});

suggestEl.addEventListener("mousedown", (e) => {
  const li = e.target.closest("[data-i]");
  if (!li) return;
  e.preventDefault();
  pickSuggestion(Number(li.dataset.i));
});

addressEl.addEventListener("blur", hideSuggest);
formDialog.addEventListener("close", hideSuggest);
