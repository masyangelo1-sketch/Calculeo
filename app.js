"use strict";

const KEY = "magasin-stock-v1";
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r3 = n => Math.round(n * 1000) / 1000;
const fmt = n => r3(n).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
const norm = s => String(s).trim().toUpperCase();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = s => s.split("-").reverse().join("/");

let S = load();
let tab = "saisie";
let draft = { type: "in", date: today(), code: "" };
let hf = { code: "", type: "" };
let editing = null;
let q = "";

/* ---------- Données ---------- */
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.refs) && Array.isArray(d.moves)) return d;
  } catch (e) { /* données absentes ou illisibles */ }
  return { refs: [], moves: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast("Enregistrement impossible : le stockage de l’appareil est plein ou bloqué."); }
}
function tmap() {
  const m = new Map();
  for (const r of S.refs) m.set(r.code, { in: 0, out: 0, stock: 0 });
  for (const x of S.moves) { const t = m.get(x.code); if (t) t[x.type] += x.qty; }
  for (const r of S.refs) {
    const t = m.get(r.code);
    t.in = r3(t.in); t.out = r3(t.out); t.stock = r3(r.initial + t.in - t.out);
  }
  return m;
}
const totals = code => tmap().get(code) || { in: 0, out: 0, stock: 0 };

/* ---------- Affichage ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800);
}
function setTab(t) { tab = t; editing = null; render(); window.scrollTo(0, 0); }
function renderSum() {
  $("#sum").textContent = `${S.refs.length} référence${S.refs.length > 1 ? "s" : ""}, ${S.moves.length} mouvement${S.moves.length > 1 ? "s" : ""}`;
}
function render() {
  document.querySelectorAll("#tabs button").forEach(b =>
    b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  $("#view").innerHTML = { saisie: vSaisie, stock: vStock, histo: vHisto, calc: vCalc, refs: vRefs }[tab]();
  renderSum();
  if (tab === "saisie") updatePreview();
  if (tab === "calc") initCalc();
}

function moveRow(m, del) {
  const ref = S.refs.find(r => r.code === m.code);
  const u = ref && ref.unit ? " " + esc(ref.unit) : "";
  return `<div class="mv ${m.type}">
    <div><strong>${esc(m.code)}</strong> <span class="muted">${esc(ref ? ref.name : "")}</span>
    <div class="muted small">${fmtDate(m.date)}${m.note ? " : " + esc(m.note) : ""}</div></div>
    <div class="q">${m.type === "in" ? "+" : "−"}${fmt(m.qty)}${u}</div>
    ${del ? `<button type="button" class="ico" data-act="del-move" data-id="${m.id}" aria-label="Supprimer ce mouvement">✕</button>` : ""}
  </div>`;
}

/* ---------- Onglet Saisie ---------- */
function vSaisie() {
  const opts = S.refs.map(r => `<option value="${esc(r.code)}">${esc(r.name)}</option>`).join("");
  const qv = draft.qty || ""; delete draft.qty;
  const recent = S.moves.slice(-5).reverse().map(m => moveRow(m, false)).join("")
    || `<p class="empty">Aucun mouvement. Enregistrez votre première entrée ou sortie ci-dessus.</p>`;
  return `<form id="f" class="card" autocomplete="off">
    <div class="seg" role="radiogroup" aria-label="Type de mouvement">
      <label class="in"><input type="radio" name="type" value="in"${draft.type === "in" ? " checked" : ""}><span>Entrée</span></label>
      <label class="out"><input type="radio" name="type" value="out"${draft.type === "out" ? " checked" : ""}><span>Sortie</span></label>
    </div>
    <label>Référence<input id="code" list="refs" required autocapitalize="characters" value="${esc(draft.code)}"></label>
    <datalist id="refs">${opts}</datalist>
    <label>Quantité<input id="qty" type="number" inputmode="decimal" step="any" min="0" required value="${esc(qv)}"></label>
    <label>Date<input id="date" type="date" required value="${esc(draft.date)}"></label>
    <label>Note (facultatif)<input id="note" placeholder="Bon de livraison, client, motif"></label>
    <div id="preview" class="preview"></div>
    <button class="btn primary" type="submit">Enregistrer</button>
  </form>
  <h2>Derniers mouvements</h2>${recent}`;
}
function updatePreview() {
  const el = $("#preview"); if (!el) return;
  const code = norm($("#code").value);
  const qty = parseFloat($("#qty").value);
  const type = $("input[name=type]:checked").value;
  el.className = "preview";
  if (!code) { el.innerHTML = ""; return; }
  const ref = S.refs.find(r => r.code === code);
  if (!ref) { el.className = "preview warn"; el.textContent = "Nouvelle référence : elle sera créée à l’enregistrement."; return; }
  const st = totals(code).stock;
  const u = ref.unit ? " " + esc(ref.unit) : "";
  let html = `<b>${esc(ref.name || ref.code)}</b><div>Stock actuel : ${fmt(st)}${u}</div>`;
  if (qty > 0) {
    const after = r3(type === "in" ? st + qty : st - qty);
    html += `<div>Après ce mouvement : <b class="${after < 0 ? "neg" : ""}">${fmt(after)}${u}</b></div>`;
    if (after < 0) el.className = "preview bad";
  }
  el.innerHTML = html;
}
function submitMove() {
  const type = $("input[name=type]:checked").value;
  const code = norm($("#code").value);
  const qty = parseFloat($("#qty").value);
  const date = $("#date").value || today();
  const note = $("#note").value.trim();
  if (!code) return toast("Saisissez une référence.");
  if (!(qty > 0)) return toast("La quantité doit être supérieure à 0.");
  const isNew = !S.refs.some(r => r.code === code);
  if (isNew && !confirm(`La référence ${code} n’existe pas. La créer ?`)) return;
  const st = isNew ? 0 : totals(code).stock;
  if (type === "out" && qty > st &&
      !confirm(`Stock actuel : ${fmt(st)}. Cette sortie rend le stock négatif. Enregistrer quand même ?`)) return;
  if (isNew) S.refs.push({ code, name: "", unit: "", initial: 0, min: 0 });
  S.moves.push({ id: uid(), code, type, qty: r3(qty), date, note });
  save();
  draft = { type, date, code: "" };
  render();
  toast(`${type === "in" ? "Entrée" : "Sortie"} enregistrée : ${fmt(qty)} × ${code}`);
  $("#code").focus();
}

/* ---------- Onglet Stock ---------- */
function vStock() {
  return `<input id="q" type="search" placeholder="Chercher une référence ou un nom" value="${esc(q)}" aria-label="Rechercher">
  <div id="list">${stockList()}</div>`;
}
function stockList() {
  if (!S.refs.length) return `<p class="empty">Aucune référence. Ouvrez l’onglet Références pour en ajouter, ou enregistrez un premier mouvement.</p>`;
  const m = tmap();
  const k = q.trim().toLowerCase();
  const rows = S.refs
    .filter(r => !k || r.code.toLowerCase().includes(k) || r.name.toLowerCase().includes(k))
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
  if (!rows.length) return `<p class="empty">Aucun résultat pour « ${esc(q)} ».</p>`;
  return rows.map(r => {
    const t = m.get(r.code);
    const u = r.unit ? ` <small>${esc(r.unit)}</small>` : "";
    const state = t.stock < 0 ? "neg" : (r.min > 0 && t.stock <= r.min) ? "low" : "";
    const badge = state === "neg" ? `<span class="badge bad">Stock négatif</span>`
      : state === "low" ? `<span class="badge warn">Sous le seuil (${fmt(r.min)})</span>` : "";
    const base = r.initial + t.in;
    const pct = base > 0 ? Math.max(0, Math.min(100, Math.round(t.stock / base * 100))) : 0;
    return `<article class="ref ${state}">
      <div class="ref-h"><div><strong class="code">${esc(r.code)}</strong><div class="muted">${esc(r.name || "Sans désignation")}</div></div>
      <button type="button" class="btn small" data-act="move" data-id="${esc(r.code)}">Mouvement</button></div>
      <div class="big ${state === "neg" ? "neg" : ""}">${fmt(t.stock)}${u}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="io"><span class="in">Entrées ${fmt(t.in)}</span><span class="out">Sorties ${fmt(t.out)}</span><span class="muted">Départ ${fmt(r.initial)}</span></div>
      ${badge}</article>`;
  }).join("");
}

/* ---------- Onglet Historique ---------- */
function vHisto() {
  const opts = `<option value="">Toutes les références</option>` +
    S.refs.map(r => `<option value="${esc(r.code)}"${hf.code === r.code ? " selected" : ""}>${esc(r.code)}</option>`).join("");
  return `<div class="filters">
    <select id="hc" aria-label="Référence">${opts}</select>
    <select id="ht" aria-label="Type">
      <option value="">Entrées et sorties</option>
      <option value="in"${hf.type === "in" ? " selected" : ""}>Entrées</option>
      <option value="out"${hf.type === "out" ? " selected" : ""}>Sorties</option>
    </select></div><div id="hl">${histoList()}</div>`;
}
function histoList() {
  const rows = S.moves.map((m, i) => ({ ...m, i }))
    .filter(m => (!hf.code || m.code === hf.code) && (!hf.type || m.type === hf.type))
    .sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i);
  if (!rows.length) return `<p class="empty">Aucun mouvement pour ces filtres.</p>`;
  let head = "";
  if (hf.code) {
    let i = 0, o = 0;
    rows.forEach(m => m.type === "in" ? i += m.qty : o += m.qty);
    head = `<div class="tot"><span class="in">Entrées ${fmt(i)}</span><span class="out">Sorties ${fmt(o)}</span><span>Solde ${fmt(i - o)}</span></div>`;
  }
  return head + rows.map(m => moveRow(m, true)).join("");
}

/* ---------- Onglet Références ---------- */
function vRefs() {
  const e = editing ? S.refs.find(r => r.code === editing) : null;
  const list = [...S.refs].sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true })).map(r =>
    `<div class="mv"><div><strong>${esc(r.code)}</strong> <span class="muted">${esc(r.name)}</span>
    <div class="muted small">Unité : ${esc(r.unit || "non précisée")}. Départ ${fmt(r.initial)}, seuil ${fmt(r.min)}.</div></div>
    <button type="button" class="btn small" data-act="edit-ref" data-id="${esc(r.code)}">Modifier</button>
    <button type="button" class="ico" data-act="del-ref" data-id="${esc(r.code)}" aria-label="Supprimer la référence ${esc(r.code)}">✕</button></div>`
  ).join("") || `<p class="empty">Aucune référence enregistrée.</p>`;
  return `<form id="rf" class="card" autocomplete="off">
    <h2>${e ? "Modifier la référence" : "Nouvelle référence"}</h2>
    <label>Code<input id="rc" required autocapitalize="characters" value="${e ? esc(e.code) : ""}"${e ? " readonly" : ""}></label>
    <label>Désignation<input id="rn" value="${e ? esc(e.name) : ""}"></label>
    <div class="row">
      <label>Unité<input id="ru" placeholder="carton, kg, pièce" value="${e ? esc(e.unit) : ""}"></label>
      <label>Stock de départ<input id="ri" type="number" inputmode="decimal" step="any" value="${e ? e.initial : 0}"></label>
      <label>Seuil minimum<input id="rm" type="number" inputmode="decimal" step="any" min="0" value="${e ? e.min : 0}"></label>
    </div>
    <button class="btn primary" type="submit">${e ? "Enregistrer les modifications" : "Ajouter la référence"}</button>
    ${e ? `<button type="button" class="btn" data-act="cancel-edit">Annuler</button>` : ""}
  </form>
  <h2>Références</h2>${list}
  <h2>Données</h2>
  <div class="card"><p class="muted">Les données restent sur cet appareil. Faites une sauvegarde régulièrement.</p>
    <div class="btns">
      <button type="button" class="btn" data-act="export-stock">Exporter le stock (CSV)</button>
      <button type="button" class="btn" data-act="export-moves">Exporter les mouvements (CSV)</button>
      <button type="button" class="btn" data-act="backup">Sauvegarder (JSON)</button>
      <button type="button" class="btn" data-act="restore">Restaurer une sauvegarde</button>
    </div>
    <input id="file" type="file" accept="application/json,.json" hidden></div>`;
}
function submitRef() {
  const code = norm($("#rc").value);
  const f = {
    name: $("#rn").value.trim(), unit: $("#ru").value.trim(),
    initial: r3(parseFloat($("#ri").value) || 0), min: r3(Math.max(0, parseFloat($("#rm").value) || 0))
  };
  if (!code) return toast("Saisissez un code.");
  if (editing) {
    Object.assign(S.refs.find(r => r.code === editing), f);
    editing = null; toast("Référence modifiée.");
  } else {
    if (S.refs.some(r => r.code === code)) return toast("Cette référence existe déjà.");
    S.refs.push({ code, ...f }); toast("Référence ajoutée.");
  }
  save(); render();
}

/* ---------- Export, sauvegarde ---------- */
const num = n => String(r3(n)).replace(".", ",");
const txt = s => /^[=+\-@]/.test(s) ? "'" + s : s;
const csv = rows => "\ufeff" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportStock() {
  const m = tmap();
  const rows = [["Code", "Désignation", "Unité", "Départ", "Entrées", "Sorties", "Stock"]];
  S.refs.forEach(r => { const t = m.get(r.code); rows.push([txt(r.code), txt(r.name), txt(r.unit), num(r.initial), num(t.in), num(t.out), num(t.stock)]); });
  download(`stock-${today()}.csv`, csv(rows), "text/csv;charset=utf-8");
}
function exportMoves() {
  const rows = [["Date", "Code", "Désignation", "Type", "Quantité", "Note"]];
  S.moves.forEach(x => {
    const r = S.refs.find(r => r.code === x.code);
    rows.push([x.date, txt(x.code), txt(r ? r.name : ""), x.type === "in" ? "Entrée" : "Sortie", num(x.qty), txt(x.note || "")]);
  });
  download(`mouvements-${today()}.csv`, csv(rows), "text/csv;charset=utf-8");
}
function backup() {
  download(`sauvegarde-stock-${today()}.json`,
    JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), refs: S.refs, moves: S.moves }, null, 2),
    "application/json");
}
function restoreFile(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!Array.isArray(d.refs) || !Array.isArray(d.moves)) throw new Error("format");
      const refs = d.refs.filter(r => r && r.code).map(r => ({
        code: norm(r.code), name: String(r.name || ""), unit: String(r.unit || ""),
        initial: Number(r.initial) || 0, min: Number(r.min) || 0
      }));
      const moves = d.moves.filter(m => m && m.code && (m.type === "in" || m.type === "out") && Number(m.qty) > 0).map(m => ({
        id: String(m.id || uid()), code: norm(m.code), type: m.type, qty: r3(Number(m.qty)),
        date: /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : today(), note: String(m.note || "")
      }));
      moves.forEach(m => { if (!refs.some(r => r.code === m.code)) refs.push({ code: m.code, name: "", unit: "", initial: 0, min: 0 }); });
      if (!confirm(`Remplacer les données actuelles par la sauvegarde (${refs.length} références, ${moves.length} mouvements) ?`)) return;
      S = { refs, moves }; save(); render(); toast("Sauvegarde restaurée.");
    } catch (e) { toast("Fichier invalide : choisissez une sauvegarde JSON de cette application."); }
  };
  rd.readAsText(file);
}

/* ---------- Événements ---------- */
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab);
});
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "move") { draft.code = id; setTab("saisie"); $("#qty").focus(); }
  else if (a === "del-move") {
    if (confirm("Supprimer ce mouvement ? Le stock sera recalculé.")) {
      S.moves = S.moves.filter(m => m.id !== id); save(); render(); toast("Mouvement supprimé.");
    }
  }
  else if (a === "edit-ref") { editing = id; render(); window.scrollTo(0, 0); }
  else if (a === "cancel-edit") { editing = null; render(); }
  else if (a === "del-ref") {
    const n = S.moves.filter(m => m.code === id).length;
    if (confirm(`Supprimer la référence ${id}${n ? ` et ses ${n} mouvement${n > 1 ? "s" : ""}` : ""} ?`)) {
      S.refs = S.refs.filter(r => r.code !== id); S.moves = S.moves.filter(m => m.code !== id);
      save(); render(); toast("Référence supprimée.");
    }
  }
  else if (a === "export-stock") exportStock();
  else if (a === "export-moves") exportMoves();
  else if (a === "backup") backup();
  else if (a === "restore") $("#file").click();
});
document.addEventListener("input", e => {
  const id = e.target.id;
  if (id === "q") { q = e.target.value; $("#list").innerHTML = stockList(); }
  else if (id === "code" || id === "qty" || e.target.name === "type") updatePreview();
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "hc" || t.id === "ht") { hf.code = $("#hc").value; hf.type = $("#ht").value; $("#hl").innerHTML = histoList(); }
  else if (t.id === "file") { restoreFile(t.files[0]); t.value = ""; }
  else if (t.name === "type") draft.type = t.value;
  else if (t.id === "date") draft.date = t.value;
});
document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "f") submitMove();
  else if (e.target.id === "rf") submitRef();
});

/* ---------- Démarrage ---------- */
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
