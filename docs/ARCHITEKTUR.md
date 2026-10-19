# Architektur

Stand: Version 0.4.0 + unveröffentlichte Änderungen ([Changelog](../CHANGELOG.md#unveröffentlicht)) · [Zurück zur Übersicht](../README.md)

1. [Machbarkeit](#1-machbarkeit)
2. [Aufbau](#2-aufbau)
3. [Datenhaltung](#3-datenhaltung)
4. [Lebenszyklus](#4-lebenszyklus)
5. [Keine Duplikate, kein Konflikt mit der Sitzungswiederherstellung](#5-keine-duplikate-kein-konflikt-mit-der-sitzungswiederherstellung)
6. [Wiedererkennung offener Tabs](#6-wiedererkennung-offener-tabs)
7. [Verhalten im Detail](#7-verhalten-im-detail)
8. [Bekannte Grenzen](#8-bekannte-grenzen)

---

## 1. Machbarkeit

### Hintergrund

Die früheren **Edge-Arbeitsbereiche (Workspaces)** konnten Tabs sperren. In den neuen Arbeitsbereichen (ab Edge 144) fehlt diese Funktion laut Nutzerberichten ([Microsoft Q&A, März 2026](https://learn.microsoft.com/en-us/answers/a/12673294)). Eine offizielle Ankündigung von Microsoft dazu war nicht zu finden. Tabi bildet das Verhalten mit den Mitteln nach, die eine Erweiterung hat.

### Was die Erweiterungs-Schnittstellen erlauben (Stand 19.10.2026)

| Frage | Ergebnis | Quelle |
|---|---|---|
| Unterstützt Edge `tabs`, `tabGroups`, `windows`, `storage`, `runtime`, `action`? | Ja. `tabGroups` gibt es für MV3 unter Windows/Linux/Mac. | [Microsoft Learn – Supported APIs](https://learn.microsoft.com/microsoft-edge/extensions/developer-guide/api-support) |
| Kann eine Erweiterung das **Schließen** eines Tabs verhindern? | **Nein.** Es gibt nur `tabs.onRemoved`, das *nach* dem Schließen ausgelöst wird, und keinen abbrechbaren Vorab-Hook. `beforeunload` einer Webseite zeigt nur einen bestätigbaren Dialog, bräuchte Host-Berechtigungen auf allen Seiten und würde die Navigation stören. | [chrome.tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [MDN beforeunload](https://developer.mozilla.org/docs/Web/API/Window/beforeunload_event) |
| Schließen durch Fensterschließen erkennbar? | Ja, über `removeInfo.isWindowClosing`. | [tabs.onRemoved](https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onRemoved) |
| Tab-ID wird ersetzt (Prerender)? | Ja, das meldet `tabs.onReplaced`. | [tabs.onReplaced](https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onReplaced) |
| Änderungen während eines Tab-Drags | Werden abgelehnt („Tabs cannot be edited right now“). Die Doku empfiehlt einen erneuten Versuch. | [chrome.tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs) |
| `tab.url` lesbar | Nur mit `"tabs"` oder Host-Berechtigungen | [chrome.tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs) |
| `storage.session` | Liegt im Arbeitsspeicher, überlebt einen Service-Worker-Neustart. Wird geleert bei Browserneustart, Update, Neuladen oder Deaktivieren. 10 MB. | [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) |
| `storage.sync` | 100 KB gesamt, 8 KB pro Eintrag, 512 Einträge, 120 Schreibvorgänge pro Minute. Ohne Sync verhält es sich wie `local`. | [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) |
| Start/Installation/Update unterscheiden | `runtime.onStartup`, `runtime.onInstalled` (`install` / `update` / `chrome_update`) | [chrome.runtime](https://developer.chrome.com/docs/extensions/reference/api/runtime) |
| Service-Worker-Lebensdauer | Wird bei Inaktivität beendet, globale Variablen gehen verloren | [SW-Lebenszyklus](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) |
| Fester Erweiterungs-ID bei Entwicklung | Über das Feld `key` im Manifest | [manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key) |
| Fensternamen | Gibt es in der `windows`-API nicht | [chrome.windows](https://developer.chrome.com/docs/extensions/reference/api/windows) |

**Konsequenz:** Tabi **öffnet geschützte Tabs sofort und kontrolliert wieder**. Ein wieder geöffneter Tab ist ein neuer Tab, ohne Verlauf und ohne Formularinhalte. Die Anmeldung bleibt erhalten, weil sie über die Cookies des Profils läuft.

## 2. Aufbau

```
manifest.json
background.js ─────────────── Service-Worker (ES-Modul), gesamte Logik
 ├─ lib/config.js             Vorlagenformat, Beispiel, Validierung, Migration 1→2, flattenConfig()
 └─ lib/sync.js               Zerlegen/Zusammensetzen/Prüfen der Vorlage für storage.sync
popup/                        Status, Profile an/aus, Schutz an/aus, Wiederherstellen
options/
 ├─ options.js                Editor (Profile, Fenster, Gruppen, Tabs), Dialoge, Sync-Karte
 └─ transfer.js               Favoriten-HTML und Linkliste lesen/schreiben
ui/common.css                 gemeinsame Farben (hell/dunkel), Edge-Gruppenfarben
```

Popup und Einstellungen sprechen ausschließlich per `chrome.runtime.sendMessage` mit dem Service-Worker:
`getStatus`, `setEnabled`, `restoreNow`, `getConfig`, `saveConfig {config, apply, bind}`, `switchProfile {profileId, closeOld}`, `openProfile {profileId}`, `closeProfile {profileId, closeTabs}`, `captureSession`, `setSync {enabled, deviceName, choice}`, `syncNow`, `getLog`, `clearLog`.
Nachrichten werden nur von der eigenen Erweiterung angenommen (`sender.id`).

### Grundentscheidungen

1. **Wiederöffnen statt Sperren**, weil eine echte Sperre technisch nicht möglich ist (siehe oben).
2. **Identität = Tab-ID**, solange der Tab lebt. Navigation, Logins und Weiterleitungen ändern nichts an der Zuordnung. URLs sind nur *Hinweise* für die Wiedererkennung nach einem Neustart.
3. **Kein Zustand nur im Arbeitsspeicher.** Die Laufzeitzuordnung liegt in `storage.session`, alles Dauerhafte in `storage.local`.
4. **Eine Warteschlange** (`enqueue`) für alles, was etwas verändert: Ereignisse, Aufbau, Befehle. Es läuft nie etwas parallel. Vor jedem Erzeugen wird geprüft, ob der Tab inzwischen existiert.
5. **Bündeln:** Geschlossene Pflicht-Tabs werden 500 ms gesammelt (höchstens 3 s), dann wird **einmal** repariert. So entsteht aus „Gruppe schließen“ genau eine Gruppe.
6. **Automatik öffnet nie Fenster.** Ist das Fenster weg oder wird es gerade geschlossen, passiert nichts. Tabi kann das Beenden von Edge deshalb nicht verhindern.
7. **Schleifenschutz:** pro Tab höchstens 5 automatische Wiederherstellungen in 60 s (danach wird der Tab pausiert), insgesamt höchstens 25 (danach stoppt die Automatik). „Wiederherstellen“ oder Aus/Ein hebt das auf. Fehler werden nicht automatisch wiederholt. Ausnahme ist die dokumentierte Drag-Sperre (3 Versuche).
8. **Minimale Berechtigungen:** `tabs`, `tabGroups`, `storage`. Keine Host-Berechtigungen, keine Content-Scripts, kein Netzwerk, kein Build-Schritt. InPrivate ist ausgeschlossen (`"incognito": "not_allowed"`).

## 3. Datenhaltung

| Speicher | Schlüssel | Inhalt | Lebensdauer |
|---|---|---|---|
| `storage.local` | `config` | Vorlage (Format 2, wie gespeichert) | dauerhaft |
| | `configRev` | Revision. `0` heißt unveränderte Beispielvorlage, die nie automatisch aufgebaut wird. Sonst Zeitstempel der Speicherung. | dauerhaft |
| | `activeProfiles` | auf diesem Gerät laufende Profile (Liste; bis 0.4.x `activeProfile`) | dauerhaft |
| | `enabled` | Schutz an/aus | dauerhaft |
| | `hints` | `tabs[key].lastUrl`, `groups[key].lastTitle` zur Wiedererkennung | dauerhaft |
| | `sync`, `syncState` | Geräte-ID und -name, Sync an/aus, letzter Up-/Download, Fehler, offene Auswahl | dauerhaft |
| `storage.session` | `rt` | Laufzeit: Schlüssel → Tab-/Gruppen-/Fenster-ID, `bootDone`, `startupPending`, `awaitingWindow`, ausstehende Reparaturen, Schleifenschutz, Protokoll (300 Einträge) | bis Browserneustart / Update |
| `storage.sync` | `tpl_meta`, `tpl_0…n` | Vorlage als JSON-Text in Stücken zu 2000 Zeichen, dazu Metadaten (Format, Revision, Hash, Länge, Gerät) | Konto-weit |

## 4. Lebenszyklus

| Situation | Erkennung | Verhalten |
|---|---|---|
| **Browserstart** | `runtime.onStartup` | Warten, bis die Sitzung ruhig ist (siehe 5). Neuere Vorlage aus dem Sync übernehmen, vorhandene Tabs zuordnen, fehlende Fenster, Gruppen und Tabs aller aktiven Profile ergänzen. Bei Schutz aus oder `configRev = 0` nur zuordnen. |
| **Installation** | `onInstalled: install` | Wie Browserstart. Gibt es keine Vorlage (auch nicht im Sync), öffnen sich die Einstellungen. |
| **Update / Neu laden** | `onInstalled: update` | `storage.session` ist leer. Offene Tabs werden zugeordnet, **nichts geöffnet**. |
| **Browser-Update** | `onInstalled: chrome_update` | ignoriert, `onStartup` übernimmt |
| **SW wacht auf** | kein Lebenszyklus-Ereignis, `bootDone = true` | nichts außer dem auslösenden Ereignis |
| **SW-Start ohne Zustand** (Erweiterung wieder eingeschaltet) | kein Ereignis, `bootDone = false`, Fallback nach 1,5 s | zuordnen, nichts öffnen |
| **SW stirbt mitten im Aufbau** | `startupPending = true` | Aufbau beim nächsten Aufwachen wiederholen (idempotent) |
| **Start ohne Fenster** (Startleistungs-Boost) | keine normalen Fenster nach der Ruhephase | `awaitingWindow`, Aufbau beim ersten `windows.onCreated` |
| **Alle Fenster zu, Edge läuft weiter** | `windows.onRemoved`, 0 Fenster | das nächste Fenster gilt als Start |

## 5. Keine Duplikate, kein Konflikt mit der Sitzungswiederherstellung

1. **Ereignisgesteuertes Warten statt fester Wartezeit:** Nach dem Start beobachtet Tabi Tab-, Gruppen- und Fenster-Ereignisse und vergleicht alle 300 ms einen Fingerabdruck aller Fenster, Tabs und Gruppen. Weiter geht es erst nach **1,5 s ohne Änderung** (mindestens 1,2 s, höchstens 20 s).
2. **Erst zuordnen, dann ergänzen:** `adoptExisting()` ordnet vorhandene Tabs zu. `reconcile()` erzeugt nur, was danach noch fehlt.
3. **Idempotent:** Jeder Schritt prüft den Ist-Zustand. Ein zweiter Durchlauf erzeugt nichts.
4. **Serialisiert:** Aufbau, Reparaturen und Befehle laufen nacheinander.
5. **`bootDone` pro Browsersitzung** in `storage.session`. Das bloße Aufwachen des Service-Workers baut nichts auf.
6. **Kein leerer Hilfs-Tab:** Neue Fenster werden direkt mit den URLs erzeugt.

## 6. Wiedererkennung offener Tabs

Tab- und Gruppen-IDs ändern sich bei jedem Browserstart. Tabi ordnet konservativ zu:

1. **Gruppe:** Der Titel muss dem Vorlagentitel oder dem zuletzt beobachteten Titel entsprechen (ohne Groß-/Kleinschreibung), **und** mindestens ein Tab der Gruppe muss zur Vorlage passen. Der gleiche Name allein reicht nicht, damit eigene, zufällig gleichnamige Gruppen unberührt bleiben. Bei mehreren Kandidaten gewinnt der mit den meisten URL-Treffern, bei Gleichstand der mit passender Farbe.
2. **Tabs nur innerhalb zugeordneter Gruppen.** Die Stufen in dieser Reihenfolge:
   1. exakt gleiche URL (Start-URL oder zuletzt bekannte URL)
   2. gleich bis auf `#Anker` oder abschließenden Slash
   3. gleiche Website (Origin)
3. Die Stufen 2 und 3 gelten **nur**, wenn die Laufzeitzuordnung fehlt: nach Browserstart, Update, Reaktivierung, oder wenn auf dem Gerät noch kein Pflicht-Tab bekannt ist. Im laufenden Betrieb, etwa bei „Wiederherstellen“ oder „Speichern“, ist ein unbekannter Tab ein eigener Tab. Er wird höchstens bei exakt gleicher URL übernommen.
4. Tabs **außerhalb** zugeordneter Gruppen werden nie übernommen.
5. Gleiche URLs in verschiedenen Gruppen sind kein Problem, jede Gruppe betrachtet nur ihre eigenen Tabs.
6. **Direkte Verknüpfung:** „Aktuelle Sitzung übernehmen“ und „Aus offenen Tabs“ übergeben beim Speichern die konkreten Tab-, Gruppen- und Fenster-IDs (`bind`). Dafür ist keine Heuristik nötig.

## 7. Verhalten im Detail

### Reparatur nach dem Schließen
- `tabs.onRemoved` mit `isWindowClosing` → nichts.
- Bei einem verwalteten, **geschützten** Tab merkt sich Tabi den Schlüssel in `rt.pending` und repariert nach dem Bündeln.
- Reparatur: Existiert die Gruppe noch, wird der Tab an die Sollposition zwischen den benachbarten Pflicht-Tabs gesetzt. Fehlt sie, wird sie einmal neu aufgebaut (Name, Farbe, eingeklappt laut Vorlage) und zwischen die benachbarten Vorlagengruppen gesetzt.
- Ist das Fenster der Vorlage nicht offen, wird nichts repariert.

### Verschieben und Herausziehen
- Ein Pflicht-Tab bleibt verwaltet, egal wohin er verschoben wird. Verschieben löst nichts aus.
- Das Popup zeigt „außerhalb der Gruppe“. Nur „Vorlage wiederherstellen“ holt solche Tabs zurück.
- Wird ein verschobener Tab einzeln geschlossen, öffnet Tabi ihn in seiner Vorlagengruppe neu. Wird sein Fenster geschlossen, passiert nichts.

### Mehrere aktive Profile (`setActiveProfiles`)
Mehrere Profile können gleichzeitig laufen. `flattenConfig(config, activeProfiles)` vereinigt sie zu **einer** Nachschlagetabelle (`flat`). Das ist möglich, weil IDs über alle Profile eindeutig sind. Jeder Eintrag kennt sein `profileId`. Fenster, Gruppen und Tabs der Profile sind getrennt, deshalb läuft jedes Profil in eigenen Fenstern. Lebenszyklus, Reparatur und Schleifenschutz behandeln alle aktiven Profile gemeinsam.

Alle Profilaktionen laufen über `setActiveProfiles(nextIds, closeRemoved)`:

| Nachricht | Bedeutung |
|---|---|
| `openProfile {profileId}` | aktive Profile + dieses |
| `closeProfile {profileId, closeTabs}` | aktive Profile − dieses |
| `switchProfile {profileId, closeOld}` | nur dieses |

Ablauf:
1. Mindestens ein Profil muss übrig bleiben, sonst wird die Aktion abgelehnt. Die Reihenfolge folgt der Vorlage.
2. Tab-IDs der zu beendenden Profile merken, dann `activeProfiles` speichern, `flat` neu bilden und die Zuordnungen beendeter Profile lösen. Ihre Tabs bleiben vorerst offen.
3. Hinzugekommene Profile zuordnen, wobei für ihre Gruppen die unscharfe Wiedererkennung erlaubt ist (`fuzzyKeys`). Dann nur **ihre** Fenster, Gruppen und Tabs aufbauen (`reconcile` mit `onlyKeys`).
4. Optional die Pflicht-Tabs beendeter Profile schließen, außer denen, die ein aktives Profil übernommen hat. Erst nach dem Aufbau, und nie alle Tabs aller Fenster: Bliebe nichts übrig, bleibt ein Tab offen (`keptOpen`).

### Sync
- **Hochladen** bei jedem Speichern, in **einem** `set()`-Aufruf. Überzählige alte Stücke werden danach entfernt.
- **Empfangen:** `storage.onChanged` (Bereich `sync`, Schlüssel `tpl_meta`). Das eigene Echo wird an Geräte-ID und Revision erkannt.
- **Prüfung:** Format, Vollständigkeit (Hash, Länge) und Validität. Unvollständige Daten werden abgewartet.
- **Regeln:**
  - gleicher Inhalt → nur die Revision angleichen
  - Gerät noch nie synchronisiert und eigene Vorlage weicht ab → nachfragen (`pendingChoice`), bis dahin weder hoch- noch herunterladen
  - lokal neuer → hochladen
  - Sync neuer → übernehmen. Namen und Farben offener Gruppen werden angepasst, neue Tabs **nicht** automatisch geöffnet. Ausnahme: Ein Gerät ohne eigene Vorlage baut sie auf.
- Ein zu großer Upload (über ca. 90 KB) wird nicht versucht, die Vorlage bleibt lokal. Es erscheint eine Meldung.

## 8. Bekannte Grenzen

- **Keine echte Sperre.** Ein wieder geöffneter Tab startet auf der Start-URL, ohne Zurück-Verlauf, Formularinhalte oder `sessionStorage`.
- **Position „best effort“.** Wie Chromium Tabs an Gruppenrändern einsortiert, ist nicht vollständig dokumentiert. In Randfällen mit eigenen Tabs in der Gruppe kann die Position um eins abweichen.
- **Letzter Tab eines Fensters:** Edge schließt mit ihm das Fenster. Tabi behandelt das wie „Fenster geschlossen“ und öffnet nichts. Dasselbe gilt, wenn zwischen dem Schließen des Tabs und dem Schließen des Fensters weniger als 0,5 s liegen.
- **Sehr langsame Sitzungswiederherstellung** (über 20 s): Dann kann Tabi vorher aufbauen, und es entstehen Duplikate. Unwahrscheinlich, aber nicht ausgeschlossen.
- **Wiedererkennung ist heuristisch.** Eine in Edge umbenannte Gruppe wird nicht erkannt, wenn Tabi die Umbenennung nicht beobachtet hat. Stufe 3 (gleiche Website) kann nach einem Neustart einen eigenen Tab derselben Website in einer Vorlagengruppe übernehmen, wenn der eigentliche Pflicht-Tab fehlt.
- **Update/Reaktivieren** öffnet bewusst nichts. Fehlendes kommt beim nächsten Start oder über „Wiederherstellen“.
- **Sync:**
  - Die zuletzt gespeicherte Fassung gewinnt. Gleichzeitiges Bearbeiten auf zwei Geräten verliert die frühere Speicherung. Falsch gehende Uhren können die Reihenfolge verfälschen.
  - Ob Edge `storage.sync` für **entpackte** Erweiterungen überträgt, ist nicht dokumentiert.
  - Geräte mit Tabi 0.3.x können Format 2 nicht lesen.
- **Nicht unterstützt:** InPrivate, die neuen Edge-Arbeitsbereiche (Workspaces), Edge auf Android.
- Startleistungs-Boost und Hintergrundmodus werden unterstützt, sind aber nur in der Simulation getestet.
- Die Berechtigung `tabs` erscheint in Edge als „Browserverlauf lesen“. Tabi speichert URLs nur lokal ([Datenschutz](DATENSCHUTZ.md)).
