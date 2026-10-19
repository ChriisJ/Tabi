// Vereinfachte In-Memory-Nachbildung der benötigten chrome.*-APIs für Logiktests.
// ACHTUNG: Das ist KEIN Ersatz für einen Test in echtem Edge. Gruppen-/Positionssemantik ist
// an Chromium angelehnt, aber nicht identisch.

export function createMock({ idBase = 0, cloud = { data: {} } } = {}) {
  let nextTab = 100 + idBase;
  let nextGroup = 500 + idBase;
  let nextWin = 10 + idBase;
  const wins = new Map();   // id -> { id, type, incognito, focused, tabs: [] }
  const groups = new Map(); // id -> { id, windowId, title, color, collapsed }
  const store = { local: {}, session: {} };
  const allListeners = [];

  function ev() {
    const ls = [];
    const e = {
      addListener(fn) { ls.push(fn); },
      removeListener(fn) { const i = ls.indexOf(fn); if (i >= 0) ls.splice(i, 1); },
      hasListeners() { return ls.length > 0; },
      _fire(...args) { for (const l of [...ls]) setTimeout(() => l(...args), 0); },
      _call(...args) { return [...ls].map(l => l(...args)); },
      _clear() { ls.length = 0; }
    };
    allListeners.push(e);
    return e;
  }

  const E = {
    tabs: { onRemoved: ev(), onReplaced: ev(), onUpdated: ev(), onCreated: ev(), onAttached: ev(), onMoved: ev() },
    tabGroups: { onCreated: ev(), onUpdated: ev(), onRemoved: ev() },
    windows: { onCreated: ev(), onRemoved: ev() },
    runtime: { onStartup: ev(), onInstalled: ev(), onMessage: ev() },
    storage: { onChanged: ev() }
  };

  // Gemeinsamer Sync-Speicher („Cloud“) – mehrere simulierte Geräte können ihn teilen.
  function syncApply(items, removeKeys = []) {
    const changes = {};
    for (const [k, v] of Object.entries(items)) { changes[k] = { oldValue: cloud.data[k], newValue: clone(v) }; cloud.data[k] = clone(v); }
    for (const k of removeKeys) if (k in cloud.data) { changes[k] = { oldValue: cloud.data[k] }; delete cloud.data[k]; }
    if (Object.keys(changes).length) E.storage.onChanged._fire(changes, 'sync');
  }

  const clone = o => structuredClone(o);
  const reindex = w => w.tabs.forEach((t, i) => { t.index = i; });
  const findTab = id => { for (const w of wins.values()) { const t = w.tabs.find(x => x.id === id); if (t) return t; } return null; };
  const winOut = (w, populate) => {
    const o = { id: w.id, type: w.type, incognito: w.incognito, focused: w.focused };
    if (populate) o.tabs = w.tabs.map(clone);
    return o;
  };

  function cleanupGroups() {
    for (const g of [...groups.values()]) {
      const w = [...wins.values()].find(x => x.tabs.some(t => t.groupId === g.id));
      if (!w) { groups.delete(g.id); E.tabGroups.onRemoved._fire(clone(g)); } else g.windowId = w.id;
    }
  }

  // Einfügen mit Chromium-ähnlicher Gruppenzugehörigkeit.
  function insertTab(w, t, index, keepGroup) {
    if (index == null || index < 0 || index > w.tabs.length) index = w.tabs.length;
    w.tabs.splice(index, 0, t);
    reindex(w);
    t.windowId = w.id;
    const L = w.tabs[index - 1];
    const R = w.tabs[index + 1];
    if (keepGroup !== undefined && keepGroup !== -1 && ((L && L.groupId === keepGroup) || (R && R.groupId === keepGroup))) {
      t.groupId = keepGroup;
    } else {
      t.groupId = (L && R && L.groupId !== -1 && L.groupId === R.groupId) ? L.groupId : -1;
    }
  }

  function detach(t) {
    const w = wins.get(t.windowId);
    w.tabs.splice(w.tabs.indexOf(t), 1);
    reindex(w);
    return w;
  }

  function maybeCloseEmptyWindow(w) {
    if (w.tabs.length === 0) { wins.delete(w.id); E.windows.onRemoved._fire(w.id); }
  }

  function newTab(url) {
    return { id: nextTab++, windowId: -1, index: 0, groupId: -1, url: '', pendingUrl: url, active: false, incognito: false, title: '' };
  }

  function commitUrlLater(t) {
    setTimeout(() => {
      if (!findTab(t.id)) return;
      t.url = t.pendingUrl; delete t.pendingUrl;
      E.tabs.onUpdated._fire(t.id, { url: t.url }, clone(t));
      E.tabs.onUpdated._fire(t.id, { status: 'complete' }, clone(t));
    }, 5);
  }

  const chrome = {
    runtime: {
      id: 'tabi-test', lastError: undefined, ...E.runtime,
      getURL: p => `/${p}`,
      openOptionsPage: () => {},
      sendMessage(msg, cb) {
        let answered = false;
        const respond = r => { if (!answered) { answered = true; setTimeout(() => cb && cb(r), 0); } };
        const res = E.runtime.onMessage._call(msg, { id: 'tabi-test' }, respond);
        if (!res.some(Boolean)) respond(undefined);
      }
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    storage: {
      local: { get: async keys => pick(store.local, keys), set: async obj => { Object.assign(store.local, clone(obj)); } },
      session: { get: async keys => pick(store.session, keys), set: async obj => { Object.assign(store.session, clone(obj)); } },
      sync: {
        get: async keys => (keys === null || keys === undefined ? clone(cloud.data) : pick(cloud.data, keys)),
        set: async obj => syncApply(obj),
        remove: async keys => syncApply({}, Array.isArray(keys) ? keys : [keys])
      },
      onChanged: E.storage.onChanged
    },
    tabs: {
      ...E.tabs,
      async get(id) { const t = findTab(id); if (!t) throw new Error(`No tab with id: ${id}.`); return clone(t); },
      async query(q = {}) {
        const out = [];
        for (const w of wins.values()) if (q.windowId === undefined || q.windowId === w.id) out.push(...w.tabs.map(clone));
        return out;
      },
      async create({ windowId, index, url, active }) {
        const w = windowId === undefined ? [...wins.values()].find(x => x.focused) || [...wins.values()][0] : wins.get(windowId);
        if (!w) throw new Error(`No window with id: ${windowId}.`);
        const t = newTab(url);
        t.active = !!active;
        insertTab(w, t, index);
        E.tabs.onCreated._fire(clone(t));
        commitUrlLater(t);
        return clone(t);
      },
      async remove(ids) {
        for (const id of Array.isArray(ids) ? ids : [ids]) {
          if (!findTab(id)) throw new Error(`No tab with id: ${id}.`);
          user.closeTab(id);
        }
      },
      async move(id, { windowId, index }) {
        const t = findTab(id);
        if (!t) throw new Error(`No tab with id: ${id}.`);
        const oldGroup = t.groupId;
        const from = detach(t);
        const to = windowId !== undefined ? wins.get(windowId) : from;
        if (!to) throw new Error(`No window with id: ${windowId}.`);
        insertTab(to, t, index, to === from ? oldGroup : undefined);
        cleanupGroups();
        if (to !== from) { E.tabs.onAttached._fire(id, { newWindowId: to.id, newPosition: t.index }); maybeCloseEmptyWindow(from); }
        else E.tabs.onMoved._fire(id, {});
        return clone(t);
      },
      async group({ groupId, tabIds, createProperties }) {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        const tabs = ids.map(id => { const t = findTab(id); if (!t) throw new Error(`No tab with id: ${id}.`); return t; });
        if (groupId !== undefined) {
          const g = groups.get(groupId);
          if (!g) throw new Error(`No group with id: ${groupId}.`);
          for (const t of tabs) {
            if (t.groupId === groupId) continue;
            const from = detach(t);
            const target = wins.get(g.windowId);
            const members = target.tabs.filter(x => x.groupId === groupId);
            const last = Math.max(...members.map(x => x.index));
            target.tabs.splice(last + 1, 0, t); reindex(target); t.windowId = target.id; t.groupId = groupId;
            if (from !== target) maybeCloseEmptyWindow(from);
          }
          cleanupGroups();
          return groupId;
        }
        const wid = createProperties?.windowId ?? tabs[0].windowId;
        const target = wins.get(wid);
        if (!target) throw new Error(`No window with id: ${wid}.`);
        const gid = nextGroup++;
        const anchor = tabs[0].windowId === wid ? tabs[0].index : target.tabs.length;
        let removedBefore = 0;
        for (const t of tabs) { if (t.windowId === wid && t.index < anchor) removedBefore++; }
        const froms = tabs.map(detach);
        let pos = Math.min(anchor - removedBefore, target.tabs.length);
        if (pos < 0) pos = 0;
        for (const t of tabs) { target.tabs.splice(pos++, 0, t); t.windowId = wid; t.groupId = gid; }
        reindex(target);
        groups.set(gid, { id: gid, windowId: wid, title: '', color: 'grey', collapsed: false });
        E.tabGroups.onCreated._fire(clone(groups.get(gid)));
        froms.forEach(f => { if (f !== target) maybeCloseEmptyWindow(f); });
        cleanupGroups();
        return gid;
      }
    },
    tabGroups: {
      ...E.tabGroups,
      async get(id) { const g = groups.get(id); if (!g) throw new Error(`No group with id: ${id}.`); return clone(g); },
      async query() { return [...groups.values()].map(clone); },
      async update(id, props) {
        const g = groups.get(id);
        if (!g) throw new Error(`No group with id: ${id}.`);
        Object.assign(g, props);
        E.tabGroups.onUpdated._fire(clone(g));
        return clone(g);
      }
    },
    windows: {
      ...E.windows,
      async get(id) { const w = wins.get(id); if (!w) throw new Error(`No window with id: ${id}.`); return winOut(w, false); },
      async getAll({ populate } = {}) { return [...wins.values()].map(w => winOut(w, populate)); },
      async create({ url, tabId, focused } = {}) {
        const w = { id: nextWin++, type: 'normal', incognito: false, focused: !!focused, tabs: [] };
        wins.set(w.id, w);
        if (tabId !== undefined) {
          const t = findTab(tabId);
          const from = detach(t);
          insertTab(w, t, 0);
          maybeCloseEmptyWindow(from);
          cleanupGroups();
        } else {
          const urls = url === undefined ? ['edge://newtab/'] : (Array.isArray(url) ? url : [url]);
          for (const u of urls) { const t = newTab(u); insertTab(w, t, -1); commitUrlLater(t); }
        }
        E.windows.onCreated._fire(winOut(w, false));
        for (const t of w.tabs) E.tabs.onCreated._fire(clone(t));
        return winOut(w, true);
      }
    }
  };

  function pick(obj, keys) {
    const out = {};
    for (const k of (Array.isArray(keys) ? keys : [keys])) if (obj[k] !== undefined) out[k] = clone(obj[k]);
    return out;
  }

  // ---- Teststeuerung („Nutzeraktionen“) ----
  const user = {
    openWindow(urls) {
      const w = { id: nextWin++, type: 'normal', incognito: false, focused: true, tabs: [] };
      wins.set(w.id, w);
      for (const u of urls) { const t = newTab(u); t.url = u; delete t.pendingUrl; insertTab(w, t, -1); }
      E.windows.onCreated._fire(winOut(w, false));
      return w.id;
    },
    openTab(windowId, url, index) {
      const w = wins.get(windowId);
      const t = newTab(url); t.url = url; delete t.pendingUrl;
      insertTab(w, t, index);
      E.tabs.onCreated._fire(clone(t));
      return t.id;
    },
    addToGroup(tabId, groupId) { return chrome.tabs.group({ groupId, tabIds: [tabId] }); },
    closeTab(id) {
      const t = findTab(id);
      if (!t) throw new Error(`closeTab: kein Tab ${id}`);
      const w = detach(t);
      E.tabs.onRemoved._fire(id, { windowId: w.id, isWindowClosing: false });
      cleanupGroups();
      maybeCloseEmptyWindow(w);
    },
    closeGroup(groupId) {
      const ids = [];
      for (const w of wins.values()) for (const t of w.tabs) if (t.groupId === groupId) ids.push(t.id);
      ids.forEach(id => user.closeTab(id));
    },
    closeWindow(windowId) {
      const w = wins.get(windowId);
      for (const t of [...w.tabs]) E.tabs.onRemoved._fire(t.id, { windowId, isWindowClosing: true });
      w.tabs.length = 0;
      wins.delete(windowId);
      cleanupGroups();
      E.windows.onRemoved._fire(windowId);
    },
    navigate(tabId, url) {
      const t = findTab(tabId);
      t.url = url;
      E.tabs.onUpdated._fire(tabId, { url }, clone(t));
    },
    moveTab(tabId, windowId, index) { return chrome.tabs.move(tabId, { windowId, index }); },
    renameGroup(groupId, title) { return chrome.tabGroups.update(groupId, { title }); }
  };

  // Simulierter Browserneustart mit Sitzungswiederherstellung: gleiche Struktur, NEUE IDs,
  // storage.session leer, storage.local bleibt.
  function restartWithRestore({ restore = true, idOffset = 1000 } = {}) {
    const m = createMock({ idBase: idBase + idOffset, cloud });
    Object.assign(m.store.local, clone(store.local));
    const layout = [...wins.values()].map(w => w.tabs.map(t => {
      const g = groups.get(t.groupId);
      return { url: t.url || t.pendingUrl, group: g ? { old: g.id, title: g.title, color: g.color, collapsed: g.collapsed } : null };
    }));
    m.restoreLayout = () => { if (restore) m._build(layout); };
    return m;
  }

  // Baut eine Fensterstruktur synchron auf (wie die Sitzungswiederherstellung).
  function build(layout) {
    for (const wtabs of layout) {
      const w = { id: nextWin++, type: 'normal', incognito: false, focused: false, tabs: [] };
      wins.set(w.id, w);
      E.windows.onCreated._fire(winOut(w, false));
      const gmap = new Map();
      for (const d of wtabs) {
        const t = newTab(d.url); t.url = d.url; delete t.pendingUrl;
        w.tabs.push(t); t.windowId = w.id;
        if (d.group) {
          if (!gmap.has(d.group.old)) {
            const gid = nextGroup++;
            gmap.set(d.group.old, gid);
            groups.set(gid, { id: gid, windowId: w.id, title: d.group.title, color: d.group.color, collapsed: d.group.collapsed });
            E.tabGroups.onCreated._fire(clone(groups.get(gid)));
          }
          t.groupId = gmap.get(d.group.old);
        }
        E.tabs.onCreated._fire(clone(t));
      }
      reindex(w);
    }
  }

  function snapshot() {
    return [...wins.values()].map(w => ({
      windowId: w.id,
      tabs: w.tabs.map(t => {
        const g = groups.get(t.groupId);
        return { id: t.id, url: t.url || t.pendingUrl, group: g ? g.title : null, color: g ? g.color : null };
      })
    }));
  }

  return {
    chrome, store, user, wins, groups, snapshot, restartWithRestore, _build: build, cloud,
    // Schreibt wie ein ANDERES Gerät in den Sync (löst storage.onChanged aus).
    remoteSyncWrite: (items, removeKeys) => syncApply(items, removeKeys),
    clearListeners() { allListeners.forEach(e => e._clear()); },
    fire: {
      startup: () => E.runtime.onStartup._fire(),
      installed: details => E.runtime.onInstalled._fire(details)
    },
    send(msg) {
      return new Promise(resolve => {
        const results = E.runtime.onMessage._call(msg, { id: 'tabi-test' }, resolve);
        if (!results.some(Boolean)) resolve(undefined);
      });
    }
  };
}
