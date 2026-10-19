# Entwicklung & Release

Stand: Version 0.5.0 · [Zurück zur Übersicht](../README.md)

- [Projektstruktur](#projektstruktur)
- [Entwickeln](#entwickeln)
- [Fehlersuche](#fehlersuche)
- [Versionierung](#versionierung)
- [Dokumentationsregeln](#dokumentationsregeln)
- [Release-Ablauf](#release-ablauf)
- [Veröffentlichung im Store](#veröffentlichung-im-store)

---

## Projektstruktur

```
Tabi/
├── manifest.json            Manifest V3 (tabs, tabGroups, storage), Version; Name/Beschreibung über __MSG_…__
├── _locales/de, _locales/en Name, Kurzbeschreibung, Symbol-Tooltip (Standard: de)
├── background.js            Service-Worker: Lebenszyklus, Zuordnung, Abgleich, Reparatur,
│                            Schleifenschutz, Profile, Sync, Nachrichten
├── lib/
│   ├── config.js            Vorlagenformat 2, Beispiel, Validierung, Migration, flattenConfig()
│   └── sync.js              Vorlage für storage.sync zerlegen/prüfen
├── popup/                   popup.html/.css/.js – Status, Profile an/aus, Wiederherstellen
├── options/
│   ├── options.html/.css    Einstellungsseite
│   ├── options.js           visueller Editor, Profile, Dialoge, Sync-Karte, Import/Export
│   └── transfer.js          Favoriten-HTML und Linkliste lesen/schreiben
├── ui/common.css            gemeinsame Farben (hell/dunkel), Edge-Gruppenfarben
├── icons/                   16/32/48/128 px
├── tests/                   nicht Teil des Pakets
│   ├── mock-chrome.js       In-Memory-Nachbildung von tabs, tabGroups, windows, storage (inkl. Sync)
│   ├── run.html / run.js    Logiktests gegen den echten background.js
│   ├── ui.html, popup.html  Vorschauseiten
│   └── serve.ps1            Mini-Webserver (nur localhost)
├── tools/
│   ├── build-zip.ps1        Paket dist/tabi-<version>.zip (ohne Tests, ohne "key")
│   ├── release.ps1          Version prüfen, Paket bauen, Tag + GitHub-Release
│   ├── store-assets.ps1     Store-Grafiken per Headless-Edge aus store/src rendern
│   └── sync-id-aktivieren.ps1  fester Schlüssel für Sync bei entpackten Installationen
├── store/
│   ├── EINREICHUNG.md       alle Texte und Angaben für Partner Center (Edge-Add-ons)
│   ├── src/                 HTML-Vorlagen für Logo, Kacheln, Screenshot-Rahmen
│   └── assets/              erzeugte PNGs (Logo 300², Kacheln 440×280 / 1400×560, Screenshots 1280×800)
├── docs/                    Dokumentation (deutsch) + PRIVACY.md (englisch, für den Store)
├── .github/ISSUE_TEMPLATE/  Vorlagen für Fehlermeldungen und Wünsche
├── CHANGELOG.md             Patchnotes
└── README.md
```

**Prinzipien:** Vanilla JavaScript (ES-Module), HTML und CSS, **kein Build-Schritt**, keine Abhängigkeiten, kein Netzwerk, keine Telemetrie. Kommentare und Oberfläche auf Deutsch.

**PowerShell-Skripte** (`*.ps1`) werden als **UTF-8 mit BOM** gespeichert, sonst liest Windows PowerShell 5.1 Umlaute und Pfeile falsch. Typografische Anführungszeichen („ “) nie in Strings mit `"…"` verwenden, weil PowerShell sie als String-Grenzen wertet. Stattdessen `'…'` oder Here-Strings `@'…'@`.

## Entwickeln

1. Repository klonen und in Edge als entpackte Erweiterung laden ([Bedienung → Installation](BEDIENUNG.md#installation)).
2. Nach einer Codeänderung in `edge://extensions` bei Tabi auf ⟳ klicken. Das zählt als *Update*: Offene Tabs werden übernommen, nichts wird geöffnet. Einstellungs- und Popup-Seite reichen neu zu öffnen.
3. Logiktests vor jedem Commit:
   ```bash
   powershell -NoProfile -ExecutionPolicy Bypass -File tests\serve.ps1
   ```
   Dann `http://localhost:8765/tests/run.html` öffnen und auf `PASS` warten ([Testplan](TESTPLAN.md)).
4. **Neue Logik bekommt einen Test** in `tests/run.js`. Fehlt der Simulation eine API, wird sie in `tests/mock-chrome.js` ergänzt.

**Regeln im Code**
- Alles, was Tabs, Gruppen oder Fenster verändert, läuft über `enqueue()`.
- Der Zustand liegt in `rt` und wird nach jedem Job in `storage.session` geschrieben. Globale Variablen sind nur Zwischenspeicher.
- Listener werden synchron auf oberster Ebene registriert (MV3).
- Automatische Reparaturen öffnen nie Fenster und schließen nie Tabs.
- Fremde Tabs und Gruppen werden nicht verändert. Ausnahme: ausdrückliche Nutzeraktionen wie „Wiederherstellen“ oder ein Profil mit „schließen“ beenden, und auch dann nur verwaltete Tabs und nie das letzte Fenster.

## Fehlersuche

- **Protokoll ohne DevTools:** Einstellungen → Reiter **Protokoll** zeigt die letzten 300 Einträge, neueste zuerst.
- **Service-Worker-Konsole:** `edge://extensions` → Tabi → **„Service Worker“**. Alle Meldungen beginnen mit `[Tabi]`. Solange diese DevTools offen sind, beendet Edge den Worker nicht.
- **Zustand ansehen** (in der Worker-Konsole):
  ```js
  await chrome.storage.session.get('rt')   // Laufzeitzuordnung, bootDone, Schleifenschutz
  await chrome.storage.local.get(null)     // config, configRev, activeProfiles, enabled, hints, sync
  await chrome.storage.sync.get(null)      // tpl_meta, tpl_0 …
  ```
- **Worker gezielt beenden:** DevTools schließen → `edge://serviceworker-internals` → Eintrag `chrome-extension://<ID>/` → **Stop**.
- **Zurücksetzen:** in der Worker-Konsole `await chrome.storage.local.clear(); await chrome.storage.session.clear();`, dann ⟳. Vorher exportieren!
- **Typische Meldungen:**

  | Meldung | Bedeutung |
  |---|---|
  | „Startphase ruhig nach … ms“ | Die Sitzungswiederherstellung ist abgeschlossen, Tabi baut auf. |
  | „Übernahme (…): x Gruppe(n), y Tab(s) neu zugeordnet“ | Wiedererkennung nach einem Start, Update oder Wechsel |
  | „… mit seinem Fenster geschlossen – keine sofortige Wiederherstellung“ | gewollt, Fensterschließen wird nicht rückgängig gemacht |
  | „Gruppe „X“ existiert, enthält aber keinen passenden Tab“ | Eine eigene gleichnamige Gruppe bleibt unberührt. |
  | „Schleifenschutz …“ | Ein Tab wurde zu oft geschlossen, die Automatik pausiert. |

## Versionierung

- [Semantic Versioning](https://semver.org/lang/de/), Phase **0.x**: Die zweite Stelle steigt bei neuen Funktionen oder Formatänderungen, die dritte bei Fehlerbehebungen.
- Die Version steht **nur** in `manifest.json` (`"version"`). Badge in der README, Changelog und Dokumente beziehen sich darauf.
- Das **Vorlagenformat** hat eine eigene Nummer (`version` in der Vorlage, aktuell 2). Ändert es sich:
  - Migration in `migrateConfig()` ergänzen und einen Test dafür schreiben
  - `docs/VORLAGENFORMAT.md` aktualisieren
  - im Changelog unter **„Achtung“** vermerken (Rückweg und Sync mit älteren Versionen)
- Git-Tags heißen `v<version>`, z. B. `v0.4.0`.

## Dokumentationsregeln

Jede Änderung wird **im selben Commit** dokumentiert:

| Änderung | Zu aktualisieren |
|---|---|
| jede für Nutzer sichtbare Änderung | `CHANGELOG.md` → Abschnitt **[Unveröffentlicht]** (Neu/Geändert/Behoben/Entfernt/Sicherheit/Achtung) |
| Bedienung, Oberfläche, Verhalten | `docs/BEDIENUNG.md` |
| Vorlagenformat | `docs/VORLAGENFORMAT.md` und „Achtung“ im Changelog |
| Logik, Speicher, Lebenszyklus, Grenzen | `docs/ARCHITEKTUR.md` |
| neue oder geänderte Tests | `docs/TESTPLAN.md` (Tabelle und Anzahl der Prüfungen) |
| neue Daten oder Berechtigungen | `docs/DATENSCHUTZ.md`, README-Funktionstabelle |
| Werkzeuge, Ablauf | `docs/ENTWICKLUNG.md` |

**Patchnotes** schreiben, wie ein Nutzer es liest: *was* sich ändert und *was zu tun ist*, nicht wie es intern gelöst wurde. Fehlerbehebungen beschreiben das Symptom („… konnte … passieren“).

## Release-Ablauf

1. **Changelog:** Abschnitt `[Unveröffentlicht]` in `## [x.y.z] – JJJJ-MM-TT` umbenennen, einen neuen leeren `[Unveröffentlicht]` darüber anlegen, die Links unten ergänzen.
2. **Version** in `manifest.json` setzen. Die Stand-Angaben in `docs/*.md` und das Badge in `README.md` anpassen.
3. **Tests:** `tests/run.html` muss `PASS` zeigen. Die Anzahl in `docs/TESTPLAN.md` eintragen. Wichtige Fälle in Edge prüfen und im Testprotokoll vermerken.
4. **Commit** mit der Nachricht `Release x.y.z`.
5. **Veröffentlichen:**
   ```bash
   powershell -ExecutionPolicy Bypass -File tools\release.ps1
   ```
   Das Skript prüft:
   - stimmt die Version überein?
   - gibt es den Changelog-Abschnitt?
   - ist das Arbeitsverzeichnis sauber?

   Danach baut es `dist/tabi-x.y.z.zip`, legt den Tag `vx.y.z` an, pusht ihn und erstellt mit der GitHub-CLI (`gh`) das Release, mit den Patchnotes aus dem Changelog und dem ZIP. Mit `-DryRun` wird nur angezeigt, was passieren würde.
6. Ändert sich die Oberfläche sichtbar: die Store-Grafiken neu erzeugen und die Bilder in `store/assets/` prüfen.
   ```bash
   powershell -ExecutionPolicy Bypass -File tools\store-assets.ps1
   ```
7. Die Store-Version hochladen (siehe unten).

## Veröffentlichung im Store

**Edge-Add-ons:** Die vollständige Anleitung mit allen Texten zum Kopieren steht in [store/EINREICHUNG.md](../store/EINREICHUNG.md). Dazu gehören Datenschutz-Angaben, Begründungen der Berechtigungen, Beschreibungen auf Deutsch und Englisch, Suchbegriffe und Hinweise für die Prüfer.

| | Microsoft Edge-Add-ons | Chrome Web Store |
|---|---|---|
| Konto | kostenlos im [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/) | einmalig 5 US-$ im [Developer Dashboard](https://chrome.google.com/webstore/devconsole) |
| Paket | `dist/tabi-<version>.zip` (`tools/build-zip.ps1` entfernt `key`, die Stores lehnen ihn ab) | dasselbe |
| Grafiken | `store/assets/`: Logo 300×300 (Pflicht), Kacheln 440×280 / 1400×560, Screenshots 1280×800 (max. 6) | Kachel 440×280, Screenshots 1280×800 (max. 5) |
| Datenschutz | URL `https://github.com/ChriisJ/Tabi/blob/main/docs/PRIVACY.md` | dito |
| Prüfung | laut Microsoft bis zu 7 Werktage | meist wenige Tage |

**Store-Texte und `_locales`:** Name und Kurzbeschreibung (max. 132 Zeichen) liest der Store aus `_locales/*/messages.json`. Sie lassen sich dort nur ändern, indem man ein neues Paket hochlädt. Jede Sprache in `_locales` braucht im Partner Center eine eigene Beschreibung und ein eigenes Logo.

Hinweise:
- Die Store-Version hat eine **eigene, feste ID**, die sich von der entpackten unterscheidet. Nutzer exportieren vorher und importieren danach.
- Mit der Store-Version funktioniert der Sync ohne `tools/sync-id-aktivieren.ps1`.
- Für jedes Store-Update die Version erhöhen (Release-Ablauf oben).
