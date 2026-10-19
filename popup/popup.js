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

function renderProfiles(st) {
  const row = $('profileRow');
  const sel = $('profileSelect');
  row.hidden = !st.profiles?.length || st.configRev === 0 && st.profiles.length < 2;
  if (switching) return; // Auswahl nicht überschreiben, während der Wechsel bestätigt wird
  const sig = JSON.stringify([st.profiles, st.activeProfile]);
  if (sel.dataset.sig === sig) return;
  sel.dataset.sig = sig;
  sel.replaceChildren(...(st.profiles || []).map(p => {
    const o = el('option', '', p.name);
    o.value = p.id;
    return o;
  }));
  sel.value = st.activeProfile;
  sel.disabled = (st.profiles || []).length < 2;
}

let switching = false;
let lastStatus = null;

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
  for (const w of st.windows) {
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
  try {
    const res = await send(msg);
    if (res.status) render(res.status);
  } catch (e) {
    setState('err', 'Aktion fehlgeschlagen', e.message);
  } finally {
    busy = false;
    if (btn) btn.disabled = false;
  }
}

$('profileSelect').addEventListener('change', () => {
  switching = $('profileSelect').value !== lastStatus?.activeProfile;
  $('switchBox').hidden = !switching;
});
$('switchCancel').addEventListener('click', () => {
  switching = false;
  $('switchBox').hidden = true;
  $('profileSelect').value = lastStatus?.activeProfile;
});
$('switchGo').addEventListener('click', async e => {
  await run(e.currentTarget, { type: 'switchProfile', profileId: $('profileSelect').value, closeOld: $('closeOld').checked });
  switching = false;
  $('switchBox').hidden = true;
  $('profileSelect').dataset.sig = '';
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
