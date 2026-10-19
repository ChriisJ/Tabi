// Tabi – Kodierung der Vorlage für chrome.storage.sync.
// storage.sync erlaubt max. 8 KB pro Eintrag und ~100 KB gesamt. Die Vorlage wird deshalb als
// JSON-Text in Stücke geteilt (tpl_0 … tpl_n) und mit einem Metadaten-Eintrag (tpl_meta) beschrieben.
// Alles wird in EINEM set()-Aufruf geschrieben; beim Lesen prüft ein Hash die Vollständigkeit.

export const META_KEY = 'tpl_meta';
export const CHUNK_PREFIX = 'tpl_';
export const SYNC_FORMAT = 1;
// 2000 Zeichen × max. 3 Byte UTF-8 + JSON-Escapes bleiben sicher unter 8192 Byte pro Eintrag.
const CHUNK_CHARS = 2000;
export const SYNC_QUOTA_BYTES = 102400;
const SAFE_TOTAL_BYTES = 90000;

// FNV-1a (32 Bit) – reicht zur Erkennung unvollständig synchronisierter Stücke.
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function byteSize(items) {
  const enc = new TextEncoder();
  let n = 0;
  for (const [k, v] of Object.entries(items)) n += k.length + enc.encode(JSON.stringify(v)).length;
  return n;
}

/**
 * @param {object} config  gültige Vorlage (Rohfassung, wie gespeichert)
 * @param {{rev:number, deviceId:string, deviceName:string}} info
 * @returns {{items: object, n: number, bytes: number, tooLarge: boolean}}
 */
export function encodeTemplate(config, info) {
  const text = JSON.stringify(config);
  const items = {};
  let n = 0;
  for (let i = 0; i < text.length; i += CHUNK_CHARS) items[`${CHUNK_PREFIX}${n++}`] = text.slice(i, i + CHUNK_CHARS);
  items[META_KEY] = {
    format: SYNC_FORMAT, rev: info.rev, n, hash: hashString(text), length: text.length,
    deviceId: info.deviceId, deviceName: info.deviceName, savedAt: Date.now()
  };
  const bytes = byteSize(items);
  return { items, n, bytes, tooLarge: bytes > SAFE_TOTAL_BYTES };
}

/**
 * @param {object} all  Ergebnis von storage.sync.get(null)
 * @returns {{status:'none'} | {status:'incomplete', meta:object} | {status:'ok', meta:object, config:object} | {status:'error', meta:object, error:string}}
 */
export function decodeTemplate(all) {
  const meta = all?.[META_KEY];
  if (!meta || typeof meta !== 'object') return { status: 'none' };
  if (meta.format !== SYNC_FORMAT) return { status: 'error', meta, error: `Unbekanntes Sync-Format ${meta.format} (neuere Tabi-Version auf einem anderen Gerät?)` };
  let text = '';
  for (let i = 0; i < meta.n; i++) {
    const part = all[`${CHUNK_PREFIX}${i}`];
    if (typeof part !== 'string') return { status: 'incomplete', meta };
    text += part;
  }
  if (text.length !== meta.length || hashString(text) !== meta.hash) return { status: 'incomplete', meta };
  try {
    return { status: 'ok', meta, config: JSON.parse(text) };
  } catch (e) {
    return { status: 'error', meta, error: `Sync-Daten nicht lesbar: ${e.message}` };
  }
}

// Schlüssel alter Stücke, die nach einem kürzeren Schreibvorgang übrig bleiben.
export function staleChunkKeys(all, n) {
  return Object.keys(all || {}).filter(k => k.startsWith(CHUNK_PREFIX) && k !== META_KEY && Number(k.slice(CHUNK_PREFIX.length)) >= n);
}
