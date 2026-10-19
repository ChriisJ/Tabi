# Changelog

Alle wesentlichen Änderungen an Tabi stehen hier. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/). In der Phase **0.x** können sich Verhalten und Vorlagenformat noch ändern. Solche Änderungen stehen dann unter **„Achtung“**.

Kategorien: **Neu** · **Geändert** · **Behoben** · **Entfernt** · **Sicherheit** · **Achtung** (Handlungsbedarf beim Update)

## [Unveröffentlicht]

### Neu
- **Mehrere Profile gleichzeitig:** Profile können parallel laufen, jedes in seinen **eigenen Fenstern** und jedes geschützt, z. B. „Standard“ und „Dev“ nebeneinander.
  - **Popup:** Jedes Profil hat einen Schalter. Einschalten öffnet das Profil zusätzlich. Ausschalten beendet es, wahlweise mit Schließen seiner Pflicht-Tabs. „nur dieses“ beendet alle anderen.
  - **Editor:** „Zusätzlich öffnen“, „Nur dieses aktivieren“ und „Beenden“ im Profilkopf. Alle laufenden Profile sind in der Profilleiste mit ● markiert.
  - Das Popup gruppiert die Fenster nach Profil, wenn mehrere laufen.
- Beim Öffnen eines Profils werden dessen bereits offene Gruppen wiedererkannt statt doppelt geöffnet.

### Geändert
- Statt eines aktiven Profils speichert jedes Gerät jetzt eine **Liste aktiver Profile** (`activeProfiles`). Die Einstellung aus 0.4.x wird automatisch übernommen.
- Ein laufendes Profil kann nicht gelöscht werden. Erst beenden.

### Sicherheit
- Mindestens ein Profil bleibt immer aktiv. Beim Beenden eines Profils schließt Tabi nie den letzten Tab des letzten Fensters, damit sich Edge nicht beendet. Es bleibt dann ein Tab offen, und Tabi meldet das.

## [0.4.0] – 2026-10-19

### Neu
- **Profile:** mehrere Vorlagen mit eigenen Fenstern, Gruppen und Tabs. Pro Gerät ist ein Profil aktiv, gespeichert nur lokal.
  - Wechseln über das Popup („Profil“) oder im Editor („Dieses Profil aktivieren“). Optional werden dabei die Pflicht-Tabs des alten Profils geschlossen, eigene Tabs bleiben immer offen.
  - Im Editor: Profilleiste zum Anlegen, Umbenennen, Duplizieren und Löschen.
  - „Aktuelle Sitzung übernehmen“ kann direkt ein **neues Profil** anlegen.
- **Schutz pro Tab:** 🔒 *geschützt* (wird wieder geöffnet) oder 🔓 *frei* (öffnet sich beim Start, darf aber geschlossen bleiben). Mit „Alle schützen/freigeben“ für eine ganze Gruppe.
- **Export** über ein Menü: alle Profile (JSON), ein Profil (JSON), ein Profil als **Edge-Favoritendatei (HTML)** oder als **Linkliste (TXT)**.
- **Import** mit automatischer Formaterkennung: Tabi-JSON, Favoriten-HTML aus Edge/Chrome (Ordner werden zu Gruppen, einzeln abwählbar), Linkliste. Ziel ist ein neues Profil, oder das aktuelle wird ergänzt bzw. ersetzt. Warnung ab 120 Tabs.
- Popup zeigt „frei“ geschlossene Tabs separat und zählt sie nicht als fehlend.
- `tools/build-zip.ps1` baut ein store-taugliches Paket ohne Tests und ohne `key`.
- Vorschauseiten `tests/ui.html` und `tests/popup.html` gegen die simulierte Browser-API.
- Erste Veröffentlichung auf GitHub unter **MIT-Lizenz**, mit Dokumentation in `docs/`, Issue-Vorlagen und `tools/release.ps1`.

### Geändert
- **Vorlagenformat 2** (`profiles` statt `windows`). Gruppennamen müssen nur noch **je Profil** eindeutig sein, IDs über alle Profile.
- Hinweise zur Wiedererkennung (zuletzt gesehene URLs) bleiben auch für inaktive Profile erhalten.

### Behoben
- Beim Profilwechsel konnte eine **eigene, zufällig gleichnamige Gruppe** übernommen und mit Vorlagen-Tabs befüllt werden. Eine Gruppe wird jetzt nur übernommen, wenn mindestens ein Tab darin zur Vorlage passt.
- Freie Tabs zeigen im Editor jetzt deutlich sichtbar „frei“.

### Achtung
- Vorlagen im Format 1 werden automatisch in ein Profil „Standard“ übernommen. Das Zurückwechseln auf 0.3.x liest Format 2 **nicht**. Vor dem Update exportieren, wenn ein Rückweg nötig sein könnte.
- Ein Gerät mit Tabi 0.3.x kann per Sync empfangene Vorlagen im Format 2 nicht lesen und meldet einen Fehler. **Alle Geräte auf 0.4.0 aktualisieren.**

## [0.3.0] – 2026-10-19

### Neu
- **Sync zwischen Geräten** über `chrome.storage.sync`. Synchronisiert wird nur die Vorlage, Tab-Zuordnungen und „Schutz an/aus“ bleiben pro Gerät.
  - Die Vorlage wird in Teile unter 8 KB zerlegt und per Hash auf Vollständigkeit geprüft. Grenze ca. 90 KB.
  - Konfliktregel: Die zuletzt gespeicherte Fassung gilt. Bei erstmaligem Sync mit abweichender eigener Vorlage fragt Tabi nach und überschreibt nichts ungefragt.
  - Ein Gerät ohne eigene Vorlage baut die Vorlage aus dem Sync automatisch auf.
  - Sync-Karte in den Einstellungen: Ein/Aus, Gerätename, Status, „Jetzt synchronisieren“.
- `tools/sync-id-aktivieren.ps1`: fester Erweiterungsschlüssel für die gleiche ID auf allen Geräten (Voraussetzung für Sync bei entpackten Erweiterungen).
- Hinweisbanner für „noch keine eigene Vorlage“, Sync-Entscheidungen und Änderungen von anderen Geräten während ungespeicherter Bearbeitung.

### Geändert
- Die eingebaute **Beispielvorlage wird nicht mehr automatisch aufgebaut.** Nach der Installation öffnen sich stattdessen die Einstellungen.
- Wiedererkennung mit unscharfen Kriterien (gleiche Website) ist auch erlaubt, wenn Tabi auf dem Gerät noch keinen Pflicht-Tab kennt, z. B. nach einer Neuinstallation mit Import.

### Behoben
- Das Hinweisbanner wurde regelmäßig neu gezeichnet, ein Klick in diesem Moment ging verloren.

### Achtung
- Mit `tools/sync-id-aktivieren.ps1` ändert sich die Erweiterungs-ID **einmalig**, die gespeicherte Vorlage ist danach nicht mehr erreichbar. **Vorher exportieren.**

## [0.2.0] – 2026-10-19

### Neu
- **Visueller Editor** statt reiner JSON-Bearbeitung:
  - Fensterkarten, Gruppen in Edge-Farben, Farbwahl, auf-/zugeklappt.
  - Drag & Drop für Tabs und Gruppen, Alt+↑/↓.
  - Live-Status je Tab: offen, nicht offen, außerhalb der Gruppe.
  - Validierung mit verständlichen Meldungen und Sprung zur Stelle, Rückgängig (Strg+Z).
- **„Aktuelle Sitzung übernehmen“:** Fenster und Gruppen aus Edge als Vorlage. Offene Tabs werden direkt verknüpft, nichts öffnet sich doppelt. Ungruppierte Tabs optional als Gruppe „Sonstiges“.
- **„URLs einfügen“** (`https://` wird ergänzt), **„Aus offenen Tabs“**, Links per Drag & Drop auf Gruppen ziehen.
- Popup: Knopf „Sitzung als Standard …“.

### Behoben
- Beim Speichern konnte ein nicht verwalteter Tab derselben Website als neuer Pflicht-Tab übernommen werden. Zur Laufzeit zählt jetzt nur eine exakt gleiche URL.

## [0.1.0] – 2026-10-19

### Neu
- Erste Version: Vorlage aus Fenstern, nativen Registerkartengruppen und Pflicht-Tabs für Edge (Manifest V3).
- Aufbau beim Browserstart mit Rücksicht auf die Sitzungswiederherstellung: Tabi wartet, bis die Ereignisse zur Ruhe kommen, übernimmt vorhandene Tabs und ergänzt nur Fehlendes.
- Automatisches Wiederöffnen geschlossener Pflicht-Tabs im Hintergrund, in Gruppe und Position. Mehrere Schließvorgänge werden gebündelt („Gruppe schließen“ ergibt eine Gruppe).
- Fenster schließen oder Edge beenden löst keine Wiederherstellung aus.
- Identität eines Pflicht-Tabs über die Tab-ID, Navigation und Logins sind frei. Konservative Wiedererkennung nach Neustarts.
- Getrennte Behandlung von Installation, Update, Browserstart und Service-Worker-Neustart. Der Zustand liegt in `storage.session` und `storage.local`.
- Schleifenschutz: pro Tab höchstens 5 Wiederherstellungen in 60 s, insgesamt höchstens 25.
- Popup mit Status, Schutz an/aus und „Vorlage jetzt wiederherstellen“. Einstellungen mit JSON-Editor, Validierung, Export/Import und Debug-Protokoll.
- Logiktests gegen eine simulierte chrome-API (`tests/run.html`).

[Unveröffentlicht]: https://github.com/ChriisJ/Tabi/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/ChriisJ/Tabi/releases/tag/v0.4.0
[0.3.0]: https://github.com/ChriisJ/Tabi/blob/main/CHANGELOG.md#030--2026-10-19
[0.2.0]: https://github.com/ChriisJ/Tabi/blob/main/CHANGELOG.md#020--2026-10-19
[0.1.0]: https://github.com/ChriisJ/Tabi/blob/main/CHANGELOG.md#010--2026-10-19
