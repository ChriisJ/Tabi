// Tabi – Popup. Reine Anzeige + Befehle an den Service-Worker.

const $ = id => document.getElementById(id);
let busy = false;
let pollTimer = null;

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

function fmtTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setState(kind, title, detail) {
  const s = $('state');
  s.className = `state state-${kind}`;
  $('stateTitle').textContent = title;
  $('stateDetail').textContent = detail || '';
}

// Profilliste: Schalter = Profil läuft (in eigenen Fenstern). „nur dieses“ beendet alle anderen.
function renderProfiles(st) {
  const box = $('profileBox');
  const list = $('profileList');
  const profiles = st.profiles || [];
  box.hidden = profiles.length < 2;
  if (box.hidden) return;
  const sig = JSON.stringify(profiles) + busy;
  if (list.dataset.sig === sig) return; // nicht neu zeichnen → Klicks gehen nicht verloren
  list.dataset.sig = sig;
  const activeCount = profiles.filter(p => p.active).length;
  const tabCount = id => st.windows.filter(w => w.profileId === id)
    .reduce((n, w) => n + w.groups.reduce((m, g) => m + g.tabs.filter(t => t.present).length, 0), 0);

  list.replaceChildren(...profiles.map(p => {
    const input = el('input');
    input.type = 'checkbox';
    input.checked = p.active;
    input.disabled = busy || (p.active && activeCount === 1); // das letzte aktive Profil bleibt an
    input.setAttribute('aria-label', `Profil „${p.name}“ ${p.active ? 'beenden' : 'zusätzlich öffnen'}`);
    input.addEventListener('change', () => {
      if (input.checked) run(null, { type: 'openProfile', profileId: p.id });
      else { input.checked = true; askClose(p); }
    });
    const sw = el('label', 'switch sm');
    sw.title = p.active ? (activeCount === 1 ? 'Mindestens ein Profil bleibt aktiv' : 'Profil beenden') : 'Zusätzlich in eigenen Fenstern öffnen';
    sw.append(input, el('span', 'slider'));
    const li = el('li', `profile-item${p.active ? ' on' : ''}`);
    li.append(sw, el('span', 'pname', p.name),
      el('span', 'pmeta', p.active ? `${tabCount(p.id)} Tabs` : 'aus'));
    if (!(p.active && activeCount === 1)) {
      const only = el('button', 'only', 'nur dieses');
      only.title = `Nur „${p.name}“ aktiv lassen`;
      only.disabled = busy;
      only.addEventListener('click', () => askOnly(p));
      li.append(only);
    }
    return li;
  }));
}

let pendingClose = null; // { kind: 'close'|'only', profile }
let lastStatus = null;

function askClose(p) {
  pendingClose = { kind: 'close', profile: p };
  $('closeTitle').textContent = `Profil „${p.name}“ beenden?`;
  $('closeGo').textContent = 'Profil beenden';
  $('closeTabs').parentElement.lastChild.textContent = ' Seine Pflicht-Tabs schließen (eigene Tabs bleiben offen)';
  $('closeBox').hidden = false;
}

function askOnly(p) {
  pendingClose = { kind: 'only', profile: p };
  $('closeTitle').textContent = `Nur „${p.name}“ aktiv lassen?`;
  $('closeGo').textContent = 'Andere beenden';
  $('closeTabs').parentElement.lastChild.textContent = ' Pflicht-Tabs der anderen Profile schließen (eigene Tabs bleiben offen)';
  $('closeBox').hidden = false;
}

function render(st) {
  lastStatus = st;
  renderProfiles(st);
  $('enabled').checked = st.enabled;
  const t = st.totals;

  if (st.sync?.enabled && st.sync.pendingChoice) {
    setState('warn', 'Sync: Entscheidung nötig', 'Die Vorlage hier unterscheidet sich von der im Sync. Bitte in „Vorlage bearbeiten“ auswählen, welche gelten soll.');
  } else if (st.configRev === 0) {
    setState('grey', 'Noch keine eigene Vorlage', st.sync?.enabled
      ? 'Über „Sitzung als Standard …“ einrichten – oder kurz warten, bis die Vorlage von deinem anderen Gerät per Sync ankommt.'
      : 'Über „Sitzung als Standard …“ einrichten.');
  } else if (!st.configValid) {
    setState('err', 'Konfiguration ungültig', `${st.configError || ''}\nBitte in den Einstellungen korrigieren.`);
  } else if (st.suspended) {
    setState('err', 'Automatik angehalten (Schleifenschutz)', `${st.suspendReason || ''}\n„Vorlage jetzt wiederherstellen“ setzt den Schutz zurück.`);
  } else if (!st.enabled) {
    setState('grey', 'Schutz ausgeschaltet', `${t.present}/${t.expected} Pflicht-Tabs offen. Geschlossene Tabs werden nicht wieder geöffnet.`);
  } else if (st.awaitingWindow || (st.startupPending && !st.bootDone)) {
    setState('grey', 'Warte auf Browserstart …', 'Die Vorlage wird aufgebaut, sobald die Sitzungswiederherstellung abgeschlossen ist.');
  } else if (t.missing > 0) {
    setState('warn', `Geschützt – ${t.missing} Pflicht-Tab(s) fehlen`,
      `${t.present}/${t.expected} offen. Fehlende Tabs in geschlossenen Fenstern werden erst beim nächsten Start oder über „Wiederherstellen“ ergänzt.`);
  } else {
    setState('ok', `Geschützt – alle ${t.expected} Pflicht-Tabs offen`,
      t.misplaced ? `${t.misplaced} Pflicht-Tab(s) liegen außerhalb ihrer Gruppe (werden beim manuellen Wiederherstellen zurückgeholt).` : '');
  }

  const box = $('windows');
  box.replaceChildren();
  const multi = (st.activeProfiles || []).length > 1;
  let lastProfile = null;
  for (const w of st.windows) {
    if (multi && w.profileId !== lastProfile) {
      box.append(el('div', 'win-profile', w.profileName || ''));
      lastProfile = w.profileId;
    }
    const wd = el('div', 'win');
    const head = el('div', 'win-name');
    head.append(el('span', '', w.name), el('span', '', w.open ? 'offen' : 'nicht offen'));
    wd.append(head);
    for (const g of w.groups) {
      const present = g.tabs.filter(x => x.present).length;
      const row = el('div', 'grp');
      row.append(el('span', `dot ${g.color}`), el('span', 'grp-title', g.title),
        el('span', `grp-count${present < g.tabs.length ? ' bad' : ''}`, `${present}/${g.tabs.length}`));
      wd.append(row);
      for (const tab of g.tabs) {
        if (tab.present) continue;
        if (tab.protect) wd.append(el('div', 'miss', `fehlt: ${tab.url}${tab.paused ? ' (pausiert)' : ''}`));
        else wd.append(el('div', 'free', `geschlossen (darf): ${tab.url}`));
      }
    }
    box.append(wd);
  }

  const parts = [];
  if (st.busy) parts.push(`Arbeitet: ${st.busy}`);
  else if (st.lastAction) parts.push(`${fmtTime(st.lastAction.t)} ${st.lastAction.text}`);
  if (st.lastError) parts.push(`Letzter Fehler ${fmtTime(st.lastError.t)}: ${st.lastError.msg}`);
  if (st.sync?.enabled && st.sync.error) parts.push(`Sync: ${st.sync.error}`);
  $('footer').textContent = parts.join(' · ');
}

async function refresh() {
  try {
    const res = await send({ type: 'getStatus' });
    render(res.status);
  } catch (e) {
    setState('err', 'Hintergrunddienst nicht erreichbar', e.message);
  }
}

async function run(btn, msg) {
  if (busy) return;
  busy = true;
  if (btn) btn.disabled = true;
  if (lastStatus) renderProfiles(lastStatus); // Schalter während der Aktion sperren
  let error = null;
  try {
    const res = await send(msg);
    if (res.status) lastStatus = res.status;
  } catch (e) {
    error = e;
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
    if (lastStatus) render(lastStatus);
    if (error) setState('err', 'Aktion fehlgeschlagen', error.message);
  }
}

$('closeCancel').addEventListener('click', () => {
  pendingClose = null;
  $('closeBox').hidden = true;
});
$('closeGo').addEventListener('click', async e => {
  if (!pendingClose) return;
  const { kind, profile } = pendingClose;
  const closeTabs = $('closeTabs').checked;
  $('closeBox').hidden = true;
  pendingClose = null;
  await run(e.currentTarget, kind === 'only'
    ? { type: 'switchProfile', profileId: profile.id, closeOld: closeTabs }
    : { type: 'closeProfile', profileId: profile.id, closeTabs });
  refresh();
});
$('enabled').addEventListener('change', e => run(null, { type: 'setEnabled', enabled: e.target.checked }));
$('restore').addEventListener('click', e => run(e.currentTarget, { type: 'restoreNow' }));
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('capture').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#capture') });
  window.close();
});

refresh();
pollTimer = setInterval(() => { if (!busy) refresh(); }, 2000);
