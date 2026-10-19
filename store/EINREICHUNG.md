# Einreichung bei Microsoft Edge-Add-ons

Für Version **0.5.0** · Ablauf nach [Microsoft: Publish a Microsoft Edge extension](https://learn.microsoft.com/microsoft-edge/extensions/publish/publish-extension) · [Zurück zur Übersicht](../README.md)

Alle Texte unten sind zum Kopieren fertig. Die Bilder liegen in [`assets/`](assets/). Neu erzeugen lassen sie sich mit `tools\store-assets.ps1`.

---

## 0. Vorbereitung

1. **Release 0.5.0 auf GitHub**, damit die Datenschutz-URL und die Website erreichbar sind.
2. **Paket bauen:**
   ```bash
   powershell -ExecutionPolicy Bypass -File tools\build-zip.ps1
   ```
   Ergebnis: `dist\tabi-0.5.0.zip`, ohne Tests, ohne Werkzeuge und ohne `key`.
3. **Entwicklerkonto** (kostenlos): [Partner Center → Microsoft Edge](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd) → mit deinem Microsoft-Konto anmelden → als Entwickler registrieren, Kontotyp *Einzelperson*. Der angezeigte Herausgebername erscheint im Store.

## 1. Paket hochladen

*Create new extension* → `dist\tabi-0.5.0.zip` hochladen.
Partner Center liest Name und Kurzbeschreibung aus `_locales/de` und `_locales/en`, deshalb erscheinen **Deutsch** und **Englisch** als Store-Sprachen.

## 2. Availability

| Feld | Wert |
|---|---|
| Visibility | **Public**. Alternativ zuerst *Hidden*, um die Store-Version selbst über den Link zu testen, und danach auf *Public* stellen. |
| Markets | alle (Standard) |

## 3. Properties

| Feld | Wert |
|---|---|
| Category | **Productivity** |
| Website | `https://github.com/ChriisJ/Tabi` |
| Support contact detail | `https://github.com/ChriisJ/Tabi/issues` |
| Mature content | nein |

## 4. Privacy

**Single Purpose Description**
```
Tabi maintains a user-defined template of browser windows, native tab groups and tabs. It builds this template when the browser starts and automatically reopens protected tabs that the user closed by accident. Users can keep several template profiles and run them in separate windows.
```

**Permission justification**

`tabs`
```
Tabi needs to read the URLs of open tabs to recognize the user's template tabs after a browser restart (session restore) and to offer "capture current session". It creates, moves and reopens the user's template tabs. URLs are only stored in the extension's local storage and are never transmitted to the developer or third parties.
```

`tabGroups`
```
Tabi creates, names, colors and collapses the native tab groups defined in the user's template, and recognizes these groups after a browser restart.
```

`storage`
```
Tabi stores the user's template and settings in extension storage. If the user enables sync, the template is synchronized through the browser's own chrome.storage.sync of the user's account.
```

**Are you using remote code?** → **No, I am not using remote code.**

**Data usage**
- Gesammelte Daten: **Web history** ankreuzen. Tabi liest die Adressen offener Tabs und speichert die zuletzt gesehene Adresse der verwalteten Tabs lokal. Sie verlassen das Gerät nur über den eigenen Browser-Sync des Nutzers. Das ehrlich anzugeben ist besser als eine Rückfrage der Prüfer.
- Alle drei Zusicherungen ankreuzen: kein Verkauf oder Weitergabe an Dritte, keine Nutzung für fremde Zwecke, keine Bonitätsprüfung.

**Privacy Policy URL**
```
https://github.com/ChriisJ/Tabi/blob/main/docs/PRIVACY.md
```

## 5. Store listings

Für **beide** Sprachen: Beschreibung, Logo und Screenshots. Name und Kurzbeschreibung kommen aus dem Paket.

### Bilder

| Feld | Datei | Pflicht |
|---|---|---|
| Extension logo (300 × 300) | `assets/logo-300.png`, für beide Sprachen gleich (*Duplicate*) | ✔ |
| Small promotional tile (440 × 280) | `assets/tile-small-440x280-de.png` / `-en.png` | – |
| Large promotional tile (1400 × 560) | `assets/tile-large-1400x560-de.png` / `-en.png` | – |
| Screenshots (1280 × 800, max. 6) | `assets/screenshot-1…5-*-de.png` / `-en.png`, in dieser Reihenfolge | – |

Screenshot-Reihenfolge: 1 Editor-Übersicht · 2 Popup mit zwei Profilen · 3 Sitzung übernehmen · 4 Farben und Schutz · 5 Favoriten-Import

### Beschreibung – Deutsch

```
Tabi baut beim Start von Microsoft Edge deine festen Fenster mit nativen Registerkartengruppen und Pflicht-Tabs auf – und hält sie dort. Schließt du einen wichtigen Tab versehentlich, öffnet Tabi ihn sofort wieder: im Hintergrund, in seiner Gruppe, an seiner Position.

Für alle, die die Tab-Sperre der früheren Edge-Arbeitsbereiche vermissen: Tabi sorgt dafür, dass deine wichtigen Tabs immer da sind.

FUNKTIONEN
• Feste Vorlage aus Fenstern, nativen Edge-Gruppen (Name, Farbe, Reihenfolge, auf-/zugeklappt) und Tabs
• Geschützte Tabs: geschlossene Pflicht-Tabs kommen automatisch zurück – auch ganze Gruppen
• Pro Tab wählbar: 🔒 geschützt oder 🔓 frei (öffnet sich beim Start, darf aber geschlossen bleiben)
• Mehrere Profile, z. B. „Standard“ und „Dev“ – gleichzeitig in eigenen Fenstern oder einzeln, per Schalter an und aus
• Visueller Editor mit Drag & Drop, Gruppenfarben, Rückgängig und Prüfung auf Fehler
• „Aktuelle Sitzung übernehmen“: Fenster einmal einrichten und als Standard speichern – offene Tabs werden direkt verknüpft, nichts öffnet doppelt
• Import und Export: JSON, Edge-Favoritendatei (Ordner werden Gruppen) und Linkliste
• Sync der Vorlage über dein Edge-Konto

ZUVERLÄSSIG
• Arbeitet mit der Sitzungswiederherstellung von Edge zusammen – keine doppelten Tabs
• Navigation, Anmeldungen und Weiterleitungen in Pflicht-Tabs bleiben frei
• Fenster schließen oder Edge beenden wird respektiert – nichts wird erzwungen
• Schutz vor Endlosschleifen

DATENSCHUTZ
Keine Telemetrie, keine Werbung, keine Netzwerkzugriffe, keine nachgeladenen Skripte. Deine Vorlage bleibt in deinem Browser und – wenn du Sync nutzt – in deinem eigenen Edge-Konto. Tabi liest keine Webseiteninhalte.

HINWEIS
Erweiterungen können das Schließen eines Tabs technisch nicht verhindern. Tabi öffnet geschützte Tabs deshalb sofort wieder; ein wiedergeöffneter Tab startet auf seiner Start-URL.

Quelloffen (MIT): https://github.com/ChriisJ/Tabi
```

### Description – English

```
Tabi builds your fixed windows with native tab groups and must-have tabs when Microsoft Edge starts – and keeps them there. If you close an important tab by accident, Tabi reopens it right away: in the background, in its group, at its position.

For everyone who misses the tab lock of the former Edge workspaces: Tabi makes sure your important tabs are always there.

FEATURES
• Fixed template of windows, native Edge tab groups (name, color, order, collapsed state) and tabs
• Protected tabs: closed must-have tabs come back automatically – even whole groups
• Per tab: 🔒 protected or 🔓 free (opens at startup but may stay closed)
• Multiple profiles, e.g. "Standard" and "Dev" – side by side in separate windows or one at a time, switched on and off with a toggle
• Visual editor with drag & drop, group colors, undo and validation
• "Capture current session": arrange your windows once and save them as default – open tabs are linked directly, nothing opens twice
• Import and export: JSON, Edge favorites file (folders become groups) and link lists
• Sync of your template through your Edge account

RELIABLE
• Works with Edge session restore – no duplicate tabs
• Navigation, sign-ins and redirects inside protected tabs stay free
• Closing a window or quitting Edge is respected – nothing is forced
• Built-in loop protection

PRIVACY
No telemetry, no ads, no network access, no remotely hosted code. Your template stays in your browser and – if you use sync – in your own Edge account. Tabi does not read web page content.

NOTE
Extensions cannot technically prevent a tab from being closed. Tabi therefore reopens protected tabs immediately; a reopened tab starts at its start URL.
The user interface is currently available in German.

Open source (MIT): https://github.com/ChriisJ/Tabi
```

### Suchbegriffe (max. 7 Begriffe, je ≤ 30 Zeichen, zusammen ≤ 21 Wörter)

| Deutsch | English |
|---|---|
| Tab-Gruppen | tab groups |
| Tabs sperren | lock tabs |
| Tabs schützen | protect tabs |
| Tab-Vorlage | tab template |
| Tabs wiederherstellen | restore tabs |
| Arbeitsbereiche | workspaces |
| Tab-Manager | tab manager |

## 6. Notes for certification

```
No account or login is needed.

How to test:
1. After installation, Tabi opens its options page with the hint "Noch keine eigene Vorlage" (no own template yet). The editor shows a sample template.
2. Click "Als Standard speichern" (Save as default). Tabi opens two windows with native tab groups ("Gaming" blue, "Recherche" green, "Tools" orange; example.com/.org/.net URLs).
3. Close one of these tabs (e.g. example.com/portal-2). It reopens in the background within about 0.5 s, in its group and position. The tab "portal-3" is marked as "frei" (free) and stays closed when you close it.
4. Close a whole group (right-click the group > Close group): it is rebuilt once.
5. Closing a whole window or quitting the browser is respected – nothing is reopened until the next start or until you click "Vorlage jetzt wiederherstellen" (Restore template now) in the popup.
6. Profiles: in the editor click "+ Profil", add a URL, save, then switch the profile on in the toolbar popup – it opens in its own window.
7. Turning protection off with the switch in the popup stops all automatic reopening.

The user interface is in German. The extension uses no remote code, no network requests and no content scripts. Permissions: tabs (read tab URLs to recognize template tabs after restart), tabGroups (native groups), storage (template, optional browser sync).
```

## 7. Nach der Freigabe

- Die Prüfung dauert laut Microsoft **bis zu 7 Werktage**. Danach steht der Status auf *In the Store*.
- Den Store-Link in README und Release eintragen.
- **Umstieg von der entpackten Version** (auf jedem Gerät): *Exportieren → Alle Profile*, die entpackte Version in `edge://extensions` entfernen, die Store-Version installieren, dann *Importieren → Alle ersetzen* und *Als Standard speichern*. Die Store-Version hat auf allen Geräten dieselbe ID, der Sync braucht also keinen `key` mehr.
- **Updates:** Version erhöhen, Release-Ablauf aus [docs/ENTWICKLUNG.md](../docs/ENTWICKLUNG.md#release-ablauf), dann in Partner Center *Packages → Replace*, unter *Notes for certification* die Änderungen aus dem Changelog eintragen und *Publish*.
