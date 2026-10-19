// Tabi – Service-Worker (Manifest V3)
//
// Grundprinzipien (ausführlich: docs/ARCHITEKTUR.md):
//  * Es gibt KEINE API, die das Schließen eines Tabs verhindert. Tabi öffnet geschlossene
//    Pflicht-Tabs stattdessen kontrolliert wieder.
//  * Der Service-Worker kann jederzeit beendet werden. Sämtlicher Laufzeitzustand liegt daher in
//    chrome.storage.session (überlebt SW-Neustarts, wird beim Browserneustart geleert), die
//    Konfiguration und Wiedererkennungs-Hinweise in chrome.storage.local.
//  * Alle verändernden Vorgänge laufen strikt nacheinander über eine Warteschlange (enqueue).
//  * Identität eines Pflicht-Tabs während seiner Lebensdauer = Browser-Tab-ID (nicht die URL).
//    Nach einem Browserneustart werden Tabs konservativ über Gruppentitel + URL-Hinweise erkannt.

import { DEFAULT_CONFIG, validateConfig, flattenConfig, migrateConfig, allKeys } from './lib/config.js';
import { META_KEY, encodeTemplate, decodeTemplate, staleChunkKeys } from './lib/sync.js';

const TAG = '[Tabi]';

// Startphase: Warten, bis die Sitzungswiederherstellung „zur Ruhe“ gekommen ist.
const SETTLE_QUIET_MS = 1500;   // so lange darf sich nichts mehr ändern
const SETTLE_MIN_MS = 1200;     // Mindestwartezeit
const SETTLE_MAX_MS = 20000;    // Obergrenze, danach wird trotzdem fortgefahren
const SETTLE_POLL_MS = 300;

// Bündelung von Schließ-Ereignissen (z. B. „Gruppe schließen“ = viele onRemoved-Ereignisse).
const REPAIR_DEBOUNCE_MS = 500;
const REPAIR_MAX_DELAY_MS = 3000;

// Fallback, falls der SW ohne onStartup/onInstalled startet (z. B. Erweiterung wieder aktiviert).
const FALLBACK_BOOT_DELAY_MS = 1500;

// Schleifenschutz.
const KEY_LIMIT = 5;            // max. automatische Neuerstellungen pro Pflicht-Tab …
const RATE_WINDOW_MS = 60000;   // … innerhalb dieses Zeitfensters
const GLOBAL_LIMIT = 25;        // max. automatische Neuerstellungen insgesamt im Zeitfenster

const LOG_MAX = 300;
const NEWTAB_PREFIXES = [
  'edge://newtab', 'chrome://newtab', 'edge://new-tab-page', 'chrome://new-tab-page',
  'chrome-search://local-ntp', 'about:blank'
];

// ---------------------------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------------------------

function freshRuntime() {
  return {
    bootDone: false,        // Start-/Install-/Update-Behandlung in DIESER Browsersitzung erledigt
    bootMode: null,
    bootedAt: null,
    startupPending: false,  // Browserstart erkannt, Aufbau aber noch nicht abgeschlossen
    awaitingWindow: false,  // kein normales Fenster offen → Aufbau beim nächsten Fenster
    windows: {},            // windowKey -> windowId
    groups: {},             // groupKey  -> groupId
    tabs: {},               // tabKey    -> tabId
    pending: [],            // geschlossene Pflicht-Tabs, die auf Wiederherstellung warten
    pendingSince: null,
    recent: {},             // tabKey -> [Zeitstempel automatischer Neuerstellungen]
    recentAll: [],
    paused: {},             // tabKey -> true (Schleifenschutz hat ausgelöst)
    suspended: false,       // globaler Schleifenschutz hat ausgelöst
    suspendReason: null,
    lastAction: null,
    lastError: null,
    log: []
  };
}

let rt = freshRuntime();
let rawConfig = null;   // so gespeichert, wie der Nutzer sie eingegeben hat
let cfg = null;         // normalisiert & gültig, sonst null
let flat = null;        // Nachschlagetabellen
let configError = null;
let enabled = true;
let hints = { tabs: {}, groups: {} }; // tabKey -> {lastUrl}, groupKey -> {lastTitle}
// Revision der Vorlage: 0 = unveränderte Beispielvorlage (wird nie automatisch aufgebaut),
// sonst Zeitstempel der letzten Speicherung (hier oder auf einem anderen Gerät via Sync).
let configRev = 0;
// Aktives Profil – bewusst NUR lokal (jedes Gerät kann ein anderes Profil nutzen).
let activeProfile = null;
// Geräteeinstellungen für den Sync (nur lokal gespeichert).
let syncCfg = { enabled: true, deviceId: '', deviceName: '' };
let syncState = { lastPushAt: null, lastPullAt: null, lastFrom: null, error: null, pendingChoice: null };

let lastActivity = Date.now();
let busyWith = null;
let startupEventSeen = false;
let installedEventSeen = false;
let repairTimer = null;
let rtSaveTimer = null;
let hintsSaveTimer = null;

function applyConfig(raw) {
  const v = validateConfig(raw);
  if (v.ok) {
    cfg = v.config;
    flat = flattenConfig(cfg, activeProfile);
    if (flat.profileId !== activeProfile) {
      // Aktives Profil existiert nicht (mehr) → erstes Profil verwenden.
      activeProfile = flat.profileId;
      chrome.storage.local.set({ activeProfile }).catch(() => {});
    }
    configError = null;
  } else {
    cfg = null;
    flat = null;
    configError = v.errors.join(' | ');
  }
}

async function loadAll() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(['config', 'configRev', 'enabled', 'hints', 'sync', 'syncState', 'activeProfile']),
    chrome.storage.session.get(['rt'])
  ]);
  activeProfile = local.activeProfile || null;
  if (local.config === undefined) {
    rawConfig = structuredClone(DEFAULT_CONFIG);
    configRev = 0;
    await chrome.storage.local.set({ config: rawConfig, configRev });
  } else {
    rawConfig = migrateConfig(local.config); // Version 1 → 2 (ein Profil „Standard“)
    configRev = typeof local.configRev === 'number'
      ? local.configRev
      : (JSON.stringify(rawConfig) === JSON.stringify(DEFAULT_CONFIG) ? 0 : 1); // Daten aus Tabi 0.1/0.2 (ohne configRev)
  }
  applyConfig(rawConfig);
  enabled = local.enabled !== false;
  syncCfg = { enabled: true, deviceId: '', deviceName: '', ...(local.sync || {}) };
  if (!syncCfg.deviceId) {
    syncCfg.deviceId = Math.random().toString(36).slice(2, 10);
    syncCfg.deviceName = syncCfg.deviceName || `Gerät ${syncCfg.deviceId.slice(0, 4).toUpperCase()}`;
    await chrome.storage.local.set({ sync: syncCfg });
  }
  if (local.syncState) syncState = { ...syncState, ...local.syncState };
  if (local.hints && typeof local.hints === 'object') {
    hints = { tabs: local.hints.tabs || {}, groups: local.hints.groups || {} };
  }
  if (session.rt && typeof session.rt === 'object') {
    rt = { ...freshRuntime(), ...session.rt };
  }
  if (configError) log('error', `Gespeicherte Konfiguration ist ungültig: ${configError}`);
}

const ready = loadAll().catch(e => {
  console.error(TAG, 'Zustand konnte nicht geladen werden', e);
  configError = configError || `Laden fehlgeschlagen: ${e?.message || e}`;
});

async function saveRt() {
  clearTimeout(rtSaveTimer);
  rtSaveTimer = null;
  try {
    await chrome.storage.session.set({ rt });
  } catch (e) {
    console.error(TAG, 'Speichern des Laufzeitzustands fehlgeschlagen', e);
  }
}

function saveRtSoon() {
  if (!rtSaveTimer) rtSaveTimer = setTimeout(saveRt, 300);
}

function saveHintsSoon() {
  if (hintsSaveTimer) return;
  hintsSaveTimer = setTimeout(async () => {
    hintsSaveTimer = null;
    try {
      await chrome.storage.local.set({ hints });
    } catch (e) {
      console.error(TAG, 'Speichern der Hinweise fehlgeschlagen', e);
    }
  }, 1000);
}

function log(level, msg, data) {
  const entry = { t: Date.now(), level, msg };
  if (data !== undefined) entry.data = data;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (data !== undefined) fn(TAG, msg, data); else fn(TAG, msg);
  rt.log.push(entry);
  if (rt.log.length > LOG_MAX) rt.log.splice(0, rt.log.length - LOG_MAX);
  if (level === 'error') rt.lastError = { t: entry.t, msg };
  saveRtSoon();
}

function setLastAction(text) {
  rt.lastAction = { t: Date.now(), text };
}

// ---------------------------------------------------------------------------------------------
// Serialisierung: alle verändernden Vorgänge laufen nacheinander.
// ---------------------------------------------------------------------------------------------

let chain = Promise.resolve();

function enqueue(name, fn) {
  const job = chain.then(async () => {
    await ready;
    busyWith = name;
    try {
      return await fn();
    } catch (e) {
      log('error', `Fehler in „${name}“: ${e?.message || e}`);
      throw e;
    } finally {
      busyWith = null;
      await saveRt();
      updateBadge().catch(() => {});
    }
  });
  chain = job.catch(() => {});
  return job;
}

// ---------------------------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------------------------

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getTab(id) {
  if (id == null) return null;
  try { return await chrome.tabs.get(id); } catch { return null; }
}

async function getGroup(id) {
  if (id == null || id === -1) return null;
  try { return await chrome.tabGroups.get(id); } catch { return null; }
}

async function getWindow(id) {
  if (id == null) return null;
  try { return await chrome.windows.get(id); } catch { return null; }
}

function isNormalWin(w) {
  return !!w && w.type === 'normal' && !w.incognito;
}

async function normalWindows(populate = false) {
  const wins = await chrome.windows.getAll({ populate, windowTypes: ['normal'] });
  return wins.filter(isNormalWin);
}

function tabUrl(tab) {
  return (tab && (tab.url || tab.pendingUrl)) || '';
}

function isNewTabUrl(url) {
  return !url || NEWTAB_PREFIXES.some(p => url.startsWith(p));
}

// Wiederholt Aufrufe, die der Browser während eines Tab-Drags ablehnt (dokumentiertes Verhalten).
async function withRetry(label, fn) {
  const delays = [100, 400, 1200];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e);
      if (i < delays.length && /cannot be edited right now|dragging/i.test(msg)) {
        log('info', `${label}: Browser blockiert gerade Tab-Änderungen (Drag?), neuer Versuch in ${delays[i]} ms.`);
        await sleep(delays[i]);
        continue;
      }
      throw e;
    }
  }
}

function keyOfTab(tabId) {
  for (const [k, id] of Object.entries(rt.tabs)) if (id === tabId) return k;
  return null;
}

function keyOfGroup(groupId) {
  for (const [k, id] of Object.entries(rt.groups)) if (id === groupId) return k;
  return null;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url || '';
  }
}

function originOf(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

// 3 = exakt gleiche URL, 2 = gleich bis auf #Anker/abschließenden Slash, 1 = gleiche Origin, 0 = nichts
function urlMatchLevel(tabKey, url) {
  if (!url) return 0;
  const refs = [flat.tabs[tabKey].url, hints.tabs[tabKey]?.lastUrl].filter(Boolean);
  if (refs.includes(url)) return 3;
  const n = normalizeUrl(url);
  if (refs.some(r => normalizeUrl(r) === n)) return 2;
  const o = originOf(url);
  if (o && o !== 'null' && refs.some(r => originOf(r) === o)) return 1;
  return 0;
}

function groupTitleMatches(groupKey, title) {
  const t = (title || '').trim().toLowerCase();
  if (!t) return false;
  const g = flat.groups[groupKey];
  if (t === g.title.toLowerCase()) return true;
  const last = (hints.groups[groupKey]?.lastTitle || '').trim().toLowerCase();
  return !!last && t === last;
}

// Entfernt Zuordnungen zu Schlüsseln, die in der Konfiguration nicht mehr existieren.
// Die betroffenen Tabs bleiben offen und gelten ab jetzt als nicht verwaltet.
function pruneToConfig() {
  if (!flat) return;
  for (const k of Object.keys(rt.tabs)) if (!flat.tabs[k]) delete rt.tabs[k];
  for (const k of Object.keys(rt.groups)) if (!flat.groups[k]) delete rt.groups[k];
  for (const k of Object.keys(rt.windows)) if (!flat.windows[k]) delete rt.windows[k];
  for (const k of Object.keys(rt.paused)) if (!flat.tabs[k]) delete rt.paused[k];
  for (const k of Object.keys(rt.recent)) if (!flat.tabs[k]) delete rt.recent[k];
  rt.pending = rt.pending.filter(k => flat.tabs[k]);
  let changed = false;
  // Hinweise inaktiver Profile behalten – sie helfen beim späteren Wechsel zurück.
  const known = allKeys(cfg);
  for (const k of Object.keys(hints.tabs)) if (!known.has(k)) { delete hints.tabs[k]; changed = true; }
  for (const k of Object.keys(hints.groups)) if (!known.has(k)) { delete hints.groups[k]; changed = true; }
  if (changed) saveHintsSoon();
}

// --- Auflösen von Zuordnungen (mit Selbstheilung) ----------------------------------------------

async function liveTab(tabKey) {
  const id = rt.tabs[tabKey];
  if (id == null) return null;
  const t = await getTab(id);
  if (!t || t.incognito) {
    delete rt.tabs[tabKey];
    return null;
  }
  return t;
}

async function liveGroup(groupKey) {
  const id = rt.groups[groupKey];
  if (id != null) {
    const g = await getGroup(id);
    if (g) return g;
    delete rt.groups[groupKey];
  }
  // Ableiten: Liegt ein lebender Pflicht-Tab dieser Gruppe in einer Gruppe mit passendem Titel?
  // (Deckt z. B. den Fall ab, dass der Browser beim Verschieben einer Gruppe eine neue ID vergibt.)
  const used = new Set(Object.values(rt.groups));
  for (const tk of flat.groups[groupKey].tabKeys) {
    const t = await liveTab(tk);
    if (!t || t.groupId === -1 || used.has(t.groupId)) continue;
    const g = await getGroup(t.groupId);
    if (g && groupTitleMatches(groupKey, g.title)) {
      rt.groups[groupKey] = g.id;
      log('info', `Gruppe „${flat.groups[groupKey].title}“ über einen ihrer Pflicht-Tabs wiedergefunden.`, { groupId: g.id });
      return g;
    }
  }
  return null;
}

async function liveWindow(windowKey) {
  const id = rt.windows[windowKey];
  if (id != null) {
    const w = await getWindow(id);
    if (isNormalWin(w)) return w;
    delete rt.windows[windowKey];
  }
  // Ableiten über die (verwalteten) Gruppen dieses Vorlagenfensters – nie über lose Tabs.
  const usedWins = new Set(Object.values(rt.windows));
  const votes = new Map();
  for (const gk of flat.windows[windowKey].groupKeys) {
    const g = await liveGroup(gk);
    if (g && !usedWins.has(g.windowId)) votes.set(g.windowId, (votes.get(g.windowId) || 0) + 1);
  }
  let best = null;
  let bestVotes = 0;
  for (const [wid, n] of votes) if (n > bestVotes) { best = wid; bestVotes = n; }
  if (best != null) {
    const w = await getWindow(best);
    if (isNormalWin(w)) {
      rt.windows[windowKey] = w.id;
      return w;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Übernahme bestehender Tabs (nach Browserstart, Update, Aktivierung, manuellem Wiederherstellen)
// ---------------------------------------------------------------------------------------------
//
// Konservative Strategie:
//  1. Bestehende Zuordnungen werden geprüft (Tab/Gruppe/Fenster existiert noch?).
//  2. Eine Browser-Gruppe wird einer Vorlagengruppe NUR zugeordnet, wenn ihr Titel dem
//     konfigurierten Titel (oder dem zuletzt beobachteten Titel) entspricht.
//  3. Tabs werden NUR innerhalb einer zugeordneten Gruppe übernommen, und nur bei URL-Treffer
//     (exakt > normalisiert > gleiche Origin) gegen Start-URL oder zuletzt bekannte URL.
//     Die unscharfen Stufen gelten nur, wenn die Laufzeitzuordnung verloren ging (rt.bootDone=false).
//  4. Tabs außerhalb zugeordneter Gruppen werden nie übernommen.

async function adoptExisting(reason) {
  if (!flat) return { tabs: 0, groups: 0 };
  pruneToConfig();

  const wins = await normalWindows(true);
  const winIds = new Set(wins.map(w => w.id));
  const allTabs = wins.flatMap(w => w.tabs || []);
  const tabIds = new Set(allTabs.map(t => t.id));
  const groups = (await chrome.tabGroups.query({})).filter(g => winIds.has(g.windowId));
  const groupIds = new Set(groups.map(g => g.id));

  for (const k of Object.keys(rt.tabs)) if (!tabIds.has(rt.tabs[k])) delete rt.tabs[k];
  for (const k of Object.keys(rt.groups)) if (!groupIds.has(rt.groups[k])) delete rt.groups[k];
  for (const k of Object.keys(rt.windows)) if (!winIds.has(rt.windows[k])) delete rt.windows[k];

  const tabsByGroup = new Map();
  for (const t of allTabs) {
    if (t.groupId === -1) continue;
    if (!tabsByGroup.has(t.groupId)) tabsByGroup.set(t.groupId, []);
    tabsByGroup.get(t.groupId).push(t);
  }
  for (const list of tabsByGroup.values()) list.sort((a, b) => a.index - b.index);

  const usedTabIds = new Set(Object.values(rt.tabs));
  const usedGroupIds = new Set(Object.values(rt.groups));
  // Unscharfe Treffer (normalisiert / gleiche Origin) nur, wenn die Laufzeitzuordnung verloren ging
  // (Browserstart, Update, Reaktivierung) oder Tabi auf diesem Gerät noch gar keinen Pflicht-Tab kennt
  // (Neuinstallation, erste Vorlage per Import/Sync). Sonst ist ein nicht zugeordneter Tab ein
  // fremder Tab und wird nur bei exakt gleicher URL übernommen.
  const levels = (!rt.bootDone || Object.keys(rt.tabs).length === 0) ? [3, 2, 1] : [3];
  let adoptedTabs = 0;
  let adoptedGroups = 0;

  for (const gk of Object.keys(flat.groups)) {
    const gdef = flat.groups[gk];
    let groupId = rt.groups[gk];

    if (groupId == null) {
      const cands = groups.filter(g => !usedGroupIds.has(g.id) && groupTitleMatches(gk, g.title));
      let best = null;
      let bestScore = 0;
      for (const g of cands) {
        const members = tabsByGroup.get(g.id) || [];
        let urlScore = 0;
        for (const tk of gdef.tabKeys) if (members.some(t => urlMatchLevel(tk, tabUrl(t)) > 0)) urlScore += 2;
        // Gleicher Name allein reicht NICHT: sonst würde eine eigene, zufällig gleichnamige Gruppe
        // „gekapert“. Mindestens ein Tab muss zur Vorlage passen.
        if (urlScore === 0) continue;
        const score = urlScore + (g.color === gdef.color ? 1 : 0);
        if (score > bestScore) { best = g; bestScore = score; }
      }
      if (best) {
        groupId = best.id;
        rt.groups[gk] = groupId;
        usedGroupIds.add(groupId);
        adoptedGroups++;
        if (cands.length > 1) {
          log('warn', `Mehrere Gruppen heißen „${gdef.title}“ – die mit den meisten passenden Tabs wurde übernommen, die anderen bleiben unverwaltet.`);
        }
      } else if (cands.length) {
        log('info', `Gruppe „${gdef.title}“ existiert, enthält aber keinen passenden Tab – sie bleibt unangetastet, die Vorlagengruppe wird separat aufgebaut.`);
      }
    }
    if (groupId == null) continue;

    const members = (tabsByGroup.get(groupId) || []).filter(t => !usedTabIds.has(t.id));
    for (const level of levels) {
      for (const tk of gdef.tabKeys) {
        if (rt.tabs[tk] != null) continue;
        const hit = members.find(t => !usedTabIds.has(t.id) && urlMatchLevel(tk, tabUrl(t)) === level);
        if (hit) {
          rt.tabs[tk] = hit.id;
          usedTabIds.add(hit.id);
          adoptedTabs++;
        }
      }
    }
  }

  for (const wk of flat.windowOrder) await liveWindow(wk);

  log('info', `Übernahme (${reason}): ${adoptedGroups} Gruppe(n), ${adoptedTabs} Tab(s) neu zugeordnet.`, {
    windows: { ...rt.windows }, groups: { ...rt.groups }, tabs: { ...rt.tabs }
  });
  return { tabs: adoptedTabs, groups: adoptedGroups };
}

// ---------------------------------------------------------------------------------------------
// Positionsberechnung
// ---------------------------------------------------------------------------------------------

// Nächster vorheriger / nachfolgender Pflicht-Tab derselben Vorlagengruppe, der aktuell in
// der Browser-Gruppe groupId liegt.
function managedNeighbors(windowTabs, groupId, groupKey, tabKey) {
  const byId = new Map(windowTabs.map(t => [t.id, t]));
  const keys = flat.groups[groupKey].tabKeys;
  const pos = keys.indexOf(tabKey);
  let prev = null;
  let next = null;
  for (let i = pos - 1; i >= 0 && !prev; i--) {
    const t = byId.get(rt.tabs[keys[i]]);
    if (t && t.groupId === groupId) prev = t;
  }
  for (let i = pos + 1; i < keys.length && !next; i++) {
    const t = byId.get(rt.tabs[keys[i]]);
    if (t && t.groupId === groupId) next = t;
  }
  return { prev, next };
}

async function indexForTabInGroup(windowId, groupId, groupKey, tabKey) {
  const tabs = await chrome.tabs.query({ windowId });
  const { prev, next } = managedNeighbors(tabs, groupId, groupKey, tabKey);
  if (prev) return prev.index + 1;
  if (next) return next.index;
  const inGroup = tabs.filter(t => t.groupId === groupId);
  if (inGroup.length) return Math.max(...inGroup.map(t => t.index)) + 1;
  return -1;
}

async function indexForNewGroup(windowId, groupKey) {
  const order = flat.windows[flat.groups[groupKey].windowKey].groupKeys;
  const pos = order.indexOf(groupKey);
  const tabs = await chrome.tabs.query({ windowId });
  for (let i = pos - 1; i >= 0; i--) {
    const gid = rt.groups[order[i]];
    const m = tabs.filter(t => gid != null && t.groupId === gid);
    if (m.length) return Math.max(...m.map(t => t.index)) + 1;
  }
  for (let i = pos + 1; i < order.length; i++) {
    const gid = rt.groups[order[i]];
    const m = tabs.filter(t => gid != null && t.groupId === gid);
    if (m.length) return Math.min(...m.map(t => t.index));
  }
  return -1;
}

// ---------------------------------------------------------------------------------------------
// Erzeugen / Einordnen
// ---------------------------------------------------------------------------------------------

async function createManagedTab(windowId, index, tabKey) {
  const props = { windowId, url: flat.tabs[tabKey].url, active: false };
  if (index >= 0) props.index = index;
  const t = await withRetry('tabs.create', () => chrome.tabs.create(props));
  rt.tabs[tabKey] = t.id;
  hints.tabs[tabKey] = { lastUrl: flat.tabs[tabKey].url };
  saveHintsSoon();
  log('info', `Pflicht-Tab „${tabKey}“ geöffnet.`, { tabId: t.id, windowId, index });
  return t;
}

// Fügt einen Tab der Gruppe hinzu und korrigiert (begrenzt) seine Position relativ zu den
// benachbarten Pflicht-Tabs. Die Position ist „best effort“ (siehe docs/ARCHITEKTUR.md, Bekannte Grenzen).
async function placeInGroup(tabId, groupId, groupKey, tabKey) {
  await withRetry('tabs.group', () => chrome.tabs.group({ groupId, tabIds: [tabId] }));
  for (let attempt = 0; attempt < 2; attempt++) {
    const tab = await getTab(tabId);
    if (!tab) return;
    if (tab.groupId !== groupId) {
      await withRetry('tabs.group', () => chrome.tabs.group({ groupId, tabIds: [tabId] }));
      continue;
    }
    const tabs = await chrome.tabs.query({ windowId: tab.windowId });
    const { prev, next } = managedNeighbors(tabs, groupId, groupKey, tabKey);
    const okPrev = !prev || prev.index < tab.index;
    const okNext = !next || next.index > tab.index;
    if (okPrev && okNext) return;
    const target = !okPrev ? prev.index : next.index;
    await withRetry('tabs.move', () => chrome.tabs.move(tabId, { index: target }));
  }
  const tab = await getTab(tabId);
  if (tab && tab.groupId !== groupId) {
    await withRetry('tabs.group', () => chrome.tabs.group({ groupId, tabIds: [tabId] }));
  }
}

async function applyGroupProps(group, gdef, includeCollapsed) {
  const upd = {};
  if (group.title !== gdef.title) upd.title = gdef.title;
  if (group.color !== gdef.color) upd.color = gdef.color;
  if (includeCollapsed && group.collapsed !== gdef.collapsed) upd.collapsed = gdef.collapsed;
  if (Object.keys(upd).length) {
    await withRetry('tabGroups.update', () => chrome.tabGroups.update(group.id, upd));
  }
}

async function findEmptyStartupWindow() {
  const mapped = new Set(Object.values(rt.windows));
  const wins = await normalWindows(true);
  return wins.find(w => !mapped.has(w.id) && (w.tabs || []).length === 1 &&
    w.tabs[0].groupId === -1 && isNewTabUrl(tabUrl(w.tabs[0]))) || null;
}

// Neues Vorlagenfenster: alle fehlenden Pflicht-Tabs werden direkt als URLs übergeben,
// damit kein leerer Hilfs-Tab entsteht.
async function createTemplateWindow(windowKey) {
  const wdef = flat.windows[windowKey];
  const keys = [];
  for (const gk of wdef.groupKeys) {
    for (const tk of flat.groups[gk].tabKeys) if (!(await liveTab(tk))) keys.push(tk);
  }
  if (!keys.length) return null;

  const w = await withRetry('windows.create', () => chrome.windows.create({
    url: keys.map(k => flat.tabs[k].url),
    focused: !!cfg.settings.focusCreatedWindows,
    type: 'normal'
  }));
  rt.windows[windowKey] = w.id;
  let tabs = w.tabs;
  if (!tabs || tabs.length !== keys.length) tabs = await chrome.tabs.query({ windowId: w.id });
  tabs = [...tabs].sort((a, b) => a.index - b.index);
  keys.forEach((k, i) => {
    if (!tabs[i]) return;
    rt.tabs[k] = tabs[i].id;
    hints.tabs[k] = { lastUrl: flat.tabs[k].url };
  });
  saveHintsSoon();

  for (const gk of wdef.groupKeys) {
    const gdef = flat.groups[gk];
    const ids = gdef.tabKeys.filter(k => keys.includes(k)).map(k => rt.tabs[k]).filter(id => id != null);
    if (!ids.length) continue;
    const gid = await withRetry('tabs.group', () => chrome.tabs.group({ tabIds: ids, createProperties: { windowId: w.id } }));
    rt.groups[gk] = gid;
    await withRetry('tabGroups.update', () => chrome.tabGroups.update(gid, {
      title: gdef.title, color: gdef.color, collapsed: gdef.collapsed
    }));
  }
  log('info', `Vorlagenfenster „${wdef.name}“ mit ${keys.length} Pflicht-Tab(s) erstellt.`, { windowId: w.id });
  return { window: w, created: keys.length };
}

async function groupNeeds(groupKey, onlyKeys, moveBack) {
  const group = await liveGroup(groupKey);
  const missing = [];
  const misplaced = [];
  for (const tk of flat.groups[groupKey].tabKeys) {
    if (onlyKeys && !onlyKeys.has(tk)) continue;
    const t = await liveTab(tk);
    if (!t) missing.push(tk);
    else if (moveBack && (!group || t.groupId !== group.id)) misplaced.push(tk);
  }
  return { group, missing, misplaced };
}

async function reconcileGroup(groupKey, windowId, opts) {
  const gdef = flat.groups[groupKey];
  const { group, missing, misplaced } = await groupNeeds(groupKey, opts.onlyKeys, opts.moveBack);
  let created = 0;
  let moved = 0;

  if (!missing.length && !misplaced.length) {
    if (group && opts.applyGroupProps) await applyGroupProps(group, gdef, false);
    return { created, moved };
  }

  if (!group) {
    // Gruppe existiert nicht (mehr) → einmalig neu aufbauen, alle betroffenen Tabs in EINE Gruppe.
    let idx = await indexForNewGroup(windowId, groupKey);
    const ids = [];
    for (const tk of gdef.tabKeys) {
      if (missing.includes(tk)) {
        const t = await createManagedTab(windowId, idx, tk);
        ids.push(t.id);
        created++;
      } else if (misplaced.includes(tk)) {
        const id = rt.tabs[tk];
        await withRetry('tabs.move', () => chrome.tabs.move(id, { windowId, index: idx }));
        ids.push(id);
        moved++;
      } else {
        continue;
      }
      if (idx !== -1) idx++;
    }
    const gid = await withRetry('tabs.group', () => chrome.tabs.group({ tabIds: ids, createProperties: { windowId } }));
    rt.groups[groupKey] = gid;
    await withRetry('tabGroups.update', () => chrome.tabGroups.update(gid, {
      title: gdef.title, color: gdef.color, collapsed: gdef.collapsed
    }));
    log('info', `Gruppe „${gdef.title}“ wiederhergestellt (${created} neu, ${moved} verschoben).`, { groupId: gid, windowId });
    return { created, moved };
  }

  // Gruppe existiert → fehlende Tabs an ihrer Sollposition einfügen.
  const targetWin = group.windowId;
  for (const tk of gdef.tabKeys) {
    if (missing.includes(tk)) {
      const idx = await indexForTabInGroup(targetWin, group.id, groupKey, tk);
      const t = await createManagedTab(targetWin, idx, tk);
      try {
        await placeInGroup(t.id, group.id, groupKey, tk);
      } catch (e) {
        // Gruppe ist evtl. genau jetzt verschwunden (Ereignis-Rennen) → neue Gruppe bilden.
        log('warn', `Einordnen in Gruppe „${gdef.title}“ fehlgeschlagen (${e?.message || e}) – bilde Gruppe neu.`);
        const gid = await withRetry('tabs.group', () => chrome.tabs.group({ tabIds: [t.id], createProperties: { windowId: targetWin } }));
        rt.groups[groupKey] = gid;
        await chrome.tabGroups.update(gid, { title: gdef.title, color: gdef.color });
        return { created: created + 1, moved };
      }
      created++;
    } else if (misplaced.includes(tk)) {
      const id = rt.tabs[tk];
      const idx = await indexForTabInGroup(targetWin, group.id, groupKey, tk);
      await withRetry('tabs.move', () => chrome.tabs.move(id, { windowId: targetWin, index: idx }));
      await placeInGroup(id, group.id, groupKey, tk);
      moved++;
    }
  }
  if (opts.applyGroupProps) {
    const g = await getGroup(group.id);
    if (g) await applyGroupProps(g, gdef, false);
  }
  return { created, moved };
}

/**
 * Gleicht die Vorlage ab.
 *  createWindows      – fehlende Vorlagenfenster neu erzeugen (nur Start/Install/Aktivieren/manuell)
 *  moveBack           – verwaltete Tabs, die außerhalb ihrer Gruppe liegen, zurückholen (nur manuell)
 *  onlyKeys           – nur diese Pflicht-Tabs betrachten (automatische Reparatur)
 *  reuseStartupWindow – ein Fenster mit nur einer leeren Neuer-Tab-Seite mitbenutzen
 *  applyGroupProps    – Name/Farbe bestehender Gruppen an die Konfiguration angleichen
 */
async function reconcile(opts) {
  const o = { createWindows: false, moveBack: false, onlyKeys: null, reuseStartupWindow: false, applyGroupProps: false, reason: '?', ...opts };
  if (!flat) {
    log('warn', 'Keine gültige Konfiguration – Abgleich übersprungen.');
    return { created: 0, moved: 0, windows: 0 };
  }
  let created = 0;
  let moved = 0;
  let windowsCreated = 0;
  let reuse = o.reuseStartupWindow ? await findEmptyStartupWindow() : null;

  for (const wk of flat.windowOrder) {
    const wdef = flat.windows[wk];
    let needsWork = false;
    for (const gk of wdef.groupKeys) {
      const n = await groupNeeds(gk, o.onlyKeys, o.moveBack);
      if (n.missing.length || n.misplaced.length || (o.applyGroupProps && n.group)) { needsWork = true; break; }
    }
    if (!needsWork) continue;

    let win = await liveWindow(wk);
    if (!win) {
      if (!o.createWindows) {
        log('info', `Vorlagenfenster „${wdef.name}“ ist nicht offen – automatische Reparatur öffnet keine Fenster.`);
        continue;
      }
      if (reuse && !Object.values(rt.windows).includes(reuse.id)) {
        win = reuse;
        reuse = null;
        rt.windows[wk] = win.id;
        log('info', `Leeres Startfenster wird für „${wdef.name}“ verwendet.`, { windowId: win.id });
      } else {
        const res = await createTemplateWindow(wk);
        if (res) {
          win = res.window;
          created += res.created;
          windowsCreated++;
        } else if (o.moveBack) {
          // Alle Pflicht-Tabs leben bereits woanders → Fenster mit dem ersten davon erzeugen.
          let firstId = null;
          for (const gk of wdef.groupKeys) {
            for (const tk of flat.groups[gk].tabKeys) {
              if (firstId == null && (await liveTab(tk))) firstId = rt.tabs[tk];
            }
          }
          if (firstId == null) continue;
          win = await withRetry('windows.create', () => chrome.windows.create({ tabId: firstId, focused: !!cfg.settings.focusCreatedWindows }));
          rt.windows[wk] = win.id;
          windowsCreated++;
        } else {
          continue;
        }
      }
    }

    for (const gk of wdef.groupKeys) {
      const r = await reconcileGroup(gk, win.id, o);
      created += r.created;
      moved += r.moved;
    }
  }

  const summary = `Abgleich (${o.reason}): ${created} Tab(s) geöffnet, ${moved} verschoben, ${windowsCreated} Fenster erstellt.`;
  log('info', summary);
  setLastAction(summary);
  return { created, moved, windows: windowsCreated };
}

// ---------------------------------------------------------------------------------------------
// Automatische Reparatur nach dem Schließen von Pflicht-Tabs
// ---------------------------------------------------------------------------------------------

function canAutoRepair() {
  return enabled && !!flat && rt.bootDone && !rt.awaitingWindow && !rt.suspended;
}

function scheduleRepair() {
  const now = Date.now();
  if (!rt.pendingSince) rt.pendingSince = now;
  clearTimeout(repairTimer);
  const delay = Math.max(0, Math.min(REPAIR_DEBOUNCE_MS, rt.pendingSince + REPAIR_MAX_DELAY_MS - now));
  repairTimer = setTimeout(() => { enqueue('auto-repair', processPending).catch(() => {}); }, delay);
}

async function processPending() {
  const keys = [...new Set(rt.pending)];
  rt.pending = [];
  rt.pendingSince = null;
  if (!keys.length) return;
  if (!canAutoRepair()) {
    log('info', 'Ausstehende Wiederherstellungen verworfen (Schutz inaktiv/pausiert).');
    return;
  }

  const now = Date.now();
  rt.recentAll = rt.recentAll.filter(t => now - t < RATE_WINDOW_MS);
  const allowed = [];
  for (const k of keys) {
    if (!flat.tabs[k] || !flat.tabs[k].protect || rt.paused[k]) continue;
    if (await liveTab(k)) continue;
    const list = (rt.recent[k] || []).filter(t => now - t < RATE_WINDOW_MS);
    if (list.length >= KEY_LIMIT) {
      rt.paused[k] = true;
      log('warn', `Pflicht-Tab „${k}“ wurde ${KEY_LIMIT}× innerhalb von ${RATE_WINDOW_MS / 1000} s neu geöffnet – automatische Wiederherstellung für diesen Tab pausiert. „Vorlage jetzt wiederherstellen“ hebt die Pause auf.`);
      continue;
    }
    list.push(now);
    rt.recent[k] = list;
    rt.recentAll.push(now);
    allowed.push(k);
  }
  if (rt.recentAll.length > GLOBAL_LIMIT) {
    rt.suspended = true;
    rt.suspendReason = `Mehr als ${GLOBAL_LIMIT} automatische Wiederherstellungen in ${RATE_WINDOW_MS / 1000} s.`;
    log('error', `Schleifenschutz: ${rt.suspendReason} Automatik angehalten, bis „Vorlage jetzt wiederherstellen“ oder Aus-/Einschalten.`);
    return;
  }
  if (!allowed.length) return;
  await reconcile({ onlyKeys: new Set(allowed), reason: 'automatisch' });
}

// ---------------------------------------------------------------------------------------------
// Lebenszyklus: Browserstart, Installation, Update, SW-Aufwachen
// ---------------------------------------------------------------------------------------------

function bumpActivity() {
  lastActivity = Date.now();
}

// Wartet ereignisgesteuert, bis sich Fenster/Tabs/Gruppen nicht mehr ändern (Sitzungswiederherstellung).
// Rückgabe: true, wenn mindestens ein normales Fenster offen ist.
async function waitForSettle() {
  const start = Date.now();
  let lastSig = '';
  let sigSince = start;
  for (;;) {
    const wins = await normalWindows(true);
    const groups = await chrome.tabGroups.query({});
    const sig = wins.map(w => `${w.id}:${(w.tabs || []).map(t => `${t.id}/${t.groupId}`).join(',')}`).join('|') +
      `#${groups.map(g => `${g.id}=${g.title}`).join(',')}`;
    const now = Date.now();
    if (sig !== lastSig) { lastSig = sig; sigSince = now; }
    const quietFor = Math.min(now - sigSince, now - lastActivity);
    const elapsed = now - start;
    if (elapsed >= SETTLE_MIN_MS && quietFor >= SETTLE_QUIET_MS) {
      log('info', `Startphase ruhig nach ${elapsed} ms (${wins.length} Fenster).`);
      return wins.length > 0;
    }
    if (elapsed >= SETTLE_MAX_MS) {
      log('warn', `Startphase nach ${elapsed} ms nicht ruhig geworden – fahre trotzdem fort (${wins.length} Fenster).`);
      return wins.length > 0;
    }
    await sleep(SETTLE_POLL_MS);
  }
}

function finishBoot(mode) {
  rt.bootDone = true;
  rt.startupPending = false;
  rt.awaitingWindow = false;
  rt.bootMode = mode;
  rt.bootedAt = Date.now();
}

async function bootStartup(trigger) {
  rt.startupPending = true;
  rt.bootDone = false;
  rt.pending = [];
  await saveRt();
  log('info', `Browserstart erkannt (${trigger}) – warte auf das Ende der Sitzungswiederherstellung …`);

  const hasWindow = await waitForSettle();
  if (!hasWindow) {
    rt.awaitingWindow = true;
    log('info', 'Kein normales Browserfenster offen (z. B. Startup-Boost/Hintergrundmodus). Aufbau erfolgt, sobald ein Fenster geöffnet wird.');
    return;
  }
  rt.awaitingWindow = false;
  // Neuere Vorlage von einem anderen Gerät? Vor dem Aufbau übernehmen.
  await pullRemote(`start:${trigger}`, { build: false });
  await adoptExisting(trigger);
  if (enabled && flat && configRev !== 0) {
    await reconcile({ createWindows: true, reuseStartupWindow: cfg.settings.reuseEmptyStartupWindow, reason: trigger });
  } else if (configRev === 0) {
    log('info', 'Noch keine eigene Vorlage auf diesem Gerät (nur Beispielvorlage) – es wird nichts aufgebaut.');
    setLastAction('Keine eigene Vorlage – nichts aufgebaut');
  } else {
    log('info', 'Schutz ausgeschaltet oder Konfiguration ungültig – Vorlage wird nicht aufgebaut, vorhandene Pflicht-Tabs wurden nur erkannt.');
    setLastAction('Start ohne Aufbau (Schutz aus)');
  }
  finishBoot(trigger);
}

async function bootInstall() {
  log('info', 'Erweiterung neu installiert.');
  // Installation verhält sich wie ein Browserstart (inkl. Warten), damit nichts doppelt entsteht.
  await bootStartup('installation');
  if (configRev === 0 && !rt.awaitingWindow) {
    // Keine Vorlage (auch nicht aus dem Sync): Einstellungen zum Einrichten öffnen.
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#welcome'), active: true });
    } catch (e) {
      log('warn', `Einstellungsseite konnte nicht geöffnet werden: ${e?.message || e}`);
    }
  }
}

async function bootUpdate(previousVersion) {
  if (rt.bootDone) {
    await adoptExisting('update');
    log('info', `Update von ${previousVersion || '?'} – Laufzeitzustand war noch vorhanden.`);
    return;
  }
  // storage.session wird bei Update/Neuladen geleert → offene Pflicht-Tabs wiedererkennen,
  // aber NICHTS automatisch öffnen (Update ist kein Browserstart).
  await adoptExisting('update');
  finishBoot('update');
  log('info', 'Update/Neuladen: vorhandene Pflicht-Tabs übernommen. Fehlende werden nicht automatisch geöffnet – dafür „Vorlage jetzt wiederherstellen“ nutzen.');
  setLastAction('Update: vorhandene Tabs übernommen');
}

// Normaler Fall: SW wacht wegen eines Ereignisses auf, bootDone ist gesetzt → nichts tun.
async function bootResume() {
  if (rt.bootDone) {
    if (rt.pending.length) scheduleRepair();
    return;
  }
  if (rt.startupPending) {
    if (rt.awaitingWindow) {
      if ((await normalWindows()).length) await bootStartup('start-verzögert');
      return;
    }
    // SW wurde mitten im Startaufbau beendet → erneut versuchen (Aufbau ist idempotent).
    await bootStartup('start-fortgesetzt');
    return;
  }
  // Kein Lebenszyklus-Ereignis, kein Zustand: z. B. Erweiterung in edge://extensions wieder aktiviert.
  await adoptExisting('fortsetzen');
  finishBoot('fortsetzen');
  log('info', 'SW ohne Start-/Installationsereignis gestartet (z. B. Erweiterung reaktiviert): vorhandene Pflicht-Tabs übernommen, nichts neu geöffnet.');
}

chrome.runtime.onStartup.addListener(() => {
  startupEventSeen = true;
  enqueue('start', () => bootStartup('browserstart')).catch(() => {});
});

chrome.runtime.onInstalled.addListener(details => {
  installedEventSeen = true;
  if (details.reason === 'install') {
    enqueue('installation', bootInstall).catch(() => {});
  } else if (details.reason === 'update') {
    enqueue('update', () => bootUpdate(details.previousVersion)).catch(() => {});
  } else {
    // chrome_update / shared_module_update: der zugehörige Browserstart löst onStartup aus.
    installedEventSeen = false;
  }
});

ready.then(() => {
  updateBadge().catch(() => {});
  setTimeout(() => {
    if (!startupEventSeen && !installedEventSeen) enqueue('aufwachen', bootResume).catch(() => {});
  }, FALLBACK_BOOT_DELAY_MS);
});

// ---------------------------------------------------------------------------------------------
// Browser-Ereignisse
// ---------------------------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener((tabId, info) => {
  bumpActivity();
  enqueue('tab-geschlossen', async () => {
    const key = keyOfTab(tabId);
    if (!key) return; // nicht verwalteter Tab → nichts tun
    delete rt.tabs[key];
    if (info.isWindowClosing) {
      log('info', `Pflicht-Tab „${key}“ wurde mit seinem Fenster geschlossen – keine sofortige Wiederherstellung.`);
      return;
    }
    if (!canAutoRepair()) {
      log('info', `Pflicht-Tab „${key}“ geschlossen – Schutz inaktiv, keine Wiederherstellung.`);
      return;
    }
    if (flat.tabs[key] && !flat.tabs[key].protect) {
      log('info', `Tab „${key}“ geschlossen – er ist als „darf geschlossen werden“ markiert, keine Wiederherstellung.`);
      return;
    }
    if (rt.paused[key]) {
      log('info', `Pflicht-Tab „${key}“ geschlossen – automatische Wiederherstellung für ihn ist pausiert.`);
      return;
    }
    if (!rt.pending.includes(key)) rt.pending.push(key);
    log('info', `Pflicht-Tab „${key}“ geschlossen – Wiederherstellung eingeplant.`);
    scheduleRepair();
  }).catch(() => {});
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  enqueue('tab-ersetzt', async () => {
    const key = keyOfTab(removedTabId);
    if (key) {
      rt.tabs[key] = addedTabId;
      log('info', `Pflicht-Tab „${key}“ wurde vom Browser ersetzt (${removedTabId} → ${addedTabId}).`);
    }
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status || changeInfo.groupId !== undefined) bumpActivity();
  if (!changeInfo.url) return;
  await ready;
  const key = keyOfTab(tabId);
  if (!key) return;
  // Navigation ist ausdrücklich erlaubt – nur als Wiedererkennungs-Hinweis merken.
  hints.tabs[key] = { lastUrl: changeInfo.url };
  saveHintsSoon();
});

chrome.tabs.onCreated.addListener(bumpActivity);
chrome.tabs.onAttached.addListener(bumpActivity);
chrome.tabs.onMoved.addListener(bumpActivity);
chrome.tabGroups.onCreated.addListener(bumpActivity);

chrome.tabGroups.onUpdated.addListener(async group => {
  bumpActivity();
  await ready;
  const gk = keyOfGroup(group.id);
  if (gk && group.title) {
    hints.groups[gk] = { lastTitle: group.title };
    saveHintsSoon();
  }
});

chrome.tabGroups.onRemoved.addListener(group => {
  enqueue('gruppe-entfernt', async () => {
    const gk = keyOfGroup(group.id);
    if (gk) delete rt.groups[gk];
  }).catch(() => {});
});

chrome.windows.onCreated.addListener(win => {
  bumpActivity();
  if (!isNormalWin(win)) return;
  enqueue('fenster-geöffnet', async () => {
    if (rt.awaitingWindow) await bootStartup('erstes-fenster');
  }).catch(() => {});
}, { windowTypes: ['normal'] });

chrome.windows.onRemoved.addListener(windowId => {
  enqueue('fenster-geschlossen', async () => {
    for (const [wk, id] of Object.entries(rt.windows)) if (id === windowId) delete rt.windows[wk];
    const remaining = await normalWindows();
    if (!remaining.length) {
      // Edge läuft ggf. im Hintergrund weiter (Hintergrundmodus) → nächstes Fenster gilt als Start.
      rt.awaitingWindow = true;
      rt.pending = [];
      log('info', 'Letztes Browserfenster geschlossen – Vorlage wird beim nächsten Fenster/Start neu abgeglichen.');
    }
  }).catch(() => {});
}, { windowTypes: ['normal'] });

// ---------------------------------------------------------------------------------------------
// Befehle aus Popup / Einstellungen
// ---------------------------------------------------------------------------------------------

function resetLoopGuards() {
  rt.suspended = false;
  rt.suspendReason = null;
  rt.paused = {};
  rt.recent = {};
  rt.recentAll = [];
  rt.pending = [];
  rt.pendingSince = null;
  clearTimeout(repairTimer);
}

async function setEnabled(value) {
  enabled = value;
  await chrome.storage.local.set({ enabled: value });
  resetLoopGuards();
  if (value) {
    log('info', 'Schutz aktiviert – einmaliger Abgleich.');
    await adoptExisting('aktivieren');
    if (configRev !== 0) await reconcile({ createWindows: true, reason: 'aktivieren' });
    if (!rt.bootDone) finishBoot(rt.bootMode || 'aktivieren');
  } else {
    log('info', 'Schutz deaktiviert – offene Tabs bleiben unverändert.');
    setLastAction('Schutz deaktiviert');
  }
}

async function manualRestore() {
  if (!flat) throw new Error(`Konfiguration ungültig: ${configError}`);
  resetLoopGuards();
  await adoptExisting('manuell');
  const res = await reconcile({ createWindows: true, moveBack: true, applyGroupProps: true, reason: 'manuell' });
  finishBoot(rt.bootMode || 'manuell');
  return res;
}

/**
 * Profil wechseln. Das neue Profil wird aufgebaut (bereits offene passende Gruppen werden übernommen).
 * closeOld: Pflicht-Tabs des bisherigen Profils danach schließen – eigene Tabs bleiben immer offen.
 * Ohne closeOld bleiben die alten Tabs offen und sind ab jetzt einfach nicht mehr verwaltet.
 */
async function switchProfile(profileId, closeOld) {
  if (!cfg) throw new Error(`Konfiguration ungültig: ${configError}`);
  const target = cfg.profiles.find(p => p.id === profileId);
  if (!target) throw new Error('Dieses Profil gibt es nicht (mehr).');
  if (profileId === activeProfile) return { created: 0, moved: 0, windows: 0, closed: 0 };

  const oldName = flat?.profileName;
  const oldTabIds = Object.values(rt.tabs);
  resetLoopGuards();
  rt.tabs = {};
  rt.groups = {};
  rt.windows = {};

  activeProfile = profileId;
  await chrome.storage.local.set({ activeProfile });
  applyConfig(rawConfig);
  log('info', `Profilwechsel: „${oldName}“ → „${target.name}“${closeOld ? ' (alte Pflicht-Tabs werden geschlossen)' : ''}.`);

  // Erst das neue Profil aufbauen, DANN alte Tabs schließen – so bleibt immer ein Fenster offen
  // und Edge beendet sich nicht.
  await adoptExisting('profilwechsel');
  const res = await reconcile({ createWindows: true, reason: `Profil „${target.name}“` });
  finishBoot(rt.bootMode || 'profilwechsel');

  let closed = 0;
  if (closeOld && oldTabIds.length) {
    const keep = new Set(Object.values(rt.tabs)); // vom neuen Profil übernommene Tabs bleiben
    const toClose = [];
    for (const id of oldTabIds) if (!keep.has(id) && (await getTab(id))) toClose.push(id);
    if (toClose.length) {
      try {
        await withRetry('tabs.remove', () => chrome.tabs.remove(toClose));
        closed = toClose.length;
      } catch (e) {
        log('warn', `Alte Pflicht-Tabs konnten nicht alle geschlossen werden: ${e?.message || e}`);
      }
    }
  }
  setLastAction(`Profil „${target.name}“ aktiv${closed ? `, ${closed} alte(r) Tab(s) geschlossen` : ''}`);
  return { ...res, closed };
}

// Verknüpft Vorlagen-Schlüssel direkt mit offenen Fenstern/Gruppen/Tabs (aus „Sitzung übernehmen“
// bzw. „Aus offenen Tabs wählen“). Nur existierende Objekte werden verknüpft.
async function applyBindings(bind) {
  if (!bind || typeof bind !== 'object') return;
  let n = 0;
  const claim = (map, key, id) => {
    for (const [k, v] of Object.entries(map)) if (v === id && k !== key) delete map[k];
    map[key] = id;
    n++;
  };
  for (const [wk, id] of Object.entries(bind.windows || {})) {
    if (flat.windows[wk] && isNormalWin(await getWindow(id))) claim(rt.windows, wk, id);
  }
  for (const [gk, id] of Object.entries(bind.groups || {})) {
    if (flat.groups[gk] && (await getGroup(id))) claim(rt.groups, gk, id);
  }
  for (const [tk, id] of Object.entries(bind.tabs || {})) {
    if (!flat.tabs[tk]) continue;
    const t = await getTab(id);
    if (!t || t.incognito) continue;
    claim(rt.tabs, tk, id);
    hints.tabs[tk] = { lastUrl: tabUrl(t) };
  }
  saveHintsSoon();
  log('info', `${n} offene(s) Fenster/Gruppen/Tabs direkt mit der Vorlage verknüpft.`);
}

// Momentaufnahme aller normalen Fenster für „Aktuelle Sitzung übernehmen“.
async function captureSession() {
  const wins = await normalWindows(true);
  const groups = await chrome.tabGroups.query({});
  const keyOfWindow = id => { for (const [k, v] of Object.entries(rt.windows)) if (v === id) return k; return null; };
  return wins.map(w => ({
    windowId: w.id,
    focused: !!w.focused,
    managedKey: keyOfWindow(w.id),
    groups: groups.filter(g => g.windowId === w.id).map(g => ({
      groupId: g.id, title: g.title || '', color: g.color, collapsed: !!g.collapsed, managedKey: keyOfGroup(g.id)
    })),
    tabs: [...(w.tabs || [])].sort((a, b) => a.index - b.index).map(t => ({
      tabId: t.id, url: tabUrl(t), title: t.title || '', groupId: t.groupId, managedKey: keyOfTab(t.id)
    }))
  }));
}

// ---------------------------------------------------------------------------------------------
// Sync zwischen Geräten (chrome.storage.sync)
// ---------------------------------------------------------------------------------------------
// Synchronisiert wird NUR die Vorlage. Tab-Zuordnungen, URL-Hinweise und „Schutz an/aus“ bleiben
// gerätespezifisch. Konfliktregel: die neuere Revision gewinnt (Zeitstempel der Speicherung).

async function saveSyncState() {
  try { await chrome.storage.local.set({ syncState }); } catch { /* unkritisch */ }
}

async function readRemote() {
  if (!chrome.storage.sync) return { status: 'unavailable' };
  const r = decodeTemplate(await chrome.storage.sync.get(null));
  if (r.status === 'ok') r.config = migrateConfig(r.config); // Vorlagenformat 1 (Tabi bis 0.3.x)
  return r;
}

async function pushRemote(reason) {
  if (!syncCfg.enabled || !chrome.storage.sync || configRev === 0) return false;
  if (syncState.pendingChoice) return false; // erst entscheiden, welche Vorlage gilt
  const enc = encodeTemplate(rawConfig, { rev: configRev, deviceId: syncCfg.deviceId, deviceName: syncCfg.deviceName });
  if (enc.tooLarge) {
    syncState.error = `Vorlage ist mit ${Math.round(enc.bytes / 1024)} KB zu groß für den Sync (max. ca. 90 KB). Sie bleibt lokal gespeichert.`;
    log('warn', syncState.error);
    await saveSyncState();
    return false;
  }
  try {
    const before = await chrome.storage.sync.get(null);
    await chrome.storage.sync.set(enc.items);
    const stale = staleChunkKeys(before, enc.n);
    if (stale.length) await chrome.storage.sync.remove(stale);
    syncState.lastPushAt = Date.now();
    syncState.error = null;
    syncState.pendingChoice = null;
    log('info', `Vorlage in den Sync hochgeladen (${reason}, ${enc.n} Teil(e), ${Math.round(enc.bytes / 1024 * 10) / 10} KB).`);
  } catch (e) {
    syncState.error = `Hochladen fehlgeschlagen: ${e?.message || e}`;
    log('error', syncState.error);
  }
  await saveSyncState();
  return !syncState.error;
}

// Speichert eine Vorlage lokal und wendet Namen/Farben auf offene Gruppen an.
async function storeConfigLocally(raw, rev) {
  raw = migrateConfig(raw);
  configRev = rev;
  rawConfig = raw;
  await chrome.storage.local.set({ config: raw, configRev });
  applyConfig(raw);
  pruneToConfig();
  if (flat) {
    for (const gk of Object.keys(flat.groups)) {
      const g = await liveGroup(gk);
      if (g) await applyGroupProps(g, flat.groups[gk], false);
    }
  }
}

/**
 * Übernimmt eine neuere Vorlage aus dem Sync.
 *  build: true → auf einem Gerät ohne eigene Vorlage danach direkt aufbauen (wie bei einer Installation).
 */
async function adoptRemote(remote, reason, build) {
  const wasFresh = configRev === 0;
  await storeConfigLocally(remote.config, remote.meta.rev);
  syncState.lastPullAt = Date.now();
  syncState.lastFrom = remote.meta.deviceName || '?';
  syncState.error = null;
  syncState.pendingChoice = null;
  await saveSyncState();
  log('info', `Vorlage von „${syncState.lastFrom}“ übernommen (${reason}).`);
  setLastAction(`Vorlage von „${syncState.lastFrom}“ übernommen`);
  if (build && wasFresh && enabled && rt.bootDone && !rt.awaitingWindow && flat) {
    // Erstes Mal eine Vorlage auf diesem Gerät: wie eine Installation aufbauen.
    await adoptExisting('sync');
    await reconcile({ createWindows: true, reuseStartupWindow: cfg.settings.reuseEmptyStartupWindow, reason: 'sync (neues Gerät)' });
  }
}

async function pullRemote(reason, { build = true } = {}) {
  if (!syncCfg.enabled || syncState.pendingChoice) return false;
  let remote;
  try {
    remote = await readRemote();
  } catch (e) {
    syncState.error = `Sync nicht lesbar: ${e?.message || e}`;
    await saveSyncState();
    return false;
  }
  if (remote.status === 'unavailable') return false;
  if (remote.status === 'none') {
    if (configRev !== 0) await pushRemote('erster Upload');
    return false;
  }
  if (remote.status === 'incomplete') { log('info', 'Sync-Daten noch unvollständig – warte auf den Rest.'); return false; }
  if (remote.status === 'error') { syncState.error = remote.error; await saveSyncState(); return false; }

  const same = JSON.stringify(remote.config) === JSON.stringify(rawConfig);
  const neverSynced = !syncState.lastPushAt && !syncState.lastPullAt;
  if (same) {
    if (remote.meta.rev !== configRev) { configRev = remote.meta.rev; await chrome.storage.local.set({ configRev }); }
    if (neverSynced) { syncState.lastPullAt = Date.now(); syncState.lastFrom = remote.meta.deviceName; await saveSyncState(); }
    return false;
  }
  if (neverSynced && configRev !== 0) {
    // Dieses Gerät hat eine eigene Vorlage und war noch nie synchronisiert → nicht still überschreiben.
    syncState.pendingChoice = { deviceName: remote.meta.deviceName, savedAt: remote.meta.savedAt };
    log('info', `Sync: Vorlage hier und von „${remote.meta.deviceName}“ unterscheiden sich – Auswahl in den Einstellungen nötig.`);
    await saveSyncState();
    return false;
  }
  if (remote.meta.rev < configRev) {
    await pushRemote('lokal neuer'); // z. B. offline gespeichert
    return false;
  }
  const v = validateConfig(remote.config);
  if (!v.ok) {
    syncState.error = `Vorlage von „${remote.meta.deviceName}“ ist ungültig und wurde nicht übernommen: ${v.errors[0]}`;
    log('error', syncState.error);
    await saveSyncState();
    return false;
  }
  await adoptRemote(remote, reason, build);
  return true;
}

/**
 * Sync ein-/ausschalten, Gerätename ändern oder eine offene Auswahl auflösen
 * (choice: 'download' = Vorlage aus dem Sync übernehmen, 'upload' = diese Vorlage hochladen).
 */
async function setSync({ enabled: on, deviceName, choice }) {
  if (typeof deviceName === 'string' && deviceName.trim()) syncCfg.deviceName = deviceName.trim().slice(0, 40);
  const turnedOn = on === true && !syncCfg.enabled;
  if (typeof on === 'boolean') syncCfg.enabled = on;
  await chrome.storage.local.set({ sync: syncCfg });
  if (!syncCfg.enabled) {
    syncState.pendingChoice = null;
    log('info', 'Sync ausgeschaltet – Vorlage bleibt nur auf diesem Gerät.');
    await saveSyncState();
    return;
  }
  if (turnedOn) {
    // Wie ein erstes Synchronisieren behandeln: bei Unterschieden fragen statt überschreiben.
    syncState.lastPushAt = null;
    syncState.lastPullAt = null;
  }
  if (choice === 'download' || choice === 'upload') {
    const remote = await readRemote();
    syncState.pendingChoice = null;
    if (remote.status !== 'ok') {
      await pushRemote('keine Vorlage im Sync');
    } else if (choice === 'download') {
      const v = validateConfig(remote.config);
      if (!v.ok) throw new Error(`Vorlage im Sync ist ungültig: ${v.errors[0]}`);
      await adoptRemote(remote, 'Auswahl: aus dem Sync', true);
    } else {
      configRev = Math.max(Date.now(), remote.meta.rev + 1);
      await chrome.storage.local.set({ configRev });
      await pushRemote('Auswahl: diese Vorlage');
    }
    await saveSyncState();
    return;
  }
  if (turnedOn) syncState.pendingChoice = null;
  await pullRemote('Sync eingeschaltet');
  await saveSyncState();
}

function syncStatus() {
  return {
    available: !!chrome.storage.sync,
    enabled: syncCfg.enabled,
    deviceName: syncCfg.deviceName,
    deviceId: syncCfg.deviceId,
    ...syncState
  };
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes[META_KEY]) return;
  const meta = changes[META_KEY].newValue;
  if (meta && meta.deviceId === syncCfg.deviceId && meta.rev === configRev) return; // eigenes Echo
  enqueue('sync-eingang', () => pullRemote('Änderung von anderem Gerät')).catch(() => {});
});

async function saveConfig(raw, apply, bind) {
  raw = migrateConfig(raw);
  configRev = Date.now();
  await chrome.storage.local.set({ config: raw, configRev });
  rawConfig = raw;
  applyConfig(raw);
  pruneToConfig();
  log('info', 'Konfiguration gespeichert.');
  await pushRemote('gespeichert');
  await applyBindings(bind);
  // Namen und Farben bereits offener Gruppen angleichen.
  for (const gk of Object.keys(flat.groups)) {
    const g = await liveGroup(gk);
    if (g) await applyGroupProps(g, flat.groups[gk], false);
  }
  if (apply) return manualRestore();
  setLastAction('Konfiguration gespeichert');
  return null;
}

async function buildStatus() {
  const allTabs = await chrome.tabs.query({});
  const tabsById = new Map(allTabs.filter(t => !t.incognito).map(t => [t.id, t]));
  const groupsById = new Map((await chrome.tabGroups.query({})).map(g => [g.id, g]));
  const winIds = new Set((await normalWindows()).map(w => w.id));

  const windows = [];
  let expected = 0;
  let present = 0;
  let misplacedCount = 0;
  let freeTotal = 0;
  let freeOpen = 0;
  if (flat) {
    for (const wk of flat.windowOrder) {
      const wdef = flat.windows[wk];
      const w = { key: wk, name: wdef.name, open: winIds.has(rt.windows[wk]), groups: [] };
      for (const gk of wdef.groupKeys) {
        const gdef = flat.groups[gk];
        const gid = rt.groups[gk];
        const g = { key: gk, title: gdef.title, color: gdef.color, open: groupsById.has(gid), tabs: [] };
        for (const tk of gdef.tabKeys) {
          const t = tabsById.get(rt.tabs[tk]);
          const isPresent = !!t;
          const misplaced = isPresent && t.groupId !== gid;
          const protect = flat.tabs[tk].protect;
          // „Fehlend“ zählen nur geschützte Tabs – freie Tabs dürfen geschlossen bleiben.
          if (protect) { expected++; if (isPresent) present++; } else { freeTotal++; if (isPresent) freeOpen++; }
          if (misplaced) misplacedCount++;
          g.tabs.push({ key: tk, url: flat.tabs[tk].url, present: isPresent, misplaced, protect, paused: !!rt.paused[tk] });
        }
        w.groups.push(g);
      }
      windows.push(w);
    }
  }
  return {
    enabled,
    configValid: !!flat,
    configError,
    bootDone: rt.bootDone,
    bootMode: rt.bootMode,
    bootedAt: rt.bootedAt,
    startupPending: rt.startupPending,
    awaitingWindow: rt.awaitingWindow,
    suspended: rt.suspended,
    suspendReason: rt.suspendReason,
    busy: busyWith,
    pending: rt.pending.length,
    paused: Object.keys(rt.paused),
    totals: { expected, present, missing: expected - present, misplaced: misplacedCount, freeTotal, freeOpen },
    windows,
    activeProfile,
    profiles: (cfg?.profiles || []).map(p => ({ id: p.id, name: p.name })),
    lastAction: rt.lastAction,
    lastError: rt.lastError,
    configRev,
    sync: syncStatus()
  };
}

async function updateBadge() {
  await ready;
  let text = '';
  let color = '#6b7280';
  if (!enabled) {
    text = 'AUS';
  } else if (!flat || rt.suspended) {
    text = '!';
    color = '#dc2626';
  } else {
    const s = await buildStatus();
    if (s.totals.missing > 0) {
      text = String(s.totals.missing);
      color = '#d97706';
    }
  }
  await chrome.action.setBadgeText({ text });
  if (text) await chrome.action.setBadgeBackgroundColor({ color });
}

async function handleMessage(msg) {
  await ready;
  switch (msg?.type) {
    case 'getStatus':
      return { status: await buildStatus() };
    case 'setEnabled':
      await enqueue('schutz-umschalten', () => setEnabled(!!msg.enabled));
      return { status: await buildStatus() };
    case 'restoreNow': {
      const result = await enqueue('manuell-wiederherstellen', manualRestore);
      return { result, status: await buildStatus() };
    }
    case 'getConfig':
      return { config: rawConfig, valid: !!flat, configError, configRev, activeProfile };
    case 'switchProfile': {
      const result = await enqueue('profilwechsel', () => switchProfile(msg.profileId, !!msg.closeOld));
      return { result, status: await buildStatus() };
    }
    case 'saveConfig': {
      const v = validateConfig(msg.config);
      if (!v.ok) return { saved: false, errors: v.errors, warnings: v.warnings };
      const raw = typeof msg.config === 'string' ? JSON.parse(msg.config) : msg.config;
      const result = await enqueue('konfiguration-speichern', () => saveConfig(raw, !!msg.apply, msg.bind));
      return { saved: true, warnings: v.warnings, result, status: await buildStatus() };
    }
    case 'setSync':
      await enqueue('sync-einstellung', () => setSync(msg));
      return { status: await buildStatus() };
    case 'syncNow':
      await enqueue('sync-jetzt', () => pullRemote('manuell'));
      return { status: await buildStatus() };
    case 'captureSession':
      return { windows: await captureSession() };
    case 'getLog':
      return { log: rt.log };
    case 'clearLog':
      rt.log = [];
      await saveRt();
      return {};
    default:
      throw new Error(`Unbekannter Befehl: ${msg?.type}`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  handleMessage(msg).then(
    r => sendResponse({ ok: true, ...r }),
    e => sendResponse({ ok: false, error: String(e?.message || e) })
  );
  return true; // asynchrone Antwort
});
