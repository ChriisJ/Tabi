// Tabi – Einstellungsseite: visueller Editor für Fenster, Gruppen und Pflicht-Tabs.
//  * Arbeitskopie (draft) wird erst mit „Als Standard speichern“ zur gültigen Vorlage.
//  * „Aktuelle Sitzung übernehmen“ / „Aus offenen Tabs wählen“ verknüpfen offene Tabs direkt
//    (bind), damit beim Speichern nichts doppelt geöffnet wird.

import { DEFAULT_SETTINGS, GROUP_COLORS, validateConfig, migrateConfig } from '../lib/config.js';
import { exportBookmarksHtml, parseBookmarksHtml, exportLinkList, parseLinkList } from './transfer.js';

const $ = id => document.getElementById(id);
const clone = o => structuredClone(o);

const COLOR_NAMES = {
  grey: 'Grau', blue: 'Blau', red: 'Rot', yellow: 'Gelb', green: 'Grün',
  pink: 'Pink', purple: 'Lila', cyan: 'Cyan', orange: 'Orange'
};

const ICONS = {
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  capture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M7 21h10"/><circle cx="6" cy="6" r=".6" fill="currentColor"/></svg>',
  import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M4 19h16"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  tabs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M7 7V4h6v3"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>'
};

// ---------------------------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------------------------

let saved = null;          // zuletzt gespeicherte Vorlage
let loadedRev = null;      // Revision der geladenen Vorlage (erkennt Änderungen von anderen Geräten)
let draft = null;          // Arbeitskopie
let bind = emptyBind();    // Vorlagen-Schlüssel → offene Browser-IDs (aus Sitzung/Tab-Auswahl)
let undoStack = [];
let focusSnapshot = null;
let liveStatus = null;
let dragItem = null;       // { kind: 'tab' | 'group', id }
let toastTimer = null;
let validateTimer = null;

let editPid = null;        // ID des Profils, das gerade im Editor angezeigt wird

// Aktuell bearbeitetes Profil, seine Fenster und sein Pfad-Präfix für die Validierung.
function curIndex() {
  const i = draft.profiles.findIndex(p => p.id === editPid);
  return i >= 0 ? i : 0;
}
function cur() { return draft.profiles[curIndex()]; }
function W() { return cur().windows; }
function PP() { return `profiles[${curIndex()}]`; }

function emptyBind() { return { windows: {}, groups: {}, tabs: {} }; }
function bindCount() { return Object.keys(bind.windows).length + Object.keys(bind.groups).length + Object.keys(bind.tabs).length; }

// ---------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, res => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      if (!res || !res.ok) return reject(new Error(res?.error || 'Keine Antwort vom Hintergrunddienst.'));
      resolve(res);
    });
  });
}

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function icon(name) {
  const s = document.createElement('span');
  s.style.display = 'contents';
  s.innerHTML = ICONS[name]; // statische, eigene SVG-Konstanten
  return s;
}

function iconBtn(name, label, onclick, extra = {}) {
  return h('button', { type: 'button', class: `icon-btn ${extra.class || ''}`, 'aria-label': label, title: label, onclick, disabled: extra.disabled }, icon(name));
}

function toast(text, action) {
  const t = $('toast');
  t.replaceChildren(h('span', { text }));
  if (action) t.append(h('button', { type: 'button', text: action.label, onclick: () => { t.hidden = true; action.run(); } }));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 7000 : 4000);
}

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

// IDs sind über ALLE Profile eindeutig.
function allIds(config = draft) {
  const ids = new Set();
  for (const p of config.profiles || []) {
    ids.add(p.id);
    for (const w of p.windows || []) {
      ids.add(w.id);
      for (const g of w.groups || []) {
        ids.add(g.id);
        for (const t of g.tabs || []) ids.add(t.id);
      }
    }
  }
  return ids;
}

function newId(prefix, label, taken = allIds()) {
  const base = slugify(label) || prefix;
  for (;;) {
    const id = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!taken.has(id)) { taken.add(id); return id; }
  }
}

function allTitles(except) {
  const s = new Set();
  for (const w of W()) for (const g of w.groups) if (g !== except) s.add((g.title || '').trim().toLowerCase());
  return s;
}

function uniqueTitle(base, taken = allTitles()) {
  let t = base.trim() || 'Gruppe';
  if (!taken.has(t.toLowerCase())) { taken.add(t.toLowerCase()); return t; }
  for (let i = 2; ; i++) {
    const c = `${t} ${i}`;
    if (!taken.has(c.toLowerCase())) { taken.add(c.toLowerCase()); return c; }
  }
}

function nextFreeColor() {
  const used = new Set(W().flatMap(w => w.groups.map(g => g.color)));
  return GROUP_COLORS.find(c => c !== 'grey' && !used.has(c)) || 'blue';
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function avatarFor(url) {
  const host = hostOf(url);
  if (!host) return { letter: '?', color: 'grey' };
  let hash = 0;
  for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const palette = GROUP_COLORS.filter(c => c !== 'grey');
  return { letter: host[0], color: palette[hash % palette.length] };
}

// Wandelt freien Text in URLs um. „example.com/x“ → „https://example.com/x“.
function parseUrls(text) {
  const valid = [];
  const invalid = [];
  for (let token of String(text || '').split(/[\s,;]+/)) {
    token = token.replace(/^[<"']+|[>"']+$/g, '');
    if (!token) continue;
    let candidate = token;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
      if (/^[^\s/]+\.[^\s]{2,}/.test(candidate)) candidate = `https://${candidate}`;
      else { invalid.push(token); continue; }
    }
    try {
      const u = new URL(candidate);
      if (u.protocol === 'http:' || u.protocol === 'https:') valid.push(u.href);
      else invalid.push(token);
    } catch {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

function find(kind, id) {
  for (let wi = 0; wi < W().length; wi++) {
    const w = W()[wi];
    if (kind === 'window' && w.id === id) return { w, wi };
    for (let gi = 0; gi < w.groups.length; gi++) {
      const g = w.groups[gi];
      if (kind === 'group' && g.id === id) return { w, wi, g, gi };
      if (kind === 'tab') {
        const ti = g.tabs.findIndex(t => t.id === id);
        if (ti >= 0) return { w, wi, g, gi, t: g.tabs[ti], ti };
      }
    }
  }
  return null;
}

function normalizeDraft(cfg) {
  const d = migrateConfig(cfg && typeof cfg === 'object' ? clone(cfg) : {});
  d.version = 2;
  d.settings = { ...DEFAULT_SETTINGS, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) };
  if (!Array.isArray(d.profiles) || !d.profiles.length) d.profiles = [{ id: 'standard', name: 'Standard', windows: [] }];
  for (const p of d.profiles) {
    if (!Array.isArray(p.windows)) p.windows = [];
    for (const w of p.windows) {
      if (!Array.isArray(w.groups)) w.groups = [];
      for (const g of w.groups) {
        if (!Array.isArray(g.tabs)) g.tabs = [];
        if (!GROUP_COLORS.includes(g.color)) g.color = g.color || 'grey';
        if (typeof g.collapsed !== 'boolean') g.collapsed = false;
      }
    }
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
// Änderungen & Rückgängig
// ---------------------------------------------------------------------------------------------

function pushUndo(snapshot = clone(draft)) {
  undoStack.push({ draft: snapshot, bind: clone(bind) });
  if (undoStack.length > 50) undoStack.shift();
}

function mutate(fn, { render = true } = {}) {
  pushUndo();
  fn();
  if (render) renderEditor(); else { updateDirty(); scheduleValidate(); }
}

function undo() {
  const s = undoStack.pop();
  if (!s) { toast('Nichts zum Rückgängigmachen.'); return; }
  draft = s.draft;
  bind = s.bind;
  renderEditor();
}

function isDirty() {
  return JSON.stringify(draft) !== JSON.stringify(saved) || bindCount() > 0;
}

function updateDirty() {
  const d = isDirty();
  $('dirty').hidden = !d;
  $('btnDiscard').disabled = !d;
  $('btnSaveOnly').disabled = !d;
  $('btnSave').disabled = !d;
}

// Text-Eingaben: Rückgängig-Schritt pro Feldbearbeitung (nicht pro Tastendruck).
function trackField(input, apply) {
  input.addEventListener('input', () => {
    // Zustand VOR der ersten Änderung dieses Bearbeitungsvorgangs merken.
    if (!focusSnapshot) focusSnapshot = { draft: clone(draft), bind: clone(bind) };
    apply(input.value);
    updateDirty();
    scheduleValidate();
  });
  input.addEventListener('change', () => {
    if (focusSnapshot && JSON.stringify(focusSnapshot.draft) !== JSON.stringify(draft)) undoStack.push(focusSnapshot);
    focusSnapshot = null;
  });
}

// ---------------------------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------------------------

function liveMaps() {
  const wins = new Map();
  const tabs = new Map();
  if (liveStatus?.windows) {
    for (const w of liveStatus.windows) {
      wins.set(w.key, w.open);
      for (const g of w.groups) for (const t of g.tabs) tabs.set(t.key, t);
    }
  }
  return { wins, tabs };
}

function savedKeys() {
  return saved ? allIds(saved) : new Set();
}

function activeId() {
  return liveStatus?.activeProfile || saved?.profiles?.[0]?.id;
}

// ---------- Profilleiste ----------

function renderProfiles() {
  const bar = $('profiles');
  const active = activeId();
  const savedIds = new Set((saved?.profiles || []).map(p => p.id));
  bar.replaceChildren(
    h('span', { class: 'pbar-label', text: 'Profile' }),
    ...draft.profiles.map(p => h('button', {
      type: 'button', role: 'tab', class: `ptab${p.id === cur().id ? ' sel' : ''}`, 'aria-selected': String(p.id === cur().id),
      title: p.id === active ? 'Aktives Profil auf diesem Gerät' : 'Zum Bearbeiten anzeigen',
      onclick: () => { editPid = p.id; renderEditor(); }
    }, p.id === active ? h('span', { class: 'pdot', 'aria-label': 'aktiv' }) : null, h('span', { class: 'ptxt', text: p.name || 'Ohne Namen' }),
    !savedIds.has(p.id) ? h('span', { class: 'pnew', text: 'neu' }) : null)),
    h('button', { type: 'button', class: 'ptab add', title: 'Neues Profil', onclick: addProfile }, icon('plus'), 'Profil'));

  // Kopf des gewählten Profils
  const p = cur();
  const pi = curIndex();
  const name = h('input', { class: 'pname', type: 'text', value: p.name || '', placeholder: 'Profilname', 'aria-label': 'Profilname', dataset: { path: `profiles[${pi}].name` } });
  trackField(name, v => {
    p.name = v;
    const label = $('profiles').querySelector('.ptab.sel .ptxt');
    if (label) label.textContent = v || 'Ohne Namen';
  });
  const isActive = p.id === active;
  const head = $('profileHead');
  head.replaceChildren(
    name,
    isActive ? h('span', { class: 'badge open', text: 'aktiv auf diesem Gerät' })
      : h('button', { type: 'button', class: 'btn accent-soft', onclick: () => activateProfile(p.id), disabled: !savedIds.has(p.id) }, 'Dieses Profil aktivieren'),
    h('span', { class: 'grp-spacer' }),
    iconBtn('copy', 'Profil duplizieren', () => duplicateProfile(p.id)),
    iconBtn('trash', isActive ? 'Das aktive Profil kann nicht gelöscht werden' : 'Profil löschen', () => removeProfile(p.id), { class: 'danger', disabled: isActive || draft.profiles.length < 2 }));
}

function addProfile() {
  let pid;
  mutate(() => {
    const taken = allIds();
    const n = draft.profiles.length + 1;
    const pname = uniqueProfileName(`Profil ${n}`);
    pid = newId('profil', pname, taken);
    const tname = 'Neue Gruppe';
    draft.profiles.push({
      id: pid, name: pname,
      windows: [{ id: newId('fenster', 'fenster-1', taken), name: 'Fenster 1', groups: [{ id: newId('gruppe', tname, taken), title: tname, color: 'blue', collapsed: false, tabs: [{ id: newId('tab', 'tab', taken), url: '' }] }] }]
    });
    editPid = pid;
  });
  focusPath('#profileHead .pname', true);
}

function uniqueProfileName(base) {
  const taken = new Set(draft.profiles.map(p => (p.name || '').toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

// Kopie mit neuen IDs (IDs müssen über alle Profile eindeutig sein).
function duplicateProfile(pid) {
  mutate(() => {
    const src = draft.profiles.find(p => p.id === pid);
    const taken = allIds();
    const copy = {
      id: newId('profil', src.name, taken), name: uniqueProfileName(`${src.name} (Kopie)`),
      windows: src.windows.map(w => ({
        id: newId('fenster', w.name, taken), name: w.name,
        groups: w.groups.map(g => ({ ...g, id: newId('gruppe', g.title, taken), tabs: g.tabs.map(t => ({ ...t, id: newId('tab', hostOf(t.url), taken) })) }))
      }))
    };
    draft.profiles.splice(draft.profiles.findIndex(p => p.id === pid) + 1, 0, copy);
    editPid = copy.id;
  });
  toast('Profil dupliziert.');
}

function removeProfile(pid) {
  const p = draft.profiles.find(x => x.id === pid);
  mutate(() => {
    draft.profiles = draft.profiles.filter(x => x.id !== pid);
    editPid = activeId();
  });
  toast(`Profil „${p.name}“ entfernt.`, { label: 'Rückgängig', run: undo });
}

async function activateProfile(pid) {
  if (isDirty()) { toast('Bitte zuerst speichern – aktiviert wird die gespeicherte Fassung.'); return; }
  const p = draft.profiles.find(x => x.id === pid);
  const closeOld = confirm(`Profil „${p.name}“ aktivieren.\n\nSollen die Pflicht-Tabs des bisherigen Profils dabei geschlossen werden?\n\nOK = schließen · Abbrechen = offen lassen (deine eigenen Tabs bleiben in jedem Fall offen)`);
  try {
    const res = await send({ type: 'switchProfile', profileId: pid, closeOld });
    liveStatus = res.status;
    const r = res.result || {};
    toast(`Profil „${p.name}“ aktiv: ${r.created || 0} Tab(s) geöffnet${r.windows ? `, ${r.windows} Fenster` : ''}${r.closed ? `, ${r.closed} alte geschlossen` : ''}.`);
  } catch (e) {
    toast(`Profilwechsel fehlgeschlagen: ${e.message}`);
  }
  renderEditor();
}

function renderEditor() {
  renderProfiles();
  const box = $('windows');
  box.replaceChildren();
  if (!W().length) {
    box.append(h('div', { class: 'empty' },
      h('h2', { text: 'Noch keine Vorlage' }),
      h('div', { text: 'Richte deine Fenster einmal in Edge ein und übernimm sie – oder baue die Vorlage hier von Hand auf.' }),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', onclick: openCapture }, icon('capture'), 'Aktuelle Sitzung übernehmen'),
        h('button', { type: 'button', class: 'btn', onclick: addWindow }, icon('plus'), 'Fenster hinzufügen'))));
  } else {
    const known = savedKeys();
    W().forEach((w, wi) => box.append(renderWindow(w, wi, known)));
  }
  $('setReuse').checked = !!draft.settings.reuseEmptyStartupWindow;
  $('setFocus').checked = !!draft.settings.focusCreatedWindows;
  applyLive();
  updateDirty();
  validateNow();
  if (liveStatus) renderBanner();
}

function renderWindow(w, wi, known) {
  const tabCount = w.groups.reduce((n, g) => n + g.tabs.length, 0);
  const name = h('input', { class: 'win-name', type: 'text', value: w.name || '', placeholder: 'Fenstername', 'aria-label': 'Fenstername', dataset: { path: `${PP()}.windows[${wi}].name` } });
  trackField(name, v => { w.name = v; });

  const groups = h('div', { class: 'groups', dataset: { wid: w.id } });
  w.groups.forEach((g, gi) => groups.append(renderGroup(g, wi, gi, known)));
  setupGroupDrop(groups, w.id);

  return h('section', { class: 'win', dataset: { path: `${PP()}.windows[${wi}]`, wid: w.id } },
    h('header', { class: 'win-head' },
      h('span', { class: 'win-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      name,
      h('span', { class: 'win-meta', text: `${w.groups.length} ${w.groups.length === 1 ? 'Gruppe' : 'Gruppen'} · ${tabCount} ${tabCount === 1 ? 'Tab' : 'Tabs'}` }),
      h('span', { class: `badge ${known.has(w.id) ? 'closed' : 'new'}`, dataset: { liveWin: w.id }, text: known.has(w.id) ? '…' : 'neu' }),
      h('span', { class: 'tools' },
        iconBtn('up', 'Fenster nach oben', () => moveWindow(w.id, -1), { disabled: wi === 0 }),
        iconBtn('down', 'Fenster nach unten', () => moveWindow(w.id, 1), { disabled: wi === W().length - 1 }),
        iconBtn('trash', 'Fenster entfernen', () => removeWindow(w.id), { class: 'danger' }))),
    h('div', { class: 'win-body' },
      groups,
      h('div', { class: 'win-foot' },
        h('button', { type: 'button', class: 'link-btn', onclick: () => addGroup(w.id) }, icon('plus'), 'Gruppe'),
        h('button', { type: 'button', class: 'link-btn', onclick: () => openUrlDialog({ windowId: w.id }) }, icon('link'), 'Gruppe aus URLs'))));
}

function renderGroup(g, wi, gi, known) {
  const path = `${PP()}.windows[${wi}].groups[${gi}]`;
  const title = h('input', { class: 'grp-title', type: 'text', value: g.title || '', placeholder: 'Gruppenname', 'aria-label': 'Gruppenname', dataset: { path: `${path}.title` } });
  title.style.width = `${Math.max(8, Math.min(28, (g.title || '').length + 2))}ch`;
  trackField(title, v => { g.title = v; title.style.width = `${Math.max(8, Math.min(28, v.length + 2))}ch`; });

  const colorBtn = h('button', { type: 'button', class: 'color-btn', 'aria-label': `Farbe: ${COLOR_NAMES[g.color] || g.color}`, title: `Farbe: ${COLOR_NAMES[g.color] || g.color}`, dataset: { path: `${path}.color` } });
  colorBtn.addEventListener('click', () => openColorPop(colorBtn, g.color, c => mutate(() => { g.color = c; })));

  const collapse = h('button', { type: 'button', class: 'collapse-btn', 'aria-pressed': String(!!g.collapsed), title: 'Zustand beim Neuaufbau der Gruppe' },
    icon('chevron'), g.collapsed ? 'eingeklappt' : 'aufgeklappt');
  collapse.addEventListener('click', () => mutate(() => { g.collapsed = !g.collapsed; }));

  const grip = h('span', { class: 'grip', title: 'Ziehen zum Verschieben', 'aria-hidden': 'true' }, icon('grip'));

  const list = h('ol', { class: 'tabs', dataset: { gid: g.id, path: `${path}.tabs` } });
  if (g.tabs.length) g.tabs.forEach((t, ti) => list.append(renderTab(t, g, `${path}.tabs[${ti}]`, known)));
  else list.append(h('li', { class: 'empty-tabs', text: 'Noch keine Tabs – URL hinzufügen oder einen Tab hierher ziehen.' }));
  setupTabDrop(list, g.id);

  const w = W()[wi];
  const el = h('div', { class: 'grp', style: `--gc: var(--g-${GROUP_COLORS.includes(g.color) ? g.color : 'grey'})`, dataset: { gid: g.id, path } },
    h('div', { class: 'grp-head' },
      grip,
      h('span', { class: 'chip' }, colorBtn, title),
      collapse,
      h('span', { class: 'grp-count', text: `${g.tabs.length} ${g.tabs.length === 1 ? 'Tab' : 'Tabs'}` }),
      h('span', { class: 'grp-spacer' }),
      h('span', { class: 'tools' },
        iconBtn('up', 'Gruppe nach oben', () => moveGroup(g.id, -1), { disabled: gi === 0 }),
        iconBtn('down', 'Gruppe nach unten', () => moveGroup(g.id, 1), { disabled: gi === w.groups.length - 1 }),
        iconBtn('trash', 'Gruppe entfernen', () => removeGroup(g.id), { class: 'danger' }))),
    list,
    h('div', { class: 'grp-foot' },
      h('button', { type: 'button', class: 'link-btn', onclick: () => addTab(g.id) }, icon('plus'), 'Tab'),
      h('button', { type: 'button', class: 'link-btn', onclick: () => openUrlDialog({ groupId: g.id }) }, icon('link'), 'Mehrere URLs'),
      h('button', { type: 'button', class: 'link-btn', onclick: () => openPick(g.id) }, icon('tabs'), 'Aus offenen Tabs'),
      g.tabs.length ? (() => {
        const allProtected = g.tabs.every(t => t.protect !== false);
        return h('button', {
          type: 'button', class: 'link-btn', title: allProtected ? 'Alle Tabs dieser Gruppe dürfen geschlossen werden' : 'Alle Tabs dieser Gruppe werden nach dem Schließen wieder geöffnet',
          onclick: () => mutate(() => { for (const t of g.tabs) setProtect(t, !allProtected); })
        }, icon(allProtected ? 'unlock' : 'lock'), allProtected ? 'Alle freigeben' : 'Alle schützen');
      })() : null));
  makeDraggable(el, grip, 'group', g.id);
  return el;
}

function renderTab(t, g, path, known) {
  const av = avatarFor(t.url);
  const avatar = h('span', { class: 'avatar', style: `background: var(--g-${av.color})`, text: av.letter, 'aria-hidden': 'true' });
  const input = h('input', { class: 'tab-url', type: 'url', value: t.url || '', placeholder: 'https://…', 'aria-label': 'Start-URL', spellcheck: 'false', dataset: { path: `${path}.url` } });
  trackField(input, v => {
    t.url = v.trim();
    const a = avatarFor(t.url);
    avatar.textContent = a.letter;
    avatar.style.background = `var(--g-${a.color})`;
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTab(g.id, t.id); }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveTabBy(t.id, e.key === 'ArrowUp' ? -1 : 1); }
  });
  input.addEventListener('paste', e => {
    const text = e.clipboardData?.getData('text') || '';
    const { valid } = parseUrls(text);
    if (valid.length > 1) {
      e.preventDefault();
      mutate(() => {
        const f = find('tab', t.id);
        const taken = allIds();
        const extra = valid.map(url => ({ id: newId('tab', hostOf(url), taken), url }));
        if (!f.t.url) { f.t.url = extra.shift().url; }
        f.g.tabs.splice(f.ti + 1, 0, ...extra);
      });
      toast(`${valid.length} URLs eingefügt.`);
    }
  });

  const grip = h('span', { class: 'grip', title: 'Ziehen zum Verschieben (oder Alt+↑/↓)', 'aria-hidden': 'true' }, icon('grip'));
  const protectedTab = t.protect !== false;
  const lock = h('button', {
    type: 'button', class: `lock-btn${protectedTab ? ' on' : ''}`, 'aria-pressed': String(protectedTab),
    'aria-label': protectedTab ? 'Geschützt – wird nach dem Schließen wieder geöffnet. Klicken: darf geschlossen werden' : 'Darf geschlossen werden. Klicken: schützen',
    title: protectedTab ? 'Geschützt: wird nach dem Schließen automatisch wieder geöffnet' : 'Frei: gehört zur Vorlage, darf aber geschlossen bleiben',
    onclick: () => mutate(() => { setProtect(find('tab', t.id).t, !protectedTab); })
  }, icon(protectedTab ? 'lock' : 'unlock'), protectedTab ? null : h('span', { class: 'lock-txt', text: 'frei' }));
  const li = h('li', { class: `tab${protectedTab ? '' : ' free'}`, dataset: { tid: t.id } },
    grip, avatar, input, lock,
    h('span', { class: `live-dot${known.has(t.id) ? '' : ' none'}`, dataset: { liveTab: t.id } }),
    iconBtn('x', 'Tab entfernen', () => removeTab(t.id), { class: 'danger' }));
  makeDraggable(li, grip, 'tab', t.id);
  return li;
}

// Schutz-Flag: nur „false“ wird gespeichert (Standard ist geschützt).
function setProtect(t, on) {
  if (on) delete t.protect; else t.protect = false;
}

function applyLive() {
  const { wins, tabs } = liveMaps();
  const inactive = liveStatus && cur().id !== liveStatus.activeProfile;
  for (const el of document.querySelectorAll('[data-live-win]')) {
    const key = el.dataset.liveWin;
    if (inactive && el.textContent !== 'neu') { el.className = 'badge closed'; el.textContent = 'Profil nicht aktiv'; continue; }
    if (!wins.has(key)) continue;
    el.className = `badge ${wins.get(key) ? 'open' : 'closed'}`;
    el.textContent = wins.get(key) ? 'offen' : 'nicht offen';
  }
  for (const el of document.querySelectorAll('[data-live-tab]')) {
    const t = tabs.get(el.dataset.liveTab);
    if (!t) { el.className = 'live-dot'; el.title = inactive ? 'Profil nicht aktiv' : 'Noch nicht gespeichert'; continue; }
    el.className = `live-dot ${t.misplaced ? 'misplaced' : t.present ? 'on' : 'off'}`;
    el.title = t.misplaced ? 'Offen, aber außerhalb der Gruppe' : t.present ? (t.protect ? 'Offen und geschützt' : 'Offen (darf geschlossen werden)') : 'Derzeit nicht offen';
  }
  // Kopfzeile
  const pill = $('livePill');
  const s = liveStatus;
  if (!s) { pill.className = 'pill'; pill.textContent = '…'; return; }
  $('liveEnabled').checked = s.enabled;
  if (s.sync?.enabled && s.sync.pendingChoice) { pill.className = 'pill warn'; pill.textContent = 'Sync: Auswahl nötig'; }
  else if (s.configRev === 0) { pill.className = 'pill'; pill.textContent = 'Keine eigene Vorlage'; }
  else if (!s.configValid) { pill.className = 'pill err'; pill.textContent = 'Vorlage ungültig'; }
  else if (s.suspended) { pill.className = 'pill err'; pill.textContent = 'Automatik angehalten'; }
  else if (!s.enabled) { pill.className = 'pill'; pill.textContent = 'Schutz aus'; }
  else if (s.totals.missing) { pill.className = 'pill warn'; pill.textContent = `${s.totals.present}/${s.totals.expected} offen`; }
  else { pill.className = 'pill ok'; pill.textContent = `Geschützt · ${s.totals.expected} Tabs`; }
}

// ---------------------------------------------------------------------------------------------
// Validierung
// ---------------------------------------------------------------------------------------------

function humanPath(pi, wi, gi, ti) {
  const p = draft.profiles[pi];
  const parts = [];
  if (draft.profiles.length > 1 || +pi !== curIndex()) parts.push(p ? (p.name || `Profil ${+pi + 1}`) : `Profil ${+pi + 1}`);
  if (wi === undefined) return parts.join(' › ') || 'Profil';
  const w = p?.windows?.[wi];
  parts.push(w ? (w.name || `Fenster ${+wi + 1}`) : `Fenster ${+wi + 1}`);
  if (gi !== undefined) {
    const g = w?.groups[gi];
    parts.push(g ? (g.title || `Gruppe ${+gi + 1}`) : `Gruppe ${+gi + 1}`);
  }
  if (ti !== undefined) parts.push(`Tab ${+ti + 1}`);
  return parts.join(' › ');
}

const PATH_RE = /profiles\[(\d+)\](?:\.windows\[(\d+)\])?(?:\.groups\[(\d+)\])?(?:\.tabs\[(\d+)\])?/g;

function humanize(msg) {
  return msg.replace(PATH_RE, (_, pi, wi, gi, ti) => `„${humanPath(pi, wi, gi, ti)}“`);
}

function locate(path) {
  let p = path;
  while (p) {
    const el = document.querySelector(`[data-path="${CSS.escape(p)}"]`);
    if (el) return el;
    const cut = Math.max(p.lastIndexOf('.'), p.lastIndexOf('['));
    if (cut <= 0) break;
    p = p.slice(0, cut);
  }
  return null;
}

function scheduleValidate() {
  clearTimeout(validateTimer);
  validateTimer = setTimeout(validateNow, 150);
}

function validateNow() {
  const v = validateConfig(draft);
  for (const el of document.querySelectorAll('.invalid')) { el.classList.remove('invalid'); el.removeAttribute('data-err'); }
  const items = [];
  for (const err of v.errors) {
    const idx = err.indexOf(': ');
    const path = idx > 0 ? err.slice(0, idx) : '';
    const msg = idx > 0 ? err.slice(idx + 2) : err;
    const el = path ? locate(path) : null;
    if (el) { el.classList.add('invalid'); el.title = humanize(msg); }
    const m = /^profiles\[(\d+)\](?:\.windows\[(\d+)\])?(?:\.groups\[(\d+)\])?(?:\.tabs\[(\d+)\])?/.exec(path);
    const where = m ? `${humanPath(m[1], m[2], m[3], m[4])}: ` : '';
    const pid = m ? draft.profiles[+m[1]]?.id : null;
    items.push({ text: `${where}${humanize(msg)}`, el, pid, path, kind: 'err' });
  }

  const summary = $('valToggle');
  const list = $('valList');
  summary.replaceChildren();
  list.replaceChildren();
  const tabs = W().reduce((n, w) => n + w.groups.reduce((m, g) => m + g.tabs.length, 0), 0);
  const free = W().reduce((n, w) => n + w.groups.reduce((m, g) => m + g.tabs.filter(t => t.protect === false).length, 0), 0);
  const groups = W().reduce((n, w) => n + w.groups.length, 0);
  if (v.ok) {
    summary.className = 'val-summary ok';
    summary.append(icon('check'), h('span', { text: 'Vorlage ist gültig' }),
      h('span', { class: 'sub', text: `${draft.profiles.length > 1 ? `${draft.profiles.length} Profile · dieses: ` : ''}${W().length} Fenster · ${groups} Gruppen · ${tabs} Tabs${free ? ` (${free} frei)` : ''}` }));
    summary.setAttribute('aria-expanded', 'false');
    list.hidden = true;
  } else {
    summary.className = 'val-summary err';
    summary.append(icon('alert'), h('span', { text: `${items.length} ${items.length === 1 ? 'Problem' : 'Probleme'} – Speichern erst nach Korrektur möglich` }),
      h('span', { class: 'sub', text: list.hidden ? 'Anzeigen' : 'Ausblenden' }));
    for (const it of items) {
      list.append(h('li', {
        text: it.text,
        onclick: () => {
          let el = it.el;
          if (it.pid && it.pid !== cur().id) { editPid = it.pid; renderEditor(); el = locate(it.path); } // Fehler in anderem Profil
          if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (el.focus) el.focus(); }
        }
      }));
    }
  }
  $('btnSave').disabled = !isDirty() || !v.ok;
  $('btnSaveOnly').disabled = !isDirty() || !v.ok;
  return v;
}

// ---------------------------------------------------------------------------------------------
// Struktur-Aktionen
// ---------------------------------------------------------------------------------------------

function addWindow() {
  let gid;
  let tid;
  mutate(() => {
    const taken = allIds();
    const n = W().length + 1;
    const title = uniqueTitle('Neue Gruppe');
    gid = newId('gruppe', title, taken);
    tid = newId('tab', 'tab', taken);
    W().push({
      id: newId('fenster', `fenster-${n}`, taken), name: `Fenster ${n}`,
      groups: [{ id: gid, title, color: nextFreeColor(), collapsed: false, tabs: [{ id: tid, url: '' }] }]
    });
  });
  focusPath(`[data-gid="${gid}"] .grp-title`, true);
}

// Legt eine Gruppe im Fensterobjekt an (ohne Rückgängig-Schritt; Aufrufer nutzt mutate()).
function pushGroup(w, { tabs = [], title = 'Neue Gruppe', color } = {}) {
  const taken = allIds();
  const t = uniqueTitle(title);
  const gid = newId('gruppe', t, taken);
  const list = tabs.length ? tabs.map(url => ({ id: newId('tab', hostOf(url), taken), url })) : [{ id: newId('tab', 'tab', taken), url: '' }];
  w.groups.push({ id: gid, title: t, color: color || nextFreeColor(), collapsed: false, tabs: list });
  return gid;
}

function addGroup(windowId, opts = {}) {
  let gid;
  mutate(() => { gid = pushGroup(find('window', windowId).w, opts); });
  if (!opts.tabs?.length) focusPath(`[data-gid="${gid}"] .grp-title`, true);
  return gid;
}

function addTab(groupId, afterTabId) {
  let tid;
  mutate(() => {
    const f = find('group', groupId);
    tid = newId('tab', 'tab');
    const idx = afterTabId ? f.g.tabs.findIndex(t => t.id === afterTabId) + 1 : f.g.tabs.length;
    f.g.tabs.splice(idx, 0, { id: tid, url: '' });
  });
  focusPath(`[data-tid="${tid}"] .tab-url`);
}

function focusPath(selector, select) {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.focus();
    if (select && el.select) el.select();
  });
}

function removeWindow(id) {
  const f = find('window', id);
  mutate(() => { W().splice(f.wi, 1); });
  toast(`Fenster „${f.w.name || 'ohne Namen'}“ entfernt.`, { label: 'Rückgängig', run: undo });
}

function removeGroup(id) {
  const f = find('group', id);
  mutate(() => { f.w.groups.splice(f.gi, 1); });
  toast(`Gruppe „${f.g.title || 'ohne Namen'}“ entfernt.`, { label: 'Rückgängig', run: undo });
}

function removeTab(id) {
  const f = find('tab', id);
  mutate(() => { f.g.tabs.splice(f.ti, 1); delete bind.tabs[id]; });
  toast('Tab entfernt.', { label: 'Rückgängig', run: undo });
}

function moveWindow(id, dir) {
  const f = find('window', id);
  const to = f.wi + dir;
  if (to < 0 || to >= W().length) return;
  mutate(() => { W().splice(to, 0, W().splice(f.wi, 1)[0]); });
}

function moveGroup(id, dir) {
  const f = find('group', id);
  const to = f.gi + dir;
  if (to < 0 || to >= f.w.groups.length) return;
  mutate(() => { f.w.groups.splice(to, 0, f.w.groups.splice(f.gi, 1)[0]); });
}

function moveTabBy(id, dir) {
  const f = find('tab', id);
  const to = f.ti + dir;
  if (to < 0 || to >= f.g.tabs.length) return;
  mutate(() => { f.g.tabs.splice(to, 0, f.g.tabs.splice(f.ti, 1)[0]); });
  focusPath(`[data-tid="${id}"] .tab-url`);
}

// ---------------------------------------------------------------------------------------------
// Drag & Drop
// ---------------------------------------------------------------------------------------------

function makeDraggable(el, handle, kind, id) {
  handle.addEventListener('mousedown', () => { el.draggable = true; });
  handle.addEventListener('mouseup', () => { el.draggable = false; });
  el.addEventListener('dragstart', e => {
    if (e.target !== el) return;
    dragItem = { kind, id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-tabi', id);
    requestAnimationFrame(() => el.classList.add('dragging'));
  });
  el.addEventListener('dragend', () => {
    el.draggable = false;
    el.classList.remove('dragging');
    dragItem = null;
    clearDropMarks();
  });
}

function clearDropMarks() {
  for (const el of document.querySelectorAll('.drop-line')) el.remove();
  for (const el of document.querySelectorAll('.drop-over')) el.classList.remove('drop-over');
}

function dropIndex(container, selector, clientY) {
  const items = [...container.children].filter(el => el.matches(selector) && !el.classList.contains('dragging'));
  const idx = items.findIndex(el => { const r = el.getBoundingClientRect(); return clientY < r.top + r.height / 2; });
  return { items, idx: idx === -1 ? items.length : idx };
}

function showLine(container, items, idx, tag) {
  for (const el of document.querySelectorAll('.drop-line')) el.remove();
  const line = h(tag, { class: 'drop-line', 'aria-hidden': 'true' });
  if (idx < items.length) container.insertBefore(line, items[idx]);
  else container.append(line);
}

function isExternalLinkDrag(e) {
  const types = [...(e.dataTransfer?.types || [])];
  return !dragItem && (types.includes('text/uri-list') || types.includes('text/plain'));
}

function setupTabDrop(list, groupId) {
  list.addEventListener('dragover', e => {
    if (dragItem?.kind !== 'tab' && !isExternalLinkDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = dragItem ? 'move' : 'copy';
    const { items, idx } = dropIndex(list, '.tab', e.clientY);
    showLine(list, items, idx, 'li');
    list.closest('.grp')?.classList.add('drop-over');
  });
  list.addEventListener('dragleave', e => {
    if (!list.contains(e.relatedTarget)) { list.closest('.grp')?.classList.remove('drop-over'); for (const el of list.querySelectorAll('.drop-line')) el.remove(); }
  });
  list.addEventListener('drop', e => {
    if (dragItem?.kind !== 'tab' && !isExternalLinkDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const { idx } = dropIndex(list, '.tab', e.clientY);
    clearDropMarks();
    if (dragItem?.kind === 'tab') {
      const id = dragItem.id;
      mutate(() => {
        const src = find('tab', id);
        const [tab] = src.g.tabs.splice(src.ti, 1);
        find('group', groupId).g.tabs.splice(idx, 0, tab);
      });
    } else {
      const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      const { valid } = parseUrls(text.split('\n').filter(l => !l.startsWith('#')).join('\n'));
      if (!valid.length) { toast('Keine gültige http(s)-Adresse erkannt.'); return; }
      mutate(() => {
        const g = find('group', groupId).g;
        const taken = allIds();
        g.tabs.splice(idx, 0, ...valid.map(url => ({ id: newId('tab', hostOf(url), taken), url })));
      });
      toast(`${valid.length} Tab(s) hinzugefügt.`);
    }
  });
}

function setupGroupDrop(container, windowId) {
  container.addEventListener('dragover', e => {
    if (dragItem?.kind !== 'group') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const { items, idx } = dropIndex(container, '.grp', e.clientY);
    showLine(container, items, idx, 'div');
  });
  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget)) for (const el of container.querySelectorAll(':scope > .drop-line')) el.remove();
  });
  container.addEventListener('drop', e => {
    if (dragItem?.kind !== 'group') return;
    e.preventDefault();
    const { idx } = dropIndex(container, '.grp', e.clientY);
    const id = dragItem.id;
    clearDropMarks();
    mutate(() => {
      const src = find('group', id);
      const [g] = src.w.groups.splice(src.gi, 1);
      find('window', windowId).w.groups.splice(idx, 0, g);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Farbwahl
// ---------------------------------------------------------------------------------------------

function swatchButtons(current, onPick) {
  return GROUP_COLORS.map(c => h('button', {
    type: 'button', class: 'swatch', role: 'radio', 'aria-checked': String(c === current), 'aria-label': COLOR_NAMES[c], title: COLOR_NAMES[c],
    dataset: { color: c }, onclick: () => onPick(c)
  }, h('i', { style: `background: var(--g-${c})` }), h('span', { text: COLOR_NAMES[c] })));
}

function openColorPop(anchor, current, onPick) {
  const pop = $('colorPop');
  pop.replaceChildren(...swatchButtons(current, c => { closeColorPop(); onPick(c); }));
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 12);
  pop.style.left = `${Math.max(8, left)}px`;
  pop.style.top = `${window.scrollY + r.bottom + 6}px`;
  (pop.querySelector('[aria-checked="true"]') || pop.firstChild).focus();
  setTimeout(() => {
    document.addEventListener('mousedown', outsideClose, { once: true });
  }, 0);
  function outsideClose(e) {
    if (!pop.contains(e.target)) closeColorPop();
    else document.addEventListener('mousedown', outsideClose, { once: true });
  }
}

function closeColorPop() { $('colorPop').hidden = true; }

$('colorPop').addEventListener('keydown', e => {
  const btns = [...$('colorPop').querySelectorAll('.swatch')];
  const i = btns.indexOf(document.activeElement);
  if (e.key === 'Escape') { closeColorPop(); return; }
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
  if (step) { e.preventDefault(); btns[(i + step + btns.length) % btns.length].focus(); }
});

// ---------------------------------------------------------------------------------------------
// Dialog: URLs einfügen
// ---------------------------------------------------------------------------------------------

let urlsColor = 'blue';

function openUrlDialog({ groupId, windowId } = {}) {
  const dlg = $('dlgUrls');
  $('urlsText').value = '';
  $('urlsGroupTitle').value = '';
  $('urlsInfo').textContent = '';
  const target = $('urlsTarget');
  target.replaceChildren(h('option', { value: '__new', text: '➕ Neue Gruppe …' }));
  for (const w of W()) {
    const og = h('optgroup', { label: w.name || 'Fenster' });
    for (const g of w.groups) og.append(h('option', { value: g.id, text: g.title || '(ohne Namen)' }));
    if (og.children.length) target.append(og);
  }
  target.value = groupId || '__new';
  const winSel = $('urlsWindow');
  winSel.replaceChildren(...W().map(w => h('option', { value: w.id, text: w.name || 'Fenster' })), h('option', { value: '__new', text: '➕ Neues Fenster' }));
  winSel.value = windowId || W()[0]?.id || '__new';
  urlsColor = nextFreeColor();
  renderUrlColors();
  $('urlsTitle').textContent = groupId ? `URLs zu „${find('group', groupId).g.title || 'Gruppe'}“ hinzufügen` : 'URLs einfügen';
  syncUrlTarget();
  dlg.showModal();
  $('urlsText').focus();
}

function renderUrlColors() {
  $('urlsColors').replaceChildren(...swatchButtons(urlsColor, c => { urlsColor = c; renderUrlColors(); }));
}

function syncUrlTarget() {
  $('urlsNew').hidden = $('urlsTarget').value !== '__new';
}

$('urlsTarget').addEventListener('change', syncUrlTarget);
$('urlsText').addEventListener('input', () => {
  const { valid, invalid } = parseUrls($('urlsText').value);
  $('urlsInfo').textContent = valid.length || invalid.length
    ? `${valid.length} gültige Adresse(n)${invalid.length ? ` · ${invalid.length} ignoriert: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? ' …' : ''}` : ''}`
    : '';
});

$('dlgUrls').querySelector('form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const { valid } = parseUrls($('urlsText').value);
  if (!valid.length) { e.preventDefault(); $('urlsInfo').textContent = 'Bitte mindestens eine gültige http(s)-Adresse eingeben.'; return; }
  const targetId = $('urlsTarget').value;
  if (targetId !== '__new') {
    mutate(() => {
      const g = find('group', targetId).g;
      const taken = allIds();
      if (g.tabs.length === 1 && !g.tabs[0].url) g.tabs = [];
      g.tabs.push(...valid.map(url => ({ id: newId('tab', hostOf(url), taken), url })));
    });
  } else {
    const winId = $('urlsWindow').value;
    const opts = { tabs: valid, title: $('urlsGroupTitle').value || 'Neue Gruppe', color: urlsColor };
    mutate(() => {
      let w;
      if (winId === '__new') {
        const n = W().length + 1;
        w = { id: newId('fenster', `fenster-${n}`), name: `Fenster ${n}`, groups: [] };
        W().push(w);
      } else {
        w = find('window', winId).w;
      }
      pushGroup(w, opts);
    });
  }
  toast(`${valid.length} Tab(s) hinzugefügt.`);
});

// ---------------------------------------------------------------------------------------------
// Dialog: Aktuelle Sitzung übernehmen
// ---------------------------------------------------------------------------------------------

const isWebUrl = u => /^https?:\/\//i.test(u || '');
let captureData = null;

async function openCapture() {
  let res;
  try {
    res = await send({ type: 'captureSession' });
  } catch (e) {
    toast(`Sitzung konnte nicht gelesen werden: ${e.message}`);
    return;
  }
  captureData = res.windows;
  const list = $('capList');
  list.replaceChildren();
  captureData.forEach((w, i) => {
    const web = w.tabs.filter(t => isWebUrl(t.url));
    const ungrouped = web.filter(t => t.groupId === -1);
    const skipped = w.tabs.length - web.length;
    const groupsWithTabs = w.groups.filter(g => web.some(t => t.groupId === g.groupId));
    const chk = h('input', { type: 'checkbox', dataset: { idx: i } });
    chk.checked = web.length > 0;
    chk.disabled = web.length === 0;
    const ung = h('input', { type: 'checkbox', dataset: { ung: i } });
    ung.checked = groupsWithTabs.length === 0 && ungrouped.length > 0;
    const managedName = w.managedKey ? saved.profiles.flatMap(p => p.windows).find(x => x.id === w.managedKey)?.name : null;
    list.append(h('div', { class: 'cap-win' },
      h('label', {}, chk,
        h('span', {}, h('b', { text: managedName || `Fenster ${i + 1}` }),
          h('span', { class: 'sub', text: `  ${w.focused ? 'aktives Fenster · ' : ''}${groupsWithTabs.length} Gruppe(n) · ${web.length} Tab(s)${managedName ? ' · bereits Teil der Vorlage' : ''}` }))),
      groupsWithTabs.length ? h('div', { class: 'cap-chips' }, groupsWithTabs.map(g =>
        h('span', { class: 'cap-chip', style: `--gc: var(--g-${g.color})`, text: `${g.title || 'Ohne Namen'} · ${web.filter(t => t.groupId === g.groupId).length}` }))) : null,
      ungrouped.length ? h('div', { class: 'cap-opt' }, h('label', {}, ung, `${ungrouped.length} ungruppierte(n) Tab(s) als Gruppe „Sonstiges“ aufnehmen`)) : null,
      skipped ? h('div', { class: 'cap-opt muted small', text: `${skipped} interne Seite(n) (edge://, Erweiterungen …) werden übersprungen.` }) : null));
  });
  if (!captureData.length) list.append(h('div', { class: 'muted', text: 'Keine normalen Browserfenster gefunden.' }));
  $('dlgCapture').querySelector('input[value="replace"]').checked = true;
  $('capProfileName').textContent = `„${cur().name || 'ohne Namen'}“`;
  $('dlgCapture').showModal();
}

$('dlgCapture').querySelector('form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const selected = [...$('capList').querySelectorAll('input[data-idx]')].filter(c => c.checked).map(c => +c.dataset.idx);
  if (!selected.length) { e.preventDefault(); toast('Bitte mindestens ein Fenster auswählen.'); return; }
  const mode = $('dlgCapture').querySelector('input[name="capMode"]:checked').value;
  const withUngrouped = new Set([...$('capList').querySelectorAll('input[data-ung]')].filter(c => c.checked).map(c => +c.dataset.ung));
  applyCapture(selected, withUngrouped, mode);
});

function applyCapture(selected, withUngrouped, mode) {
  pushUndo();
  if (mode === 'newprofile') {
    const d = new Date();
    const pname = uniqueProfileName(`Sitzung ${d.toLocaleDateString('de-DE')}`);
    const p = { id: newId('profil', pname), name: pname, windows: [] };
    draft.profiles.push(p);
    editPid = p.id;
  }
  if (mode === 'replace') { cur().windows = []; bind = emptyBind(); }
  const taken = allIds();
  const titles = allTitles();
  const inDraft = new Set(taken);
  const savedWins = new Map((saved?.profiles || []).flatMap(p => p.windows).map(w => [w.id, w]));
  const useKey = (key, fallbackPrefix, label) => {
    if (key && !taken.has(key)) { taken.add(key); return key; }
    return newId(fallbackPrefix, label, taken);
  };
  let tabCount = 0;
  let skippedManaged = 0;

  for (const i of selected) {
    const cw = captureData[i];
    const win = { id: useKey(mode === 'replace' ? cw.managedKey : null, 'fenster', `fenster-${W().length + 1}`), name: '', groups: [] };
    win.name = (cw.managedKey && savedWins.get(cw.managedKey)?.name) || `Fenster ${W().length + 1}`;
    const byGroup = new Map();
    const order = [];
    for (const t of cw.tabs) {
      if (!isWebUrl(t.url)) continue;
      if (mode === 'append' && t.managedKey && inDraft.has(t.managedKey)) { skippedManaged++; continue; }
      let gkey = t.groupId;
      if (gkey === -1) {
        if (!withUngrouped.has(i)) continue;
        gkey = 'ungrouped';
      }
      if (!byGroup.has(gkey)) {
        const src = cw.groups.find(g => g.groupId === gkey);
        const title = uniqueTitle(src ? (src.title || 'Gruppe') : 'Sonstiges', titles);
        const g = {
          id: useKey(mode === 'replace' ? src?.managedKey : null, 'gruppe', title), title,
          color: src?.color || 'grey', collapsed: !!src?.collapsed, tabs: []
        };
        if (src) bind.groups[g.id] = src.groupId;
        byGroup.set(gkey, g);
        order.push(g);
      }
      const g = byGroup.get(gkey);
      const id = useKey(mode === 'replace' ? t.managedKey : null, 'tab', hostOf(t.url));
      g.tabs.push({ id, url: t.url });
      bind.tabs[id] = t.tabId;
      tabCount++;
    }
    win.groups = order;
    if (win.groups.length) {
      W().push(win);
      bind.windows[win.id] = cw.windowId;
    }
  }
  renderEditor();
  toast(`${tabCount} Tab(s) aus der Sitzung übernommen${skippedManaged ? ` (${skippedManaged} bereits in der Vorlage)` : ''}. Prüfen und „Als Standard speichern“.`, { label: 'Rückgängig', run: undo });
}

// ---------------------------------------------------------------------------------------------
// Dialog: Aus offenen Tabs wählen
// ---------------------------------------------------------------------------------------------

let pickGroupId = null;

async function openPick(groupId) {
  pickGroupId = groupId;
  let res;
  try { res = await send({ type: 'captureSession' }); } catch (e) { toast(`Tabs konnten nicht gelesen werden: ${e.message}`); return; }
  const inDraft = allIds();
  const bound = new Set(Object.values(bind.tabs));
  const list = $('pickList');
  list.replaceChildren();
  res.windows.forEach((w, i) => {
    const rows = w.tabs.filter(t => isWebUrl(t.url) && !(t.managedKey && inDraft.has(t.managedKey)) && !bound.has(t.tabId));
    if (!rows.length) return;
    const sec = h('div', { class: 'pick-win' }, h('h3', { text: `Fenster ${i + 1}${w.focused ? ' (aktiv)' : ''}` }));
    for (const t of rows) {
      const g = w.groups.find(x => x.groupId === t.groupId);
      sec.append(h('label', { class: 'pick-row', dataset: { filter: `${t.title} ${t.url}`.toLowerCase() } },
        h('input', { type: 'checkbox', dataset: { tabId: t.tabId, url: t.url } }),
        g ? h('span', { class: 'dot', style: `background: var(--g-${g.color})`, title: g.title }) : null,
        h('span', { class: 't', text: t.title || t.url }),
        h('span', { class: 'u', text: hostOf(t.url) })));
    }
    list.append(sec);
  });
  if (!list.children.length) list.append(h('div', { class: 'muted', text: 'Keine weiteren offenen Webseiten gefunden.' }));
  $('pickFilter').value = '';
  $('pickTitle').textContent = `Offene Tabs zu „${find('group', groupId).g.title || 'Gruppe'}“ hinzufügen`;
  $('dlgPick').showModal();
  $('pickFilter').focus();
}

$('pickFilter').addEventListener('input', () => {
  const q = $('pickFilter').value.trim().toLowerCase();
  for (const row of $('pickList').querySelectorAll('.pick-row')) row.hidden = !!q && !row.dataset.filter.includes(q);
});

$('dlgPick').querySelector('form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const chosen = [...$('pickList').querySelectorAll('input:checked')].map(c => ({ tabId: +c.dataset.tabId, url: c.dataset.url }));
  if (!chosen.length) { e.preventDefault(); toast('Bitte mindestens einen Tab auswählen.'); return; }
  mutate(() => {
    const g = find('group', pickGroupId).g;
    if (g.tabs.length === 1 && !g.tabs[0].url) g.tabs = [];
    const taken = allIds();
    for (const c of chosen) {
      const id = newId('tab', hostOf(c.url), taken);
      g.tabs.push({ id, url: c.url });
      bind.tabs[id] = c.tabId;
    }
  });
  toast(`${chosen.length} offene(r) Tab(s) verknüpft. Sie werden beim Speichern in die Gruppe verschoben.`);
});

// ---------------------------------------------------------------------------------------------
// Laden, Speichern, Import/Export
// ---------------------------------------------------------------------------------------------

async function loadStored() {
  const res = await send({ type: 'getConfig' });
  loadedRev = res.configRev;
  saved = normalizeDraft(res.config);
  draft = clone(saved);
  bind = emptyBind();
  undoStack = [];
  if (!editPid || !draft.profiles.some(p => p.id === editPid)) editPid = res.activeProfile || draft.profiles[0].id;
  renderEditor();
  if (!res.valid) toast('Die gespeicherte Vorlage ist ungültig – bitte die markierten Stellen korrigieren.');
}

async function save(apply) {
  const v = validateNow();
  if (!v.ok) {
    $('valList').hidden = false;
    toast('Bitte zuerst die markierten Probleme beheben.');
    return;
  }
  const btns = [$('btnSave'), $('btnSaveOnly')];
  btns.forEach(b => { b.disabled = true; });
  try {
    const res = await send({ type: 'saveConfig', config: draft, apply, bind });
    if (!res.saved) {
      toast(`Nicht gespeichert: ${res.errors?.[0] || 'unbekannter Fehler'}`);
      return;
    }
    saved = clone(draft);
    bind = emptyBind();
    liveStatus = res.status || liveStatus;
    if (liveStatus) loadedRev = liveStatus.configRev;
    remoteChangedWhileDirty = false;
    renderEditor();
    const r = res.result;
    toast(apply && r
      ? `Als Standard gespeichert. ${r.created} Tab(s) geöffnet, ${r.moved} eingeordnet${r.windows ? `, ${r.windows} Fenster erstellt` : ''}.`
      : 'Gespeichert. Fehlende Tabs öffnen sich beim nächsten Start oder über „Vorlage wiederherstellen“.');
  } catch (e) {
    toast(`Speichern fehlgeschlagen: ${e.message}`);
  } finally {
    updateDirty();
    validateNow();
  }
}

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

function download(filename, text, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function exportAs(kind) {
  const p = cur();
  const slug = slugify(p.name) || 'profil';
  if (kind === 'all') download(`tabi-vorlage-${fileStamp()}.json`, JSON.stringify(draft, null, 2), 'application/json');
  if (kind === 'profile') download(`tabi-profil-${slug}-${fileStamp()}.json`, JSON.stringify({ tabiProfile: 1, version: 2, profile: p }, null, 2), 'application/json');
  if (kind === 'html') download(`tabi-favoriten-${slug}-${fileStamp()}.html`, exportBookmarksHtml(p), 'text/html');
  if (kind === 'txt') download(`tabi-links-${slug}-${fileStamp()}.txt`, exportLinkList(p), 'text/plain');
  if (isDirty()) toast('Hinweis: Exportiert wurde der aktuelle Stand im Editor (noch nicht gespeichert).');
}

function openExportMenu() {
  const menu = $('exportMenu');
  const btn = $('btnExport');
  if (!menu.hidden) { closeExportMenu(); return; }
  const name = cur().name || 'ohne Namen';
  menu.querySelector('[data-export="profile"] b').textContent = `Profil „${name}“`;
  menu.querySelector('[data-export="html"] b').textContent = `Profil „${name}“ als Favoriten`;
  menu.querySelector('[data-export="txt"] b').textContent = `Profil „${name}“ als Linkliste`;
  menu.hidden = false;
  const r = btn.getBoundingClientRect();
  menu.style.top = `${window.scrollY + r.bottom + 6}px`;
  menu.style.left = `${Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - menu.offsetWidth - 12))}px`;
  btn.setAttribute('aria-expanded', 'true');
  menu.querySelector('button').focus();
  setTimeout(() => document.addEventListener('mousedown', outside, { once: true }), 0);
  function outside(e) {
    if (menu.contains(e.target) || e.target === btn || btn.contains(e.target)) { if (!menu.hidden) document.addEventListener('mousedown', outside, { once: true }); return; }
    closeExportMenu();
  }
}

function closeExportMenu() {
  $('exportMenu').hidden = true;
  $('btnExport').setAttribute('aria-expanded', 'false');
}

// ---------------------------------------------------------------------------------------------
// Import (JSON-Vorlage, Profil-JSON, Favoriten-HTML, Linkliste)
// ---------------------------------------------------------------------------------------------

let pendingImport = null; // { kind: 'config'|'profiles'|'tabs', ... }

async function importFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Die Datei ist größer als 5 MB – zu groß für einen Import.'); return; }
  const text = await file.text();
  const lname = file.name.toLowerCase();
  let baseName = file.name.replace(/\.[^.]+$/, '').replace(/^tabi-(favoriten|links|profil)-/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (/^(favorites|favoriten|bookmarks|lesezeichen)([_\s-].*)?$/i.test(baseName)) baseName = 'Favoriten';

  if (lname.endsWith('.json') || /^\s*[{[]/.test(text)) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { toast(`Datei ist kein gültiges JSON: ${e.message}`); return; }
    if (parsed && parsed.tabiProfile && parsed.profile) {
      openImport({ kind: 'profiles', profiles: [parsed.profile], title: 'Profil importieren' });
      return;
    }
    const cfg = migrateConfig(parsed);
    if (!cfg || !Array.isArray(cfg.profiles)) { toast('Diese JSON-Datei ist keine Tabi-Vorlage.'); return; }
    openImport({ kind: 'config', config: cfg, profiles: cfg.profiles, title: 'Vorlage importieren' });
    return;
  }
  let parsed;
  if (/<dl|netscape-bookmark/i.test(text) || /\.html?$/.test(lname)) {
    parsed = parseBookmarksHtml(text);
    if (!parsed.windows.length) { toast('In der Datei wurden keine http(s)-Favoriten gefunden.'); return; }
  } else {
    parsed = parseLinkList(text, parseUrls);
    if (!parsed.windows.length) { toast('In der Datei wurden keine gültigen Adressen gefunden.'); return; }
  }
  openImport({ kind: 'tabs', windows: parsed.windows, name: baseName, title: /\.html?$/.test(lname) ? 'Favoriten importieren' : 'Linkliste importieren' });
}

function countTabs(windows) {
  return windows.reduce((n, w) => n + w.groups.reduce((m, g) => m + g.tabs.length, 0), 0);
}

function openImport(imp) {
  pendingImport = imp;
  $('impTitle').textContent = imp.title;
  const groupsBox = $('impGroups');
  groupsBox.replaceChildren();
  const modes = $('impModes');
  const name = cur().name || 'ohne Namen';
  let opts;
  if (imp.kind === 'tabs') {
    const ng = imp.windows.reduce((n, w) => n + w.groups.length, 0);
    $('impSummary').textContent = `Gefunden: ${imp.windows.length} Fenster · ${ng} Gruppe(n) · ${countTabs(imp.windows)} Tab(s). Wähle, was übernommen werden soll:`;
    imp.windows.forEach((w, wi) => {
      if (imp.windows.length > 1) groupsBox.append(h('div', { class: 'iw', text: w.name }));
      w.groups.forEach((g, gi) => groupsBox.append(h('label', {},
        h('input', { type: 'checkbox', checked: true, dataset: { w: wi, g: gi }, onchange: updateImportWarn }),
        g.color ? h('span', { class: 'dot', style: `background: var(--g-${GROUP_COLORS.includes(g.color) ? g.color : 'grey'})` }) : null,
        h('span', { text: g.title }), h('span', { class: 'n', text: `${g.tabs.length}` }))));
    });
    opts = [['newprofile', `Als neues Profil „${uniqueProfileName(imp.name || 'Import')}“`], ['append', `Zum Profil „${name}“ hinzufügen`], ['replace', `Profil „${name}“ ersetzen`]];
  } else if (imp.kind === 'profiles') {
    $('impSummary').textContent = `Profil „${imp.profiles[0].name}“ mit ${countTabs(imp.profiles[0].windows || [])} Tab(s).`;
    opts = [['addprofiles', 'Als neues Profil hinzufügen'], ['replaceprofile', `Profil „${name}“ ersetzen`]];
  } else {
    const nt = imp.profiles.reduce((n, p) => n + countTabs(p.windows || []), 0);
    $('impSummary').textContent = `Vorlage mit ${imp.profiles.length} Profil(en) und ${nt} Tab(s): ${imp.profiles.map(p => p.name).join(', ')}.`;
    opts = [['replaceall', 'Alle Profile und Einstellungen ersetzen'], ['addprofiles', 'Als zusätzliche Profile hinzufügen']];
  }
  modes.replaceChildren(h('legend', { class: 'sr-only', text: 'Wie importieren?' }),
    ...opts.map(([v, label], i) => h('label', {}, h('input', { type: 'radio', name: 'impMode', value: v, checked: i === 0 }), label)));
  updateImportWarn();
  $('dlgImport').showModal();
}

function updateImportWarn() {
  const imp = pendingImport;
  let n = 0;
  if (imp?.kind === 'tabs') {
    for (const c of $('impGroups').querySelectorAll('input:checked')) n += imp.windows[+c.dataset.w].groups[+c.dataset.g].tabs.length;
  }
  const warn = $('impWarn');
  warn.hidden = n <= 120;
  warn.textContent = `${n} Tabs sind sehr viele: Beim Aufbau öffnen sich alle gleichzeitig, und der Sync ist auf ca. 90 KB begrenzt. Am besten nur die benötigten Ordner auswählen.`;
}

// Neutrale Struktur → Vorlagenfenster mit frischen IDs; Gruppennamen je Profil eindeutig.
function neutralToWindows(nwindows, picked, profile) {
  const taken = allIds();
  const titles = new Set(profile.windows.flatMap(w => w.groups.map(g => (g.title || '').toLowerCase())));
  const used = new Set(profile.windows.flatMap(w => w.groups.map(g => g.color)));
  const palette = GROUP_COLORS.filter(c => c !== 'grey');
  let ci = 0;
  const nextColor = () => {
    const free = palette.find(c => !used.has(c));
    const c = free || palette[ci++ % palette.length];
    used.add(c);
    return c;
  };
  const out = [];
  nwindows.forEach((w, wi) => {
    const groups = [];
    w.groups.forEach((g, gi) => {
      if (picked && !picked.has(`${wi}:${gi}`)) return;
      const title = uniqueTitle((g.title || 'Gruppe').slice(0, 60), titles);
      groups.push({
        id: newId('gruppe', title, taken), title,
        color: GROUP_COLORS.includes(g.color) ? g.color : nextColor(), collapsed: !!g.collapsed,
        tabs: g.tabs.map(t => ({ id: newId('tab', hostOf(t.url), taken), url: t.url, ...(t.protect === false ? { protect: false } : {}) }))
      });
    });
    if (groups.length) out.push({ id: newId('fenster', w.name || 'fenster', taken), name: w.name || `Fenster ${out.length + 1}`, groups });
  });
  return out;
}

// Profil mit neuen IDs versehen, falls sie mit vorhandenen kollidieren.
function reIdProfile(p, taken) {
  const fix = (id, prefix, label) => (id && !taken.has(id) ? (taken.add(id), id) : newId(prefix, label, taken));
  return {
    id: fix(p.id, 'profil', p.name), name: uniqueProfileName(p.name || 'Import'),
    windows: (p.windows || []).map(w => ({
      ...w, id: fix(w.id, 'fenster', w.name),
      groups: (w.groups || []).map(g => ({ ...g, id: fix(g.id, 'gruppe', g.title), tabs: (g.tabs || []).map(t => ({ ...t, id: fix(t.id, 'tab', hostOf(t.url)) })) }))
    }))
  };
}

$('dlgImport').querySelector('form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok' || !pendingImport) return;
  const imp = pendingImport;
  const mode = $('impModes').querySelector('input:checked')?.value;
  let msg = '';
  if (imp.kind === 'tabs') {
    const picked = new Set([...$('impGroups').querySelectorAll('input:checked')].map(c => `${c.dataset.w}:${c.dataset.g}`));
    if (!picked.size) { e.preventDefault(); toast('Bitte mindestens eine Gruppe auswählen.'); return; }
    mutate(() => {
      let target = cur();
      if (mode === 'newprofile') {
        const pname = uniqueProfileName(imp.name || 'Import');
        target = { id: newId('profil', pname), name: pname, windows: [] };
        draft.profiles.push(target);
        editPid = target.id;
      }
      const wins = neutralToWindows(imp.windows, picked, mode === 'replace' ? { windows: [] } : target);
      if (mode === 'replace') target.windows = wins; else target.windows.push(...wins);
      msg = `${countTabs(wins)} Tab(s) in ${wins.reduce((n, w) => n + w.groups.length, 0)} Gruppe(n) übernommen`;
    });
  } else if (mode === 'replaceall') {
    pushUndo();
    draft = normalizeDraft(imp.config);
    bind = emptyBind();
    if (!draft.profiles.some(p => p.id === editPid)) editPid = draft.profiles[0].id;
    renderEditor();
    msg = 'Vorlage ersetzt';
  } else if (mode === 'replaceprofile') {
    mutate(() => {
      const taken = allIds();
      for (const id of allIds({ profiles: [cur()] })) taken.delete(id); // eigene IDs dürfen wiederverwendet werden
      const fresh = reIdProfile(imp.profiles[0], taken);
      cur().windows = fresh.windows;
    });
    msg = `Profil „${cur().name}“ ersetzt`;
  } else {
    mutate(() => {
      const taken = allIds();
      for (const p of imp.profiles) {
        const fresh = reIdProfile(normalizeDraft({ profiles: [p] }).profiles[0], taken);
        draft.profiles.push(fresh);
        editPid = fresh.id;
      }
    });
    msg = `${imp.profiles.length} Profil(e) hinzugefügt`;
  }
  pendingImport = null;
  toast(`${msg} – prüfen und „Als Standard speichern“.`, { label: 'Rückgängig', run: undo });
});

// ---------------------------------------------------------------------------------------------
// Ansichten: JSON & Protokoll
// ---------------------------------------------------------------------------------------------

function showView(name) {
  for (const b of document.querySelectorAll('.seg-btn')) b.setAttribute('aria-selected', String(b.dataset.view === name));
  for (const v of ['editor', 'json', 'log']) $(`view-${v}`).hidden = v !== name;
  $('validation').hidden = name !== 'editor';
  if (name === 'json') { $('json').value = JSON.stringify(draft, null, 2); $('jsonResult').textContent = ''; $('jsonResult').className = 'result'; }
  if (name === 'log') loadLog();
}

function jsonResult(kind, text) {
  $('jsonResult').className = `result ${kind}`;
  $('jsonResult').textContent = text;
}

function checkJson() {
  let parsed;
  try { parsed = JSON.parse($('json').value); } catch (e) { jsonResult('err', `Ungültiges JSON: ${e.message}`); return null; }
  const v = validateConfig(parsed);
  if (!v.ok) jsonResult('err', `${v.errors.length} Fehler:\n${v.errors.map(x => `• ${x}`).join('\n')}`);
  else jsonResult(v.warnings.length ? 'warn' : 'ok', v.warnings.length ? `Gültig, mit Hinweisen:\n${v.warnings.map(x => `• ${x}`).join('\n')}` : 'Gültig.');
  return parsed;
}

async function loadLog() {
  try {
    const res = await send({ type: 'getLog' });
    const fmt = t => { const d = new Date(t); return `${d.toLocaleTimeString('de-DE')}.${String(d.getMilliseconds()).padStart(3, '0')}`; };
    $('log').textContent = res.log.slice().reverse().map(e => {
      let line = `${fmt(e.t)} ${e.level.toUpperCase().padEnd(5)} ${e.msg}`;
      if (e.data !== undefined) line += `\n        ${JSON.stringify(e.data)}`;
      return line;
    }).join('\n') || '(leer)';
  } catch (e) {
    $('log').textContent = `Protokoll nicht verfügbar: ${e.message}`;
  }
}

async function refreshLive() {
  try {
    liveStatus = (await send({ type: 'getStatus' })).status;
  } catch { return; /* Hintergrunddienst startet gerade */ }
  // Vorlage wurde anderswo geändert (anderes Gerät per Sync)?
  if (loadedRev !== null && liveStatus.configRev !== loadedRev) {
    if (!isDirty()) {
      await loadStored();
      const from = liveStatus.sync?.lastFrom;
      toast(from ? `Vorlage von „${from}“ übernommen.` : 'Vorlage wurde aktualisiert.');
    } else {
      remoteChangedWhileDirty = true;
    }
  }
  applyLive();
  renderSync();
  renderBanner();
}

// ---------------------------------------------------------------------------------------------
// Sync & Hinweisbanner
// ---------------------------------------------------------------------------------------------

let remoteChangedWhileDirty = false;

function fmtDateTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today ? `heute ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderSync() {
  const s = liveStatus?.sync;
  if (!s) return;
  $('syncCard').classList.toggle('off', !s.enabled);
  $('syncEnabled').checked = s.enabled;
  if (document.activeElement !== $('syncDevice')) $('syncDevice').value = s.deviceName || '';
  const info = $('syncInfo');
  let kind = 'ok';
  let text;
  if (!s.available) { kind = 'err'; text = 'Dieser Browser stellt keinen Sync-Speicher bereit.'; }
  else if (!s.enabled) { kind = ''; text = 'Sync ist aus – die Vorlage bleibt nur auf diesem Gerät.'; }
  else if (s.error) { kind = 'err'; text = s.error; }
  else if (s.pendingChoice) { kind = 'warn'; text = 'Entscheidung nötig – siehe Hinweis oben.'; }
  else if (liveStatus.configRev === 0) { kind = 'warn'; text = 'Warte auf eine Vorlage von deinen anderen Geräten …'; }
  else {
    const parts = [];
    if (s.lastPushAt) parts.push(`hochgeladen ${fmtDateTime(s.lastPushAt)}`);
    if (s.lastPullAt) parts.push(`zuletzt empfangen ${fmtDateTime(s.lastPullAt)}${s.lastFrom ? ` von „${s.lastFrom}“` : ''}`);
    text = parts.length ? `Synchron · ${parts.join(' · ')}` : 'Bereit – wird beim nächsten Speichern hochgeladen.';
  }
  if (info.dataset.sig === `${kind}|${text}`) return;
  info.dataset.sig = `${kind}|${text}`;
  info.className = `sync-info ${kind}`;
  info.replaceChildren(h('span', { class: 'sdot' }), h('span', { text }));
}

function renderBanner() {
  const b = $('banner');
  const s = liveStatus;
  if (!s) return;
  let content = null;
  if (s.sync?.enabled && s.sync.pendingChoice) {
    const pc = s.sync.pendingChoice;
    content = {
      kind: 'warn', icon: 'cloud',
      title: 'Welche Vorlage soll gelten?',
      text: `Im Sync liegt eine andere Vorlage – zuletzt gespeichert auf „${pc.deviceName || 'anderem Gerät'}“${pc.savedAt ? ` (${fmtDateTime(pc.savedAt)})` : ''}. Die Vorlage auf diesem Gerät ist anders. Bis du entscheidest, wird nichts synchronisiert.`,
      actions: [
        { label: 'Vorlage aus dem Sync übernehmen', primary: true, run: () => resolveChoice('download') },
        { label: 'Diese Vorlage für alle Geräte verwenden', run: () => resolveChoice('upload') }
      ]
    };
  } else if (remoteChangedWhileDirty) {
    content = {
      kind: 'warn', icon: 'cloud',
      title: 'Die Vorlage wurde auf einem anderen Gerät geändert',
      text: 'Du hast hier ungespeicherte Änderungen. Speicherst du sie, ersetzen sie die neuere Fassung auf allen Geräten.',
      actions: [{ label: 'Neuere Fassung laden (eigene Änderungen verwerfen)', run: async () => { remoteChangedWhileDirty = false; await loadStored(); renderBanner(); } }]
    };
  } else if (s.configRev === 0 && !isDirty()) {
    content = {
      kind: '', icon: 'info',
      title: 'Noch keine eigene Vorlage auf diesem Gerät',
      text: s.sync?.enabled
        ? 'Hast du Tabi schon auf einem anderen Gerät eingerichtet, kommt deine Vorlage automatisch per Sync – das kann ein paar Minuten dauern. Oder richte sie jetzt ein: Fenster in Edge anordnen und übernehmen. Unten siehst du die Beispielvorlage.'
        : 'Richte deine Vorlage ein: Fenster in Edge anordnen und übernehmen – oder eine exportierte Datei importieren. Unten siehst du die Beispielvorlage.',
      actions: [{ label: 'Aktuelle Sitzung übernehmen', primary: true, run: openCapture }]
    };
  }
  if (!content) { b.hidden = true; b.dataset.sig = ''; return; }
  // Nur neu zeichnen, wenn sich der Inhalt ändert – sonst gingen Klicks während der Aktualisierung verloren.
  const sig = `${content.kind}|${content.title}|${content.text}`;
  if (!b.hidden && b.dataset.sig === sig) return;
  b.dataset.sig = sig;
  b.className = `banner ${content.kind}`;
  b.replaceChildren(icon(content.icon), h('div', { class: 'b-body' },
    h('div', { class: 'b-title', text: content.title }),
    h('div', { class: 'b-text', text: content.text }),
    h('div', { class: 'b-actions' }, content.actions.map(a => h('button', { type: 'button', class: `btn ${a.primary ? 'primary' : ''}`, text: a.label, onclick: a.run })))));
  b.hidden = false;
}

async function resolveChoice(choice) {
  if (choice === 'download' && isDirty() && !confirm('Ungespeicherte Änderungen im Editor gehen verloren. Fortfahren?')) return;
  try {
    liveStatus = (await send({ type: 'setSync', choice })).status;
    await loadStored();
    loadedRev = liveStatus.configRev;
    toast(choice === 'download' ? 'Vorlage aus dem Sync übernommen.' : 'Diese Vorlage gilt jetzt für alle Geräte.');
  } catch (e) {
    toast(`Sync-Auswahl fehlgeschlagen: ${e.message}`);
  }
  renderSync();
  renderBanner();
}

async function updateSync(patch, okText) {
  try {
    liveStatus = (await send({ type: 'setSync', ...patch })).status;
    if (liveStatus.configRev !== loadedRev && !isDirty()) await loadStored();
    loadedRev = liveStatus.configRev;
    if (okText) toast(okText);
  } catch (e) {
    toast(`Sync: ${e.message}`);
  }
  renderSync();
  renderBanner();
}

// ---------------------------------------------------------------------------------------------
// Verdrahtung
// ---------------------------------------------------------------------------------------------

for (const btn of document.querySelectorAll('[data-icon]')) btn.prepend(icon(btn.dataset.icon));
for (const b of document.querySelectorAll('.seg-btn')) b.addEventListener('click', () => showView(b.dataset.view));

$('btnCapture').addEventListener('click', openCapture);
$('btnUrls').addEventListener('click', () => openUrlDialog());
$('btnExport').addEventListener('click', openExportMenu);
for (const b of $('exportMenu').querySelectorAll('[data-export]')) {
  b.addEventListener('click', () => { closeExportMenu(); exportAs(b.dataset.export); });
}
$('exportMenu').addEventListener('keydown', e => {
  const items = [...$('exportMenu').querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { closeExportMenu(); $('btnExport').focus(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
});
$('fileImport').addEventListener('change', e => { importFile(e.target.files[0]); e.target.value = ''; });
$('btnAddWindow').addEventListener('click', addWindow);
$('btnSave').addEventListener('click', () => save(true));
$('btnSaveOnly').addEventListener('click', () => save(false));
$('btnDiscard').addEventListener('click', async () => {
  if (remoteChangedWhileDirty) {
    remoteChangedWhileDirty = false;
    await loadStored();
    renderBanner();
    toast('Neuere Fassung geladen.');
    return;
  }
  pushUndo();
  draft = clone(saved);
  bind = emptyBind();
  renderEditor();
  toast('Änderungen verworfen.', { label: 'Rückgängig', run: undo });
});
$('setReuse').addEventListener('change', e => mutate(() => { draft.settings.reuseEmptyStartupWindow = e.target.checked; }, { render: false }));
$('setFocus').addEventListener('change', e => mutate(() => { draft.settings.focusCreatedWindows = e.target.checked; }, { render: false }));
$('valToggle').addEventListener('click', () => {
  if ($('valToggle').classList.contains('ok')) return;
  const list = $('valList');
  list.hidden = !list.hidden;
  $('valToggle').setAttribute('aria-expanded', String(!list.hidden));
  const sub = $('valToggle').querySelector('.sub');
  if (sub) sub.textContent = list.hidden ? 'Anzeigen' : 'Ausblenden';
});
$('liveEnabled').addEventListener('change', async e => {
  try {
    liveStatus = (await send({ type: 'setEnabled', enabled: e.target.checked })).status;
    applyLive();
    toast(e.target.checked ? 'Schutz aktiviert – fehlende Pflicht-Tabs wurden ergänzt.' : 'Schutz deaktiviert – offene Tabs bleiben unverändert.');
  } catch (err) { toast(`Umschalten fehlgeschlagen: ${err.message}`); }
});

$('syncEnabled').addEventListener('change', e => updateSync({ enabled: e.target.checked }, e.target.checked ? 'Sync eingeschaltet.' : 'Sync ausgeschaltet.'));
$('syncDevice').addEventListener('change', e => updateSync({ deviceName: e.target.value }, 'Gerätename gespeichert.'));
$('btnSyncNow').addEventListener('click', async () => {
  try {
    liveStatus = (await send({ type: 'syncNow' })).status;
    toast(liveStatus.sync?.error ? `Sync: ${liveStatus.sync.error}` : 'Synchronisiert.');
  } catch (e) { toast(`Sync fehlgeschlagen: ${e.message}`); }
  await refreshLive();
});
$('btnEdgeSync').addEventListener('click', async () => {
  try { await chrome.tabs.create({ url: 'edge://settings/profiles/sync' }); }
  catch { toast('Bitte manuell öffnen: edge://settings/profiles/sync'); }
});

$('btnJsonCheck').addEventListener('click', checkJson);
$('btnJsonApply').addEventListener('click', () => {
  let parsed;
  try { parsed = JSON.parse($('json').value); } catch (e) { jsonResult('err', `Ungültiges JSON: ${e.message}`); return; }
  pushUndo();
  draft = normalizeDraft(parsed);
  renderEditor();
  showView('editor');
  toast('JSON in den Editor übernommen.', { label: 'Rückgängig', run: undo });
});
$('btnLog').addEventListener('click', loadLog);
$('btnLogClear').addEventListener('click', async () => { await send({ type: 'clearLog' }); loadLog(); });

document.addEventListener('keydown', e => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('btnSave').disabled) save(true); }
  if (e.ctrlKey && e.key.toLowerCase() === 'z' && !inField && !$('view-editor').hidden) { e.preventDefault(); undo(); }
});
window.addEventListener('beforeunload', e => { if (draft && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('dragend', () => { dragItem = null; clearDropMarks(); });

(async () => {
  try {
    await loadStored();
  } catch (e) {
    saved = normalizeDraft(null);
    draft = clone(saved);
    renderEditor();
    toast(`Vorlage konnte nicht geladen werden: ${e.message}`);
  }
  refreshLive();
  setInterval(refreshLive, 3000);
  if (location.hash === '#capture') { history.replaceState(null, '', location.pathname); openCapture(); }
})();
