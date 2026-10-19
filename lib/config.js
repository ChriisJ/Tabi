// Tabi – Konfigurationsschema, Standardvorlage und Validierung.
// Wird vom Service-Worker (background.js) UND von der Einstellungsseite genutzt.
//
// Version 2: mehrere Profile. Jedes Profil enthält eigene Fenster → Gruppen → Pflicht-Tabs.
// Welches Profil aktiv ist, wird NICHT in der Vorlage gespeichert (gerätespezifisch, siehe background.js).
// Version-1-Vorlagen (nur „windows“) werden automatisch in ein Profil „Standard“ übernommen.

export const CONFIG_VERSION = 2;

// Farben, die chrome.tabGroups.Color offiziell kennt.
export const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

export const DEFAULT_SETTINGS = {
  // Beim Browserstart: Ein Fenster, das NUR eine leere Neuer-Tab-Seite enthält,
  // wird für das erste fehlende Vorlagenfenster mitbenutzt (statt ein zusätzliches Fenster zu öffnen).
  // Der Neuer-Tab-Tab selbst wird NICHT geschlossen.
  reuseEmptyStartupWindow: true,
  // Neu erzeugte Vorlagenfenster in den Vordergrund holen (nur beim Aufbau, nie bei Reparaturen).
  focusCreatedWindows: true
};

export const DEFAULT_WINDOWS = [
  {
    id: 'daily',
    name: 'Daily',
    groups: [
      {
        id: 'gaming',
        title: 'Gaming',
        color: 'blue',
        collapsed: false,
        tabs: [
          { id: 'gaming-portal-1', url: 'https://example.com/portal-1' },
          { id: 'gaming-portal-2', url: 'https://example.com/portal-2' },
          { id: 'gaming-portal-3', url: 'https://example.com/portal-3' }
        ]
      },
      {
        id: 'recherche',
        title: 'Recherche',
        color: 'green',
        collapsed: true,
        tabs: [
          { id: 'recherche-privat-1', url: 'https://example.org/privat-1' },
          { id: 'recherche-privat-2', url: 'https://example.org/privat-2' }
        ]
      }
    ]
  },
  {
    id: 'weitere-portale',
    name: 'Weitere Portale',
    groups: [
      {
        id: 'tools',
        title: 'Tools',
        color: 'orange',
        collapsed: false,
        tabs: [
          { id: 'tools-tool-1', url: 'https://example.net/tool-1' }
        ]
      }
    ]
  }
];

export const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  profiles: [
    { id: 'standard', name: 'Standard', windows: DEFAULT_WINDOWS }
  ]
};

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Wandelt eine Version-1-Vorlage ({windows}) strukturell in Version 2 ({profiles}) um.
 * Unbekannte Felder bleiben erhalten. Andere Eingaben werden unverändert zurückgegeben.
 */
export function migrateConfig(raw) {
  if (!isPlainObject(raw)) return raw;
  if (Array.isArray(raw.profiles)) return raw;
  if (Array.isArray(raw.windows) && (raw.version === undefined || raw.version === 1)) {
    const { windows, ...rest } = raw;
    return { ...rest, version: CONFIG_VERSION, profiles: [{ id: 'standard', name: 'Standard', windows }] };
  }
  return raw;
}

function checkUnknownKeys(obj, allowed, path, warnings) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) warnings.push(`${path}: Unbekanntes Feld „${k}“ wird ignoriert.`);
  }
}

/**
 * Prüft eine Konfiguration (Objekt oder JSON-String). Version 1 wird vorher migriert.
 * @returns {{ok:boolean, errors:string[], warnings:string[], config:object|null}}
 *          config ist die normalisierte Fassung (Version 2, Standardwerte ergänzt, Strings getrimmt).
 */
export function validateConfig(input) {
  const errors = [];
  const warnings = [];
  let raw = input;

  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`Ungültiges JSON: ${e.message}`], warnings, config: null };
    }
  }
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['Die Konfiguration muss ein JSON-Objekt sein ({ ... }).'], warnings, config: null };
  }
  raw = migrateConfig(raw);

  checkUnknownKeys(raw, ['version', 'settings', 'profiles', '$comment'], 'Wurzel', warnings);

  if (raw.version !== undefined && raw.version !== CONFIG_VERSION) {
    errors.push(`version: Erwartet ${CONFIG_VERSION}, gefunden ${JSON.stringify(raw.version)} (Vorlage einer neueren Tabi-Version?).`);
  }

  const settings = { ...DEFAULT_SETTINGS };
  if (raw.settings !== undefined) {
    if (!isPlainObject(raw.settings)) {
      errors.push('settings: Muss ein Objekt sein.');
    } else {
      checkUnknownKeys(raw.settings, Object.keys(DEFAULT_SETTINGS), 'settings', warnings);
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (raw.settings[k] === undefined) continue;
        if (typeof raw.settings[k] !== 'boolean') errors.push(`settings.${k}: Muss true oder false sein.`);
        else settings[k] = raw.settings[k];
      }
    }
  }

  const out = { version: CONFIG_VERSION, settings, profiles: [] };

  if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) {
    errors.push('profiles: Es wird mindestens ein Profil benötigt.');
    return { ok: false, errors, warnings, config: null };
  }

  // IDs sind über ALLE Profile eindeutig (sie verbinden offene Tabs und Sync-Daten mit der Vorlage).
  const profileIds = new Set();
  const profileNames = new Set();
  const windowIds = new Set();
  const groupIds = new Set();
  const tabIds = new Set();

  const checkId = (value, path, set, what) => {
    if (typeof value !== 'string' || !ID_RE.test(value)) {
      errors.push(`${path}.id: ${what}-ID fehlt oder ist ungültig (erlaubt: Buchstaben, Ziffern, „-“, „_“, „.“; max. 64 Zeichen; Beginn mit Buchstabe/Ziffer).`);
      return false;
    }
    if (set.has(value)) {
      errors.push(`${path}.id: ${what}-ID „${value}“ ist doppelt vergeben. IDs müssen eindeutig sein.`);
      return false;
    }
    set.add(value);
    return true;
  };

  raw.profiles.forEach((p, pi) => {
    const pp = `profiles[${pi}]`;
    if (!isPlainObject(p)) { errors.push(`${pp}: Muss ein Objekt sein.`); return; }
    checkUnknownKeys(p, ['id', 'name', 'windows', '$comment'], pp, warnings);
    checkId(p.id, pp, profileIds, 'Profil');
    let pname = '';
    if (typeof p.name !== 'string' || !p.name.trim()) {
      errors.push(`${pp}.name: Profilname fehlt.`);
    } else {
      pname = p.name.trim();
      if (profileNames.has(pname.toLowerCase())) errors.push(`${pp}.name: Der Profilname „${pname}“ ist doppelt vergeben.`);
      profileNames.add(pname.toLowerCase());
    }
    const po = { id: p.id, name: pname, windows: [] };
    const groupTitles = new Map(); // pro Profil eindeutig

    if (!Array.isArray(p.windows) || p.windows.length === 0) {
      errors.push(`${pp}.windows: Jedes Profil braucht mindestens ein Fenster.`);
      out.profiles.push(po);
      return;
    }

    p.windows.forEach((w, wi) => {
      const wp = `${pp}.windows[${wi}]`;
      if (!isPlainObject(w)) { errors.push(`${wp}: Muss ein Objekt sein.`); return; }
      checkUnknownKeys(w, ['id', 'name', 'groups', '$comment'], wp, warnings);
      checkId(w.id, wp, windowIds, 'Fenster');
      const name = typeof w.name === 'string' && w.name.trim() ? w.name.trim() : String(w.id || `Fenster ${wi + 1}`);
      if (w.name !== undefined && typeof w.name !== 'string') errors.push(`${wp}.name: Muss ein Text sein.`);

      const wo = { id: w.id, name, groups: [] };

      if (!Array.isArray(w.groups) || w.groups.length === 0) {
        errors.push(`${wp}.groups: Jedes Fenster braucht mindestens eine Gruppe.`);
      } else {
        w.groups.forEach((g, gi) => {
          const gp = `${wp}.groups[${gi}]`;
          if (!isPlainObject(g)) { errors.push(`${gp}: Muss ein Objekt sein.`); return; }
          checkUnknownKeys(g, ['id', 'title', 'color', 'collapsed', 'tabs', '$comment'], gp, warnings);
          checkId(g.id, gp, groupIds, 'Gruppen');

          let title = '';
          if (typeof g.title !== 'string' || !g.title.trim()) {
            errors.push(`${gp}.title: Gruppenname fehlt. Er wird zum Wiedererkennen nach einem Neustart benötigt.`);
          } else {
            title = g.title.trim();
            const lc = title.toLowerCase();
            if (groupTitles.has(lc)) {
              errors.push(`${gp}.title: Der Gruppenname „${title}“ wird in diesem Profil bereits in ${groupTitles.get(lc)} verwendet. Gruppennamen müssen je Profil eindeutig sein, damit Gruppen nach einem Browserneustart sicher wiedererkannt werden.`);
            } else {
              groupTitles.set(lc, gp);
            }
          }

          let color = 'grey';
          if (g.color === undefined) {
            warnings.push(`${gp}.color: Keine Farbe angegeben, „grey“ wird verwendet.`);
          } else if (!GROUP_COLORS.includes(g.color)) {
            errors.push(`${gp}.color: „${g.color}“ ist keine gültige Farbe. Erlaubt: ${GROUP_COLORS.join(', ')}.`);
          } else {
            color = g.color;
          }

          let collapsed = false;
          if (g.collapsed !== undefined) {
            if (typeof g.collapsed !== 'boolean') errors.push(`${gp}.collapsed: Muss true oder false sein.`);
            else collapsed = g.collapsed;
          }

          const go = { id: g.id, title, color, collapsed, tabs: [] };

          if (!Array.isArray(g.tabs) || g.tabs.length === 0) {
            errors.push(`${gp}.tabs: Jede Gruppe braucht mindestens einen Pflicht-Tab.`);
          } else {
            g.tabs.forEach((t, ti) => {
              const tp = `${gp}.tabs[${ti}]`;
              if (!isPlainObject(t)) { errors.push(`${tp}: Muss ein Objekt sein.`); return; }
              checkUnknownKeys(t, ['id', 'url', 'protect', '$comment'], tp, warnings);
              checkId(t.id, tp, tabIds, 'Tab');
              let url = '';
              if (typeof t.url !== 'string' || !t.url.trim()) {
                errors.push(`${tp}.url: Start-URL fehlt.`);
              } else {
                try {
                  const u = new URL(t.url.trim());
                  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
                    errors.push(`${tp}.url: Nur http:// und https:// werden unterstützt (gefunden: ${u.protocol}).`);
                  } else {
                    url = u.href;
                    if (u.protocol === 'http:') warnings.push(`${tp}.url: Unverschlüsselte http-Adresse.`);
                  }
                } catch {
                  errors.push(`${tp}.url: „${t.url}“ ist keine gültige URL.`);
                }
              }
              let protect = true;
              if (t.protect !== undefined) {
                if (typeof t.protect !== 'boolean') errors.push(`${tp}.protect: Muss true oder false sein.`);
                else protect = t.protect;
              }
              go.tabs.push({ id: t.id, url, protect });
            });
          }
          wo.groups.push(go);
        });
      }
      po.windows.push(wo);
    });
    out.profiles.push(po);
  });

  return { ok: errors.length === 0, errors, warnings, config: errors.length === 0 ? out : null };
}

/**
 * Baut Nachschlagetabellen für die AKTIVEN Profile einer GÜLTIGEN Konfiguration.
 * profileIds: Array (mehrere Profile gleichzeitig) oder einzelne ID. Unbekannte IDs werden
 * ignoriert; bleibt keine übrig, gilt das erste Profil. Reihenfolge = Profil- bzw. Array-Reihenfolge.
 * Da IDs über alle Profile eindeutig sind, lassen sich die Profile verlustfrei vereinigen.
 */
export function flattenConfig(config, profileIds) {
  const wanted = new Set((Array.isArray(profileIds) ? profileIds : [profileIds]).filter(Boolean));
  let profiles = config.profiles.filter(p => wanted.has(p.id));
  if (!profiles.length) profiles = [config.profiles[0]];
  const windows = {};
  const groups = {};
  const tabs = {};
  const windowOrder = [];
  for (const p of profiles) {
    for (const w of p.windows) {
      windowOrder.push(w.id);
      windows[w.id] = { key: w.id, name: w.name, profileId: p.id, groupKeys: w.groups.map(g => g.id) };
      for (const g of w.groups) {
        groups[g.id] = {
          key: g.id, windowKey: w.id, profileId: p.id, title: g.title, color: g.color, collapsed: g.collapsed,
          tabKeys: g.tabs.map(t => t.id)
        };
        for (const t of g.tabs) {
          tabs[t.id] = { key: t.id, groupKey: g.id, windowKey: w.id, profileId: p.id, url: t.url, protect: t.protect !== false };
        }
      }
    }
  }
  return {
    profileIds: profiles.map(p => p.id),
    profileNames: Object.fromEntries(profiles.map(p => [p.id, p.name])),
    windows, groups, tabs, windowOrder
  };
}

// Alle Schlüssel (Fenster, Gruppen, Tabs) eines Profils.
export function profileKeys(config, profileId) {
  const s = new Set();
  const p = config.profiles.find(x => x.id === profileId);
  if (!p) return s;
  for (const w of p.windows) {
    s.add(w.id);
    for (const g of w.groups) { s.add(g.id); for (const t of g.tabs) s.add(t.id); }
  }
  return s;
}

// Alle Schlüssel aller Profile (z. B. damit Hinweise inaktiver Profile nicht verloren gehen).
export function allKeys(config) {
  const s = new Set();
  for (const p of config.profiles) {
    for (const w of p.windows) {
      s.add(w.id);
      for (const g of w.groups) { s.add(g.id); for (const t of g.tabs) s.add(t.id); }
    }
  }
  return s;
}
