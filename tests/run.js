// Logiktests: führt den ECHTEN background.js gegen die simulierte chrome-API aus.
// Aufruf: tests/run.html über einen lokalen Webserver öffnen (siehe tests/serve.ps1).

import { createMock } from './mock-chrome.js';
import { validateConfig, DEFAULT_CONFIG, DEFAULT_WINDOWS, DEFAULT_SETTINGS } from '../lib/config.js';
import { exportBookmarksHtml, parseBookmarksHtml, exportLinkList, parseLinkList } from '../options/transfer.js';

// Vorlage im alten Format (Version 1) – prüft nebenbei die automatische Migration auf Version 2.
const V1 = () => ({ version: 1, settings: { ...DEFAULT_SETTINGS }, windows: structuredClone(DEFAULT_WINDOWS) });
const firstWin = cfg => cfg.profiles[0].windows[0];

const out = document.getElementById('out');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
let instance = 0;
let current = null;
let section = '';

const P1 = 'https://example.com/portal-1';
const P2 = 'https://example.com/portal-2';
const P3 = 'https://example.com/portal-3';
const R1 = 'https://example.org/privat-1';
const R2 = 'https://example.org/privat-2';
const T1 = 'https://example.net/tool-1';

function write(line, cls = '') {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = line;
  out.append(div);
}

function check(name, cond, detail) {
  results.push({ section, name, ok: !!cond });
  write(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail !== undefined ? `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`, cond ? 'pass' : 'fail');
}

function title(t) {
  section = t;
  write(`\n▶ ${t}`, 'section');
}

async function startSW(mock, event) {
  if (current) current.clearListeners(); // „SW beendet“: alte Instanz bekommt keine Ereignisse mehr
  current = mock;
  globalThis.chrome = mock.chrome;
  await import(`../background.js?instance=${++instance}`);
  if (event === 'install') mock.fire.installed({ reason: 'install' });
  if (event === 'startup') mock.fire.startup();
  if (event === 'update') mock.fire.installed({ reason: 'update', previousVersion: '0.9.0' });
}

async function status(mock) {
  const r = await mock.send({ type: 'getStatus' });
  return r?.status;
}

// Wartet, bis der Hintergrund 800 ms am Stück untätig war.
async function idle(mock, maxMs = 30000) {
  const start = Date.now();
  let quietSince = null;
  while (Date.now() - start < maxMs) {
    const s = await status(mock);
    const quiet = s && !s.busy && s.pending === 0 && (s.bootDone || s.awaitingWindow);
    if (quiet) {
      quietSince = quietSince || Date.now();
      if (Date.now() - quietSince >= 800) return s;
    } else {
      quietSince = null;
    }
    await sleep(50);
  }
  throw new Error('idle(): Zeitüberschreitung');
}

function allTabs(mock) { return mock.snapshot().flatMap(w => w.tabs.map(t => ({ ...t, windowId: w.windowId }))); }
function countUrl(mock, url) { return allTabs(mock).filter(t => t.url === url).length; }
function groupUrls(mock, groupTitle) { return allTabs(mock).filter(t => t.group === groupTitle).map(t => t.url); }
function groupsNamed(mock, groupTitle) { return [...mock.groups.values()].filter(g => g.title === groupTitle).length; }
function tabId(mock, url, groupTitle) {
  const t = allTabs(mock).find(x => x.url === url && (groupTitle === undefined || x.group === groupTitle));
  return t ? t.id : null;
}
function windowOfGroup(mock, groupTitle) { const g = [...mock.groups.values()].find(x => x.title === groupTitle); return g ? g.windowId : null; }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function templateIntact(mock, label = 'Vorlage vollständig, keine Duplikate') {
  const ok = eq(groupUrls(mock, 'Gaming'), [P1, P2, P3]) && eq(groupUrls(mock, 'Recherche'), [R1, R2]) &&
    eq(groupUrls(mock, 'Tools'), [T1]) && groupsNamed(mock, 'Gaming') === 1 && groupsNamed(mock, 'Recherche') === 1 &&
    groupsNamed(mock, 'Tools') === 1;
  check(label, ok, mock.snapshot());
}

// ---------------------------------------------------------------------------------------------

async function testValidator() {
  title('Validierung');
  check('Beispielkonfiguration ist gültig', validateConfig(DEFAULT_CONFIG).ok);
  check('Kaputtes JSON wird erkannt', !validateConfig('{"windows": [}').ok);
  const dupId = V1();
  dupId.windows[0].groups[0].tabs[1].id = dupId.windows[0].groups[0].tabs[0].id;
  check('Doppelte Tab-ID wird erkannt', validateConfig(dupId).errors.some(e => e.includes('doppelt')));
  const badColor = V1();
  badColor.windows[0].groups[0].color = 'lila';
  check('Ungültige Farbe wird erkannt', validateConfig(badColor).errors.some(e => e.includes('Farbe')));
  const dupTitle = V1();
  dupTitle.windows[1].groups[0].title = 'gaming';
  check('Doppelter Gruppenname wird erkannt', !validateConfig(dupTitle).ok);
  const badUrl = V1();
  badUrl.windows[0].groups[0].tabs[0].url = 'javascript:alert(1)';
  check('Nicht-http(s)-URL wird abgelehnt', !validateConfig(badUrl).ok);
  const sameUrl = V1();
  sameUrl.windows[1].groups[0].tabs[0].url = P1;
  check('Gleiche URL in zwei Gruppen ist erlaubt', validateConfig(sameUrl).ok);
}

async function testMain() {
  title('Installation (ein Fenster mit leerer Neuer-Tab-Seite offen)');
  const m = createMock();
  m.store.local.config = V1();
  m.store.local.configRev = 1; // „eigene“ Vorlage (die unveränderte Beispielvorlage würde nicht aufgebaut)
  const ntpWin = m.user.openWindow(['edge://newtab/']);
  await startSW(m, 'install');
  let s = await idle(m);
  check('2 Fenster (Startfenster wiederverwendet + „Weitere Portale“)', m.wins.size === 2, m.snapshot());
  check('Startfenster enthält Neuer-Tab + Gaming + Recherche', windowOfGroup(m, 'Gaming') === ntpWin && windowOfGroup(m, 'Recherche') === ntpWin);
  check('Neuer-Tab-Seite wurde nicht geschlossen', countUrl(m, 'edge://newtab/') === 1);
  check('Insgesamt 7 Tabs (6 Pflicht + Neuer-Tab), kein Hilfs-Tab', allTabs(m).length === 7, allTabs(m).length);
  templateIntact(m);
  const g = [...m.groups.values()];
  check('Farben korrekt', g.find(x => x.title === 'Gaming').color === 'blue' && g.find(x => x.title === 'Recherche').color === 'green' && g.find(x => x.title === 'Tools').color === 'orange');
  check('Recherche eingeklappt aufgebaut', g.find(x => x.title === 'Recherche').collapsed === true);
  check('Status: 6/6 vorhanden', s.totals.present === 6 && s.totals.missing === 0, s.totals);

  title('Mehrfaches manuelles Wiederherstellen');
  await m.send({ type: 'restoreNow' });
  await m.send({ type: 'restoreNow' });
  await idle(m);
  check('Keine zusätzlichen Tabs nach 2× Wiederherstellen', allTabs(m).length === 7, allTabs(m).length);
  templateIntact(m);

  title('Einzelnen Pflicht-Tab schließen');
  m.user.closeTab(tabId(m, P2));
  await idle(m);
  templateIntact(m, 'portal-2 wieder an Position 2 in „Gaming“');
  check('Wieder geöffneter Tab ist nicht aktiv', allTabs(m).length === 7);
  const reopened = [...m.wins.values()].flatMap(w => w.tabs).find(t => (t.url || t.pendingUrl) === P2);
  check('Wieder geöffneter Tab im Hintergrund (active=false)', reopened && reopened.active === false);

  title('Mehrere Pflicht-Tabs schnell hintereinander schließen');
  m.user.closeTab(tabId(m, P1));
  m.user.closeTab(tabId(m, P3));
  m.user.closeTab(tabId(m, R2));
  await idle(m);
  templateIntact(m);
  check('Tab-Anzahl wieder 7', allTabs(m).length === 7, allTabs(m).length);

  title('Ganze Pflicht-Gruppe schließen');
  const gamingId = [...m.groups.values()].find(x => x.title === 'Gaming').id;
  m.user.closeGroup(gamingId);
  await idle(m);
  templateIntact(m, 'Gaming genau einmal, 3 Tabs in Reihenfolge');
  check('Gaming wieder blau', [...m.groups.values()].find(x => x.title === 'Gaming').color === 'blue');
  const daily = m.snapshot().find(w => w.windowId === ntpWin).tabs.map(t => t.group);
  check('Gaming steht wieder vor Recherche', daily.indexOf('Gaming') < daily.indexOf('Recherche') && daily.indexOf('Gaming') !== -1, daily);

  title('Letzten Pflicht-Tab einer Gruppe schließen (Fenster bleibt offen)');
  const toolsWin = windowOfGroup(m, 'Tools');
  m.user.openTab(toolsWin, 'https://example.net/eigener-tab');
  m.user.closeTab(tabId(m, T1));
  await idle(m);
  check('Tools-Gruppe neu erstellt, orange, im selben Fenster', eq(groupUrls(m, 'Tools'), [T1]) && windowOfGroup(m, 'Tools') === toolsWin &&
    [...m.groups.values()].find(x => x.title === 'Tools').color === 'orange');

  title('Nicht verwalteten Tab schließen (auch innerhalb einer verwalteten Gruppe)');
  const extra = m.user.openTab(ntpWin, 'https://example.com/extra');
  await m.user.addToGroup(extra, [...m.groups.values()].find(x => x.title === 'Gaming').id);
  await idle(m);
  const before = allTabs(m).length;
  m.user.closeTab(extra);
  await idle(m);
  check('Nichts wieder geöffnet', allTabs(m).length === before - 1 && countUrl(m, 'https://example.com/extra') === 0);

  title('Navigation / Login-Weiterleitung in einem Pflicht-Tab');
  const p1 = tabId(m, P1);
  m.user.navigate(p1, 'https://login.example.com/sso?return=portal');
  m.user.navigate(p1, 'https://example.com/portal-1/dashboard');
  await idle(m);
  await m.send({ type: 'restoreNow' });
  await idle(m);
  check('Kein zweiter portal-1-Tab nach Navigation + Wiederherstellen', countUrl(m, P1) === 0 && countUrl(m, 'https://example.com/portal-1/dashboard') === 1, m.snapshot());
  check('Navigierte URL nicht zurückgesetzt', allTabs(m).find(t => t.id === p1)?.url === 'https://example.com/portal-1/dashboard');

  title('Service-Worker beenden und wieder aufwecken');
  const countBefore = allTabs(m).length;
  await startSW(m, 'none');
  await sleep(2200); // Fallback-Boot-Prüfung abwarten
  await idle(m);
  check('Aufwachen öffnet nichts neu', allTabs(m).length === countBefore, allTabs(m).length);
  m.user.closeTab(tabId(m, R1));
  await idle(m);
  check('Nach Aufwachen: Zuordnung erhalten, geschlossener Tab kommt zurück', eq(groupUrls(m, 'Recherche'), [R1, R2]));

  title('Pflicht-Tab in anderes Fenster verschieben');
  const p2 = tabId(m, P2);
  await m.user.moveTab(p2, toolsWin, 0);
  await idle(m);
  check('Verschieben löst keine Neuerstellung aus', countUrl(m, P2) === 1, m.snapshot());
  s = await status(m);
  check('Status meldet 1 Tab außerhalb seiner Gruppe', s.totals.misplaced === 1, s.totals);
  await m.send({ type: 'restoreNow' });
  await idle(m);
  check('Manuelles Wiederherstellen holt portal-2 an Position 2 zurück',
    eq(groupUrls(m, 'Gaming'), ['https://example.com/portal-1/dashboard', P2, P3]), groupUrls(m, 'Gaming'));

  title('Schutz deaktivieren und wieder aktivieren');
  await m.send({ type: 'setEnabled', enabled: false });
  const n0 = allTabs(m).length;
  m.user.closeTab(tabId(m, P3));
  await idle(m);
  check('Deaktiviert: Tab bleibt geschlossen, nichts sonst verändert', allTabs(m).length === n0 - 1 && countUrl(m, P3) === 0);
  await m.send({ type: 'setEnabled', enabled: true });
  await idle(m);
  check('Aktiviert: fehlender Tab einmalig ergänzt', countUrl(m, P3) === 1 && allTabs(m).length === n0);

  title('Schleifenschutz');
  for (let i = 0; i < 6; i++) {
    m.user.closeTab(tabId(m, R2));
    await idle(m);
  }
  s = await status(m);
  check('Nach 5 Neuerstellungen in 60 s wird privat-2 pausiert', s.paused.includes('recherche-privat-2') && countUrl(m, R2) === 0, s.paused);
  await m.send({ type: 'restoreNow' });
  await idle(m);
  check('Manuelles Wiederherstellen hebt Pause auf', countUrl(m, R2) === 1 && (await status(m)).paused.length === 0);

  title('Pflicht-Tab schließen und sofort danach das Fenster');
  m.user.closeTab(tabId(m, R1));
  m.user.closeWindow(ntpWin);
  await idle(m);
  check('Kein Fenster wird neu geöffnet', m.wins.size === 1, m.wins.size);

  title('Komplettes Fenster schließen');
  check('Daily-Gruppen nicht wiederhergestellt', groupsNamed(m, 'Gaming') === 0 && groupsNamed(m, 'Recherche') === 0);
  await m.send({ type: 'restoreNow' });
  await idle(m);
  check('Manuell: Daily als neues Fenster aufgebaut', groupsNamed(m, 'Gaming') === 1 && eq(groupUrls(m, 'Recherche'), [R1, R2]) && m.wins.size === 2);
  check('Gaming nach Neuaufbau komplett', eq(groupUrls(m, 'Gaming'), [P1, P2, P3]), groupUrls(m, 'Gaming'));
  return m;
}

async function testRestarts(prev) {
  title('Edge beenden und mit Sitzungswiederherstellung neu starten');
  // Ein Pflicht-Tab navigiert, ein fremder Tab in einer verwalteten Gruppe.
  const p1 = tabId(prev, P1);
  prev.user.navigate(p1, 'https://example.com/portal-1/unterseite');
  const extra = prev.user.openTab(windowOfGroup(prev, 'Gaming'), 'https://example.com/portal-2');
  await prev.user.addToGroup(extra, [...prev.groups.values()].find(x => x.title === 'Gaming').id);
  await idle(prev);
  await sleep(1200); // Hinweis-Speicherung (1 s Verzögerung) abwarten
  const totalBefore = allTabs(prev).length;
  const m = prev.restartWithRestore(); // Sitzung zum Zeitpunkt des Beendens merken
  for (const id of [...prev.wins.keys()]) prev.user.closeWindow(id);
  await idle(prev);
  check('Beim Beenden nichts wieder geöffnet', prev.wins.size === 0);

  m.restoreLayout();
  await startSW(m, 'startup');
  let s = await idle(m);
  check('Keine Duplikate nach Neustart', allTabs(m).length === totalBefore, { before: totalBefore, after: allTabs(m).length });
  check('Alle 6 Pflicht-Tabs übernommen', s.totals.present === 6 && s.totals.missing === 0, s.totals);
  check('Doppelte URL im Gaming-Ordner: genau ein Tab als portal-2 übernommen (der frühere)',
    s.windows[0].groups[0].tabs[1].present && countUrl(m, P2) === 2);
  m.user.closeTab(tabId(m, 'https://example.com/portal-1/unterseite'));
  await idle(m);
  check('Übernommener (navigierter) Tab wird nach Schließen mit Start-URL ersetzt', countUrl(m, P1) === 1);

  title('Neustart mit verspäteter Sitzungswiederherstellung');
  const m2 = m.restartWithRestore();
  const total2 = allTabs(m).length;
  await startSW(m2, 'startup');
  await sleep(700);
  m2.restoreLayout();
  s = await idle(m2);
  check('Verspätet wiederhergestellte Tabs übernommen statt dupliziert', allTabs(m2).length === total2 && s.totals.present === 6, { total2, now: allTabs(m2).length });

  title('Frischer Start ohne Sitzungswiederherstellung');
  const m3 = m2.restartWithRestore({ restore: false });
  m3.user.openWindow(['edge://newtab/']);
  await startSW(m3, 'startup');
  s = await idle(m3);
  templateIntact(m3);
  check('6/6 vorhanden, 2 Fenster', s.totals.present === 6 && m3.wins.size === 2);

  title('Start ohne Fenster (Startup-Boost / Hintergrundmodus)');
  const m4 = m3.restartWithRestore({ restore: false });
  await startSW(m4, 'startup');
  s = await idle(m4);
  check('Kein Fenster geöffnet, wartet auf erstes Fenster', m4.wins.size === 0 && s.awaitingWindow);
  m4.user.openWindow(['edge://newtab/']);
  s = await idle(m4);
  templateIntact(m4, 'Vorlage beim ersten Fenster aufgebaut');

  title('Erweiterungs-Update / Neuladen');
  const before = allTabs(m4).length;
  m4.clearListeners();          // alte SW-Instanz „beenden“
  await sleep(500);
  for (const k of Object.keys(m4.store.session)) delete m4.store.session[k]; // storage.session wird bei Update geleert
  await startSW(m4, 'update');
  s = await idle(m4);
  check('Update öffnet keine neuen Tabs', allTabs(m4).length === before, { before, now: allTabs(m4).length });
  check('Update übernimmt vorhandene Pflicht-Tabs', s.totals.present === 6, s.totals);
  m4.user.closeTab(tabId(m4, R1));
  await idle(m4);
  check('Nach Update: Schutz arbeitet mit übernommener Zuordnung', countUrl(m4, R1) === 1 && allTabs(m4).length === before);

  title('Einzigen Tab eines Fensters schließen (= Fenster schließt sich)');
  m4.user.closeTab(tabId(m4, T1));
  await idle(m4);
  check('Fenster „Weitere Portale“ wird nicht automatisch neu geöffnet', countUrl(m4, T1) === 0 && m4.wins.size === 1);
  await m4.send({ type: 'restoreNow' });
  await idle(m4);
  check('Manuelles Wiederherstellen öffnet es wieder', countUrl(m4, T1) === 1 && m4.wins.size === 2);
  return m4;
}

async function testConfig(m) {
  title('Konfiguration ändern');
  const cfg = V1();
  cfg.windows[0].groups[0].title = 'Spiele';
  cfg.windows[0].groups[0].color = 'red';
  let r = await m.send({ type: 'saveConfig', config: cfg, apply: false });
  await idle(m);
  check('Speichern ohne Anwenden: Gruppe umbenannt und umgefärbt', r.saved && groupsNamed(m, 'Spiele') === 1 && groupsNamed(m, 'Gaming') === 0 &&
    [...m.groups.values()].find(x => x.title === 'Spiele').color === 'red', r);

  cfg.windows[0].groups[1].tabs.push({ id: 'recherche-neu', url: 'https://example.org/neu' });
  cfg.windows[1].groups[0].tabs = [{ id: 'tools-tool-2', url: 'https://example.net/tool-2' }];
  r = await m.send({ type: 'saveConfig', config: cfg, apply: true });
  await idle(m);
  check('Speichern & Anwenden: neuer Tab ergänzt', countUrl(m, 'https://example.org/neu') === 1 && countUrl(m, 'https://example.net/tool-2') === 1,
    { result: r.result, snapshot: m.snapshot(), log: (await m.send({ type: 'getLog' })).log.slice(-12).map(e => e.msg) });
  check('Entfernter Pflicht-Tab bleibt offen (jetzt unverwaltet)', countUrl(m, T1) === 1);
  m.user.closeTab(tabId(m, T1));
  await idle(m);
  check('… und wird nach Schließen nicht wiederhergestellt', countUrl(m, T1) === 0);

  const bad = structuredClone(cfg);
  bad.windows[0].groups[0].color = 'magenta';
  r = await m.send({ type: 'saveConfig', config: bad, apply: false });
  check('Ungültige Konfiguration wird abgelehnt und nicht gespeichert', r.saved === false && r.errors.length > 0 && firstWin(m.store.local.config).groups[0].color === 'red');

  title('Identische URLs in mehreren Gruppen');
  const dup = V1();
  dup.windows[1].groups[0].tabs = [{ id: 'tools-portal-1', url: P1 }];
  r = await m.send({ type: 'saveConfig', config: dup, apply: true });
  await idle(m);
  check('portal-1 steht in Gaming UND Tools', groupUrls(m, 'Tools').includes(P1) && groupUrls(m, 'Gaming').includes(P1) && countUrl(m, P1) === 2, m.snapshot());
  check('Aus der Vorlage entfernter tool-2-Tab bleibt unverwaltet offen', countUrl(m, 'https://example.net/tool-2') === 1);
  await sleep(1200);
  const m2 = m.restartWithRestore();
  for (const id of [...m.wins.keys()]) m.user.closeWindow(id);
  await idle(m);
  m2.restoreLayout();
  const total = m2.snapshot().reduce((n, w) => n + w.tabs.length, 0);
  await startSW(m2, 'startup');
  const s = await idle(m2);
  check('Nach Neustart beide korrekt der jeweiligen Gruppe zugeordnet, keine Duplikate',
    s.totals.present === 6 && allTabs(m2).length === total && countUrl(m2, P1) === 2 && groupUrls(m2, 'Tools').includes(P1) &&
    s.windows[1].groups[0].tabs[0].present && !s.windows[1].groups[0].tabs[0].misplaced, { totals: s.totals, total, now: allTabs(m2).length });
}

async function testCaptureBind() {
  title('Sitzung übernehmen und als Standard speichern (Verknüpfung)');
  const m = createMock({ idBase: 9000 });
  m._build([
    [
      { url: 'https://a.example.com/', group: { old: 1, title: '', color: 'pink', collapsed: false } },
      { url: 'https://b.example.com/', group: { old: 1, title: '', color: 'pink', collapsed: false } },
      { url: 'https://c.example.com/', group: null }
    ]
  ]);
  const cfg0 = V1();
  m.store.local.config = cfg0;
  m.store.local.enabled = false; // Startaufbau der Beispielvorlage hier nicht nötig
  await startSW(m, 'startup');
  await idle(m);
  const cap = (await m.send({ type: 'captureSession' })).windows;
  check('captureSession liefert Fenster, Gruppen und Tabs', cap.length === 1 && cap[0].tabs.length === 3 && cap[0].groups.length === 1);
  const w = cap[0];
  const cfg = {
    version: 1,
    settings: { reuseEmptyStartupWindow: true, focusCreatedWindows: true },
    windows: [{ id: 'w1', name: 'Fenster 1', groups: [
      { id: 'g1', title: 'Gruppe', color: 'pink', collapsed: false, tabs: [{ id: 't1', url: w.tabs[0].url }, { id: 't2', url: w.tabs[1].url }] },
      { id: 'g2', title: 'Sonstiges', color: 'grey', collapsed: false, tabs: [{ id: 't3', url: w.tabs[2].url }] }
    ] }]
  };
  const bind = { windows: { w1: w.windowId }, groups: { g1: w.groups[0].groupId }, tabs: { t1: w.tabs[0].tabId, t2: w.tabs[1].tabId, t3: w.tabs[2].tabId } };
  const r = await m.send({ type: 'saveConfig', config: cfg, apply: true, bind });
  await idle(m);
  await m.send({ type: 'setEnabled', enabled: true });
  await idle(m);
  check('Speichern mit Verknüpfung öffnet nichts doppelt', r.saved && r.result.created === 0 && allTabs(m).length === 3, { result: r.result, snap: m.snapshot() });
  check('Unbenannte Gruppe erhält ihren Namen in Edge', groupsNamed(m, 'Gruppe') === 1 && eq(groupUrls(m, 'Gruppe'), [w.tabs[0].url, w.tabs[1].url]));
  check('Ungruppierter Tab wird in „Sonstiges“ eingeordnet', eq(groupUrls(m, 'Sonstiges'), [w.tabs[2].url]));
  m.user.closeTab(tabId(m, w.tabs[1].url));
  await idle(m);
  check('Übernommener Tab ist geschützt', eq(groupUrls(m, 'Gruppe'), [w.tabs[0].url, w.tabs[1].url]));
}

async function testSync() {
  const { encodeTemplate, decodeTemplate, META_KEY } = await import('../lib/sync.js');

  title('Sync: Kodierung');
  const big = V1();
  for (let i = 0; i < 60; i++) big.windows[0].groups[0].tabs.push({ id: `extra-${i}`, url: `https://example.com/ü-seite-${i}?q=${'x'.repeat(40)}` });
  const enc = encodeTemplate(big, { rev: 5, deviceId: 'a', deviceName: 'A' });
  const sizes = Object.entries(enc.items).map(([k, v]) => k.length + new TextEncoder().encode(JSON.stringify(v)).length);
  check('Große Vorlage wird in Teile < 8 KB zerlegt', enc.n > 1 && Math.max(...sizes) < 8192, { n: enc.n, max: Math.max(...sizes) });
  const dec = decodeTemplate(enc.items);
  check('Dekodieren ergibt dieselbe Vorlage', dec.status === 'ok' && JSON.stringify(dec.config) === JSON.stringify(big));
  const partial = { ...enc.items };
  delete partial.tpl_1;
  check('Unvollständige Sync-Daten werden erkannt', decodeTemplate(partial).status === 'incomplete');

  title('Sync: Neues Gerät ohne Vorlage erhält sie aus dem Sync');
  const cloud = { data: {} };
  const tplA = V1();
  tplA.windows = [tplA.windows[0]];
  tplA.windows[0].name = 'Vom Desktop';
  const encA = encodeTemplate(tplA, { rev: 1000, deviceId: 'desk', deviceName: 'Desktop' });
  cloud.data = structuredClone(encA.items);
  const b = createMock({ idBase: 20000, cloud });
  b.user.openWindow(['edge://newtab/']);
  await startSW(b, 'install');
  let s = await idle(b);
  check('Vorlage aus dem Sync übernommen und aufgebaut', s.configRev === 1000 && s.totals.present === 5 && s.totals.expected === 5, s.totals);
  check('Keine Beispiel-Fenster, kein Willkommens-Tab', b.wins.size === 1 && countUrl(b, T1) === 0 && countUrl(b, '/options/options.html#welcome') === 0);

  title('Sync: Änderung von anderem Gerät kommt an');
  const tplA2 = structuredClone(tplA);
  tplA2.windows[0].groups[0].title = 'Spiele';
  tplA2.windows[0].groups[0].color = 'red';
  tplA2.windows[0].groups[1].tabs.push({ id: 'recherche-neu', url: 'https://example.org/neu' });
  const encA2 = encodeTemplate(tplA2, { rev: 2000, deviceId: 'desk', deviceName: 'Desktop' });
  b.remoteSyncWrite(encA2.items);
  s = await idle(b);
  await sleep(300);
  s = await idle(b);
  check('Gruppe auf diesem Gerät umbenannt und umgefärbt', groupsNamed(b, 'Spiele') === 1 && [...b.groups.values()].find(g => g.title === 'Spiele').color === 'red');
  check('Neuer Tab wird nicht ungefragt geöffnet, aber als fehlend angezeigt', countUrl(b, 'https://example.org/neu') === 0 && s.totals.missing === 1 && s.configRev === 2000, s.totals);
  check('Status nennt die Herkunft', s.sync.lastFrom === 'Desktop');

  title('Sync: Lokale Änderung wird hochgeladen');
  const tplB = structuredClone(tplA2);
  tplB.windows[0].name = 'Vom Laptop geändert';
  const r = await b.send({ type: 'saveConfig', config: tplB, apply: false });
  await idle(b);
  const remote = decodeTemplate(cloud.data);
  check('Sync enthält die neue Fassung mit Gerätename', r.saved && remote.status === 'ok' && firstWin(remote.config).name === 'Vom Laptop geändert' && remote.meta.deviceName === s.sync.deviceName);

  title('Sync: Gerät mit eigener, abweichender Vorlage');
  const c = createMock({ idBase: 30000, cloud });
  const own = V1();
  own.windows = [own.windows[1]];
  c.store.local.config = own;
  c.store.local.configRev = 5;
  c.store.local.enabled = false;
  c.user.openWindow(['edge://newtab/']);
  await startSW(c, 'startup');
  s = await idle(c);
  check('Keine stille Überschreibung – Auswahl wird verlangt', !!s.sync.pendingChoice && s.configRev === 5 && firstWin(decodeTemplate(cloud.data).config).name === 'Vom Laptop geändert', s.sync);
  await c.send({ type: 'saveConfig', config: own, apply: false });
  check('Speichern lädt während offener Auswahl nichts hoch', firstWin(decodeTemplate(cloud.data).config).name === 'Vom Laptop geändert');
  await c.send({ type: 'setSync', choice: 'download' });
  s = await idle(c);
  check('„Aus dem Sync übernehmen“ übernimmt die Vorlage', !s.sync.pendingChoice && firstWin((await c.send({ type: 'getConfig' })).config).name === 'Vom Laptop geändert');

  title('Sync: Neuinstallation ohne Vorlage und ohne Sync-Daten');
  const d = createMock({ idBase: 40000, cloud: { data: {} } });
  d.user.openWindow(['edge://newtab/']);
  await startSW(d, 'install');
  s = await idle(d);
  await sleep(200);
  check('Beispielvorlage wird NICHT aufgebaut', d.wins.size === 1 && countUrl(d, P1) === 0 && s.configRev === 0);
  check('Einstellungen werden zum Einrichten geöffnet', countUrl(d, '/options/options.html#welcome') === 1);
  void META_KEY;
}

async function testProfilesAndProtect() {
  const M1 = 'https://music.example.com/';
  const M2 = 'https://video.example.org/';
  const cfg = {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    profiles: [
      { id: 'alltag', name: 'Alltag', windows: structuredClone(DEFAULT_WINDOWS) },
      { id: 'abend', name: 'Abend', windows: [{ id: 'abend-w', name: 'Abend', groups: [{ id: 'musik', title: 'Musik', color: 'pink', collapsed: false, tabs: [{ id: 'm1', url: M1 }, { id: 'm2', url: M2 }] }] }] }
    ]
  };
  cfg.profiles[0].windows[0].groups[0].tabs[2].protect = false; // portal-3 darf geschlossen werden

  title('Validierung: Profile');
  check('Vorlage mit zwei Profilen ist gültig', validateConfig(cfg).ok, validateConfig(cfg).errors);
  const sameTitle = structuredClone(cfg);
  sameTitle.profiles[1].windows[0].groups[0].title = 'Gaming';
  check('Gleicher Gruppenname in VERSCHIEDENEN Profilen ist erlaubt', validateConfig(sameTitle).ok);
  const dupAcross = structuredClone(cfg);
  dupAcross.profiles[1].windows[0].groups[0].tabs[0].id = 'gaming-portal-1';
  check('Tab-IDs müssen über alle Profile eindeutig sein', !validateConfig(dupAcross).ok);
  const v1 = validateConfig(V1());
  check('Alte Vorlage (Version 1) wird als Profil „Standard“ übernommen', v1.ok && v1.config.profiles.length === 1 && v1.config.profiles[0].name === 'Standard');

  title('Schutz pro Tab');
  const m = createMock({ idBase: 50000 });
  m.store.local.config = cfg;
  m.store.local.configRev = 1;
  m.user.openWindow(['edge://newtab/']);
  await startSW(m, 'startup');
  let s = await idle(m);
  check('Aktives Profil „Alltag“ aufgebaut (inkl. freiem Tab)', s.activeProfile === 'alltag' && countUrl(m, P3) === 1 && countUrl(m, M1) === 0, s.totals);
  check('Status zählt freie Tabs getrennt', s.totals.expected === 5 && s.totals.freeTotal === 1 && s.totals.freeOpen === 1, s.totals);
  m.user.closeTab(tabId(m, P3));
  s = await idle(m);
  check('Freier Tab bleibt geschlossen und gilt nicht als fehlend', countUrl(m, P3) === 0 && s.totals.missing === 0 && s.totals.freeOpen === 0, s.totals);
  m.user.closeTab(tabId(m, P2));
  await idle(m);
  check('Geschützter Tab kommt weiterhin zurück', countUrl(m, P2) === 1);
  m.user.closeGroup([...m.groups.values()].find(g => g.title === 'Gaming').id);
  await idle(m);
  check('Gruppe schließen: nur geschützte Tabs kehren zurück', eq(groupUrls(m, 'Gaming'), [P1, P2]), groupUrls(m, 'Gaming'));
  await m.send({ type: 'restoreNow' });
  await idle(m);
  check('Manuelles Wiederherstellen öffnet auch freie Tabs', eq(groupUrls(m, 'Gaming'), [P1, P2, P3]), groupUrls(m, 'Gaming'));

  title('Profilwechsel');
  // Eigene Gruppe, die zufällig genauso heißt wie eine Gruppe des Zielprofils.
  const ownWin = m.snapshot()[0].windowId;
  const ownTab = m.user.openTab(ownWin, 'https://eigene-musik.example.net/');
  const ownGroup = await m.chrome.tabs.group({ tabIds: [ownTab], createProperties: { windowId: ownWin } });
  await m.chrome.tabGroups.update(ownGroup, { title: 'Musik', color: 'grey' });
  await idle(m);
  const before = allTabs(m).length;
  let r = await m.send({ type: 'switchProfile', profileId: 'abend', closeOld: false });
  s = await idle(m);
  check('Profil „Abend“ aktiv und aufgebaut', s.activeProfile === 'abend' && s.totals.present === 2 && countUrl(m, M1) === 1 && countUrl(m, M2) === 1, s.totals);
  const ownNow = m.groups.get(ownGroup);
  check('Gleichnamige eigene Gruppe bleibt unangetastet', ownNow && allTabs(m).filter(t => t.id === ownTab)[0] && [...m.wins.values()].flatMap(w => w.tabs).filter(t => t.groupId === ownGroup).length === 1 && groupsNamed(m, 'Musik') === 2, m.snapshot());
  check('Ohne „schließen“ bleiben die alten Tabs offen', allTabs(m).length === before + 2 && countUrl(m, P1) === 1);
  m.user.closeTab(tabId(m, P1));
  await idle(m);
  check('Tabs des inaktiven Profils werden nicht mehr geschützt', countUrl(m, P1) === 0);
  r = await m.send({ type: 'switchProfile', profileId: 'alltag', closeOld: true });
  s = await idle(m);
  check('Zurück zu „Alltag“: vorhandene Gruppen übernommen, nur Fehlendes ergänzt', s.activeProfile === 'alltag' && s.totals.missing === 0 && countUrl(m, P1) === 1 && countUrl(m, P2) === 1 && groupsNamed(m, 'Gaming') === 1, { s: s.totals, r: r.result });
  check('„Pflicht-Tabs schließen“ schließt die Tabs von „Abend“', countUrl(m, M1) === 0 && countUrl(m, M2) === 0 && r.result.closed === 2, r.result);
  check('Eigener Tab (Neuer-Tab-Seite) bleibt offen', countUrl(m, 'edge://newtab/') === 1);
  check('Aktives Profil bleibt lokal gespeichert', m.store.local.activeProfile === 'alltag');

  title('Export/Import: Favoriten-HTML und Linkliste');
  const prof = validateConfig(cfg).config.profiles[0];
  const html = exportBookmarksHtml(prof);
  const back = parseBookmarksHtml(html);
  const flatGroups = ws => ws.flatMap(w => w.groups.map(g => `${w.name}|${g.title}|${g.color}|${g.tabs.map(t => t.url + (t.protect === false ? '*' : '')).join(',')}`));
  check('Favoriten-HTML: Fenster, Gruppen, Farben und „frei“ bleiben erhalten', back.tabi && eq(flatGroups(back.windows), flatGroups(prof.windows)), { back: flatGroups(back.windows), orig: flatGroups(prof.windows) });
  const edgeExport = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Favoritenleiste</H3>
  <DL><p>
    <DT><A HREF="https://lose.example.com/">Lose</A>
    <DT><H3>Arbeit</H3>
    <DL><p>
      <DT><A HREF="https://a.example.com/">A</A>
      <DT><A HREF="javascript:void(0)">Bookmarklet</A>
      <DT><H3>Tools</H3>
      <DL><p><DT><A HREF="https://t.example.com/">T</A></DL><p>
    </DL><p>
  </DL><p>
</DL><p>`;
  const generic = parseBookmarksHtml(edgeExport);
  const gTitles = generic.windows[0]?.groups.map(g => `${g.title}:${g.tabs.length}`);
  check('Edge-Favoriten: Ordner werden Gruppen, Bookmarklets ignoriert', !generic.tabi && eq(gTitles, ['Favoritenleiste:1', 'Arbeit:1', 'Tools:1']), gTitles);
  const fakeParse = t => ({ valid: /^https?:\/\//.test(t) ? [t] : (/\./.test(t) ? [`https://${t}`] : []), invalid: [] });
  const list = parseLinkList(exportLinkList(prof), fakeParse);
  check('Linkliste: Fenster/Gruppen über Überschriften rekonstruiert', eq(list.windows.map(w => `${w.name}:${w.groups.map(g => `${g.title}=${g.tabs.length}`).join('/')}`), prof.windows.map(w => `${w.name}:${w.groups.map(g => `${g.title}=${g.tabs.length}`).join('/')}`)));
  const plain = parseLinkList('heise.de\nhttps://github.com/\n', fakeParse);
  check('Einfache Linkliste ohne Überschriften → eine Gruppe', plain.windows.length === 1 && plain.windows[0].groups[0].tabs.length === 2);
}

async function main() {
  const t0 = Date.now();
  try {
    await testValidator();
    const m = await testMain();
    const m4 = await testRestarts(m);
    await testConfig(m4);
    await testCaptureBind();
    await testSync();
    await testProfilesAndProtect();
  } catch (e) {
    check(`Unerwarteter Abbruch: ${e.message}`, false, e.stack);
  }
  const failed = results.filter(r => !r.ok);
  write(`\n${results.length - failed.length}/${results.length} bestanden, ${failed.length} fehlgeschlagen (${Math.round((Date.now() - t0) / 1000)} s).`, failed.length ? 'fail summary' : 'pass summary');
  document.title = failed.length ? `FAIL ${failed.length}` : 'PASS';
  window.__tabiResults = { total: results.length, failed };
}

main();
