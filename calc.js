"use strict";
/* Onglet « Calcul » : calculatrice, palettes et colis, conversions.
   Chargé avant app.js ; utilise ses fonctions ($, esc, fmt, r3, toast, draft, setTab) au moment des clics. */

const calc = { expr: "", mem: 0, hist: [], done: false };
const UNITS = {
  "Poids": { t: 1000, kg: 1, g: 0.001 },
  "Volume": { "m³": 1000, L: 1, mL: 0.001 },
  "Longueur": { m: 1, cm: 0.01, mm: 0.001 }
};
const fmtN = n => n.toLocaleString("fr-FR", { maximumFractionDigits: 8 });
const r9 = n => Math.round(n * 1e9) / 1e9;

/* ---------- Évaluation d’une expression (sans eval) ---------- */
function evalExpr(src) {
  let i = 0;
  function factor() {
    let neg = false;
    while (src[i] === "-" || src[i] === "+") { if (src[i] === "-") neg = !neg; i++; }
    let v, pct = false;
    if (src[i] === "(") {
      i++; v = expr().v;
      if (src[i] !== ")") throw 0;
      i++;
    } else {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) throw 0;
      v = parseFloat(m[1]); i += m[1].length;
    }
    if (src[i] === "%") { v /= 100; pct = true; i++; }
    return { v: neg ? -v : v, pct };
  }
  function term() {
    let a = factor();
    while (src[i] === "*" || src[i] === "/") {
      const op = src[i++], b = factor();
      if (op === "/") { if (b.v === 0) throw 0; a = { v: a.v / b.v, pct: false }; }
      else a = { v: a.v * b.v, pct: false };
    }
    return a;
  }
  function expr() {
    let a = term();
    while (src[i] === "+" || src[i] === "-") {
      const op = src[i++], b = term();
      const bv = b.pct ? a.v * b.v : b.v;   // 200 + 10 % = 220
      a = { v: op === "+" ? a.v + bv : a.v - bv, pct: false };
    }
    return a;
  }
  const r = expr();
  if (i !== src.length || !isFinite(r.v)) throw 0;
  return +r.v.toPrecision(12);
}
function calcTry() {
  if (!calc.expr) return null;
  try { return evalExpr(calc.expr); } catch (e) { return null; }
}

/* ---------- Affichage ---------- */
function vCalc() {
  const key = (k, label, cls = "", aria = "") =>
    `<button type="button" class="k ${cls}" data-k="${k}"${aria ? ` aria-label="${aria}"` : ""}>${label}</button>`;
  const cats = Object.keys(UNITS).map(c => `<option>${c}</option>`).join("");
  return `<div class="calc card">
    <div class="disp"><div id="cexpr" class="cexpr"></div><div id="cres" class="cres"></div></div>
    <div class="memrow">
      <button type="button" class="k mem" data-mem="mc" aria-label="Effacer la mémoire">MC</button>
      <button type="button" class="k mem" data-mem="mr" aria-label="Rappeler la mémoire">MR</button>
      <button type="button" class="k mem" data-mem="mp" aria-label="Ajouter à la mémoire">M+</button>
      <button type="button" class="k mem" data-mem="mm" aria-label="Retirer de la mémoire">M−</button>
    </div>
    <div id="cmem" class="muted small cmem"></div>
    <div class="keys">
      ${key("C", "C", "fn", "Tout effacer")}${key("DEL", "⌫", "fn", "Effacer le dernier caractère")}${key("%", "%", "op")}${key("/", "÷", "op", "Divisé par")}
      ${key("7", "7")}${key("8", "8")}${key("9", "9")}${key("*", "×", "op", "Multiplié par")}
      ${key("4", "4")}${key("5", "5")}${key("6", "6")}${key("-", "−", "op", "Moins")}
      ${key("1", "1")}${key("2", "2")}${key("3", "3")}${key("+", "+", "op", "Plus")}
      ${key("(", "(", "op")}${key("0", "0")}${key(")", ")", "op")}${key(".", ",", "", "Virgule")}
      ${key("=", "=", "eq", "Égal")}
    </div>
    <button type="button" class="btn" data-use="1">Utiliser le résultat comme quantité</button>
  </div>
  <h2>Historique des calculs</h2><div id="chist"></div>

  <h2>Palettes et colis</h2>
  <div class="card">
    <div class="row">
      <label>Quantité totale<input id="pt" type="number" inputmode="decimal" step="any" min="0"></label>
      <label>Quantité par colis<input id="pc" type="number" inputmode="decimal" step="any" min="0"></label>
      <label>Colis par palette<input id="pp" type="number" inputmode="numeric" step="1" min="1"></label>
    </div>
    <div id="pres" class="pres"></div>
  </div>

  <h2>Conversions</h2>
  <div class="card">
    <label>Type<select id="cc">${cats}</select></label>
    <div class="row">
      <label>Valeur<input id="cv" type="number" inputmode="decimal" step="any"></label>
      <label>De<select id="cf"></select></label>
      <label>Vers<select id="ct"></select></label>
    </div>
    <div id="cr" class="pres"></div>
  </div>`;
}
function initCalc() { updateCalc(); updatePal(); fillConv(); }

function updateCalc() {
  const e = $("#cexpr"); if (!e) return;
  e.textContent = calc.expr.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−").replace(/\./g, ",");
  const r = calcTry();
  $("#cres").textContent = !calc.expr ? "0" : r === null ? "" : fmtN(r);
  $("#cmem").textContent = calc.mem ? `Mémoire : ${fmtN(calc.mem)}` : "";
  $("#chist").innerHTML = calc.hist.length
    ? calc.hist.map((h, i) => `<button type="button" class="hrow" data-hist="${i}"><span class="muted">${esc(h.expr.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−").replace(/\./g, ","))}</span><b>${fmtN(h.res)}</b></button>`).join("")
    : `<p class="empty">Les calculs validés avec « = » apparaissent ici. Touchez-en un pour le reprendre.</p>`;
}

/* ---------- Touches ---------- */
function pressKey(k) {
  const OPS = "+-*/";
  const last = calc.expr.slice(-1);
  if (k === "C") { calc.expr = ""; calc.done = false; }
  else if (k === "DEL") { calc.expr = calc.expr.slice(0, -1); calc.done = false; }
  else if (k === "=") {
    const r = calcTry();
    if (r === null) { toast("Calcul incomplet ou impossible."); return; }
    if (calc.expr !== String(r)) calc.hist = [{ expr: calc.expr, res: r }, ...calc.hist].slice(0, 20);
    calc.expr = String(r); calc.done = true;
  }
  else if (OPS.includes(k)) {
    if (!calc.expr && k !== "-") return;
    calc.done = false;
    if (OPS.includes(last)) calc.expr = calc.expr.slice(0, -1);
    calc.expr += k;
  }
  else if (k === "%") {
    if (!/[\d)]/.test(last)) return;
    calc.done = false; calc.expr += k;
  }
  else if (k === "(") {
    if (calc.done) calc.expr = "";
    calc.done = false;
    if (/[\d.)%]/.test(calc.expr.slice(-1))) return;
    calc.expr += k;
  }
  else if (k === ")") {
    const open = (calc.expr.match(/\(/g) || []).length, close = (calc.expr.match(/\)/g) || []).length;
    if (open <= close || !/[\d)%]/.test(last)) return;
    calc.expr += k;
  }
  else {                                    // chiffre ou virgule
    if (calc.done) { calc.expr = ""; calc.done = false; }
    if (/[)%]/.test(calc.expr.slice(-1))) return;
    const seg = calc.expr.split(/[^0-9.]/).pop();
    if (k === ".") {
      if (seg.includes(".")) return;
      calc.expr += seg === "" ? "0." : ".";
    } else calc.expr += k;
  }
  updateCalc();
}
function pressMem(m) {
  if (m === "mc") { calc.mem = 0; toast("Mémoire effacée."); }
  else if (m === "mr") {
    if (!calc.mem) return toast("La mémoire est vide.");
    if (calc.done) { calc.expr = ""; calc.done = false; }
    if (/[\d.)%]/.test(calc.expr.slice(-1))) return toast("Ajoutez d’abord une opération.");
    calc.expr += String(calc.mem);
  } else {
    const r = calcTry();
    if (r === null) return toast("Calculez d’abord un résultat valide.");
    calc.mem = r9(calc.mem + (m === "mp" ? r : -r));
    toast(`Mémoire : ${fmtN(calc.mem)}`);
  }
  updateCalc();
}

/* ---------- Palettes et colis ---------- */
function updatePal() {
  const el = $("#pres"); if (!el) return;
  const t = parseFloat($("#pt").value), c = parseFloat($("#pc").value), p = parseFloat($("#pp").value);
  if (!(t > 0) || !(c > 0)) { el.innerHTML = `<span class="muted">Saisissez la quantité totale et la quantité par colis.</span>`; return; }
  const full = Math.floor(r9(t / c)), need = Math.ceil(r9(t / c)), rest = r3(t - full * c);
  let html = `<div>Colis complets : <b>${fmt(full)}</b></div>`;
  if (rest > 0) html += `<div>Reste : <b>${fmt(rest)}</b> (1 colis incomplet)</div>`;
  html += `<div>Colis nécessaires : <b>${fmt(need)}</b></div>`;
  if (p > 0) {
    if (!Number.isInteger(p)) html += `<div class="muted">Le nombre de colis par palette doit être un entier.</div>`;
    else {
      html += `<div>Palettes complètes : <b>${fmt(Math.floor(need / p))}</b></div>`;
      if (need % p) html += `<div>Colis sur la dernière palette : <b>${fmt(need % p)}</b></div>`;
      html += `<div>Palettes nécessaires : <b>${fmt(Math.ceil(need / p))}</b></div>`;
    }
  }
  el.innerHTML = html;
}

/* ---------- Conversions ---------- */
function fillConv() {
  const cat = $("#cc").value, ks = Object.keys(UNITS[cat]);
  const opts = sel => ks.map(u => `<option${u === sel ? " selected" : ""}>${u}</option>`).join("");
  $("#cf").innerHTML = opts(ks[1]);
  $("#ct").innerHTML = opts(ks[2]);
  updateConv();
}
function updateConv() {
  const el = $("#cr"); if (!el) return;
  const v = parseFloat($("#cv").value);
  if (isNaN(v)) { el.textContent = ""; return; }
  const U = UNITS[$("#cc").value], f = $("#cf").value, t = $("#ct").value;
  el.innerHTML = `${fmtN(v)} ${esc(f)} = <b>${fmtN(+(v * U[f] / U[t]).toPrecision(10))} ${esc(t)}</b>`;
}

/* ---------- Événements ---------- */
document.addEventListener("click", e => {
  const k = e.target.closest("[data-k]");
  if (k) return pressKey(k.dataset.k);
  const m = e.target.closest("[data-mem]");
  if (m) return pressMem(m.dataset.mem);
  const h = e.target.closest("[data-hist]");
  if (h) { calc.expr = String(calc.hist[+h.dataset.hist].res); calc.done = true; return updateCalc(); }
  if (e.target.closest("[data-use]")) {
    const r = calcTry();
    if (r === null || !(r > 0)) return toast("Le résultat doit être un nombre supérieur à 0.");
    draft.qty = String(r3(r));
    setTab("saisie");
    $("#code").focus();
  }
});
document.addEventListener("input", e => {
  const id = e.target.id;
  if (id === "pt" || id === "pc" || id === "pp") updatePal();
  else if (id === "cv") updateConv();
});
document.addEventListener("change", e => {
  const id = e.target.id;
  if (id === "cc") fillConv();
  else if (id === "cf" || id === "ct") updateConv();
});
document.addEventListener("keydown", e => {
  if (typeof tab === "undefined" || tab !== "calc") return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key; let m = null;
  if (/^[0-9]$/.test(k)) m = k;
  else if (k === "," || k === ".") m = ".";
  else if ("+-*/()%".includes(k) && k.length === 1) m = k;
  else if (k === "Enter" || k === "=") m = "=";
  else if (k === "Backspace") m = "DEL";
  else if (k === "Escape") m = "C";
  if (m) { e.preventDefault(); pressKey(m); }
});
