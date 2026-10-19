// Tabi – Export/Import-Formate für Tabs.
//  * Favoriten-HTML (Netscape-Bookmark-Format): von Edge/Chrome importier- und exportierbar.
//    Ordner = Gruppen; Tabi ergänzt eigene Attribute (Fenster, Farbe, „frei“), die Edge ignoriert.
//  * Linkliste (TXT): „# Fenster“, „## Gruppe“, darunter eine URL pro Zeile.
// Alle Parser liefern dieselbe neutrale Struktur:
//   { windows: [{ name, groups: [{ title, color|null, collapsed, tabs: [{ url, protect }] }] }] }

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function exportBookmarksHtml(profile) {
  const now = Math.floor(Date.now() / 1000);
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- Exportiert von Tabi. In Edge: Favoriten → Favoriten importieren → Favoriten- oder Lesezeichen-HTML-Datei. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    `    <DT><H3 ADD_DATE="${now}" DATA-TABI-KIND="profile">Tabi – ${esc(profile.name)}</H3>`,
    '    <DL><p>'
  ];
  for (const w of profile.windows) {
    lines.push(`        <DT><H3 ADD_DATE="${now}" DATA-TABI-KIND="window">${esc(w.name)}</H3>`, '        <DL><p>');
    for (const g of w.groups) {
      lines.push(`            <DT><H3 ADD_DATE="${now}" DATA-TABI-KIND="group" DATA-TABI-COLOR="${esc(g.color)}"${g.collapsed ? ' DATA-TABI-COLLAPSED="1"' : ''}>${esc(g.title)}</H3>`, '            <DL><p>');
      for (const t of g.tabs) {
        lines.push(`                <DT><A HREF="${esc(t.url)}" ADD_DATE="${now}"${t.protect === false ? ' DATA-TABI-FREE="1"' : ''}>${esc(t.url)}</A>`);
      }
      lines.push('            </DL><p>');
    }
    lines.push('        </DL><p>');
  }
  lines.push('    </DL><p>', '</DL><p>', '');
  return lines.join('\n');
}

/**
 * Liest eine Favoriten-HTML-Datei (Tabi-Export oder beliebiger Edge/Chrome-Export).
 * Tabi-Exporte werden 1:1 rekonstruiert. Bei fremden Dateien wird jeder Ordner mit direkten Links
 * zu einer Gruppe; alle Gruppen landen in einem Fenster. Lose Links → Gruppe „Favoriten“.
 */
export function parseBookmarksHtml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const rootDl = doc.querySelector('dl');
  if (!rootDl) return { windows: [], links: 0, tabi: false };

  const folders = []; // { name, kind, color, collapsed, path, urls: [{url, protect}] }
  let links = 0;
  const loose = { name: 'Favoriten', kind: null, color: null, collapsed: false, path: [], links: [] };

  function walk(dl, path) {
    for (const dt of dl.querySelectorAll(':scope > dt, :scope > p > dt')) {
      const h3 = dt.querySelector(':scope > h3');
      if (h3) {
        const folder = {
          name: h3.textContent.trim() || 'Ordner',
          kind: h3.getAttribute('data-tabi-kind'),
          color: h3.getAttribute('data-tabi-color'),
          collapsed: h3.getAttribute('data-tabi-collapsed') === '1',
          path,
          links: []
        };
        folders.push(folder);
        const sub = dt.querySelector(':scope > dl') || nextDl(dt);
        if (sub) walk(sub, [...path, folder]);
        continue;
      }
      const a = dt.querySelector(':scope > a[href]');
      if (a) {
        const url = a.getAttribute('href');
        if (!/^https?:\/\//i.test(url)) continue; // javascript:, edge://, Ordnerverknüpfungen …
        links++;
        const target = path.length ? path[path.length - 1] : loose;
        target.links.push({ url, protect: a.getAttribute('data-tabi-free') !== '1' });
      }
    }
  }
  // Manche Exporte setzen <DL> als Geschwister des <DT> statt als Kind.
  function nextDl(dt) {
    let n = dt.nextElementSibling;
    while (n && n.tagName === 'P') n = n.nextElementSibling;
    return n && n.tagName === 'DL' ? n : null;
  }
  walk(rootDl, []);

  const isTabi = folders.some(f => f.kind === 'group');
  const toGroup = f => ({ title: f.name, color: f.color || null, collapsed: !!f.collapsed, tabs: f.links });
  let windows;
  if (isTabi) {
    windows = folders.filter(f => f.kind === 'window').map(w => ({
      name: w.name,
      groups: folders.filter(g => g.kind === 'group' && g.path.includes(w) && g.links.length).map(toGroup)
    })).filter(w => w.groups.length);
  } else {
    const groups = folders.filter(f => f.links.length).map(f => {
      const g = toGroup(f);
      // Pfad als Hinweis, falls Ordnernamen mehrfach vorkommen („Arbeit / Tools“)
      const parent = f.path.filter(p => !/^(favoritenleiste|weitere favoriten|lesezeichenleiste|bookmarks bar|other bookmarks|favorites bar|other favorites)$/i.test(p.name)).pop();
      if (parent && folders.filter(x => x.name === f.name && x.links.length).length > 1) g.title = `${parent.name} / ${f.name}`;
      return g;
    });
    if (loose.links.length) groups.unshift(toGroup(loose));
    windows = groups.length ? [{ name: 'Importiert', groups }] : [];
  }
  return { windows, links, tabi: isTabi };
}

export function exportLinkList(profile) {
  const out = [`# Tabi-Profil: ${profile.name}`, '# Zeilen mit „#“ = Fenster, „##“ = Gruppe, sonst eine URL pro Zeile.', ''];
  for (const w of profile.windows) {
    out.push(`# ${w.name}`);
    for (const g of w.groups) {
      out.push(`## ${g.title}`);
      for (const t of g.tabs) out.push(t.url);
      out.push('');
    }
  }
  return out.join('\n');
}

/**
 * Liest eine Linkliste. Ohne Überschriften entsteht eine Gruppe „Importiert“.
 * parseUrls: Funktion (text) → {valid, invalid} (aus options.js, ergänzt fehlendes https://).
 */
export function parseLinkList(text, parseUrls) {
  const windows = [];
  let win = null;
  let group = null;
  let invalid = 0;
  const ensure = () => {
    if (!win) { win = { name: 'Importiert', groups: [] }; windows.push(win); }
    if (!group) { group = { title: 'Importiert', color: null, collapsed: false, tabs: [] }; win.groups.push(group); }
  };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^##\s+/.test(line)) {
      if (!win) { win = { name: 'Importiert', groups: [] }; windows.push(win); }
      group = { title: line.replace(/^##\s+/, ''), color: null, collapsed: false, tabs: [] };
      win.groups.push(group);
      continue;
    }
    if (/^#\s+/.test(line)) {
      if (/^#\s+Tabi-Profil:|^#\s+Zeilen mit/.test(line)) continue;
      win = { name: line.replace(/^#\s+/, ''), groups: [] };
      windows.push(win);
      group = null;
      continue;
    }
    if (line.startsWith('#')) continue;
    const { valid, invalid: bad } = parseUrls(line);
    invalid += bad.length;
    if (valid.length) { ensure(); group.tabs.push(...valid.map(url => ({ url, protect: true }))); }
  }
  for (const w of windows) w.groups = w.groups.filter(g => g.tabs.length);
  return { windows: windows.filter(w => w.groups.length), invalid };
}
