# Testplan

Stand: Version 0.4.0 · [Zurück zur Übersicht](../README.md)

## Kennzeichnung

- **[S]** – automatisiert gegen eine **simulierte** chrome-API geprüft (`tests/run.html`). Bei 0.4.0 bestehen alle **106 Prüfungen**. Die Simulation bildet das Gruppen- und Positionsverhalten von Chromium nur **näherungsweise** nach.
- **[E]** – in echtem Edge zu prüfen. **Bisher in echtem Edge nicht durchgeführt.** Ergebnisse bitte unten in die [Testprotokolle](#testprotokolle) eintragen.

## Automatisierte Logiktests

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tests\serve.ps1
```

Danach im Browser öffnen:
- `http://localhost:8765/tests/run.html`: alle Logiktests. Dauer ca. 1,5 Minuten, der Titel zeigt am Ende `PASS` oder `FAIL n`. **Der Tab muss im Vordergrund bleiben**, sonst bremst der Browser die Timer.
- `http://localhost:8765/tests/ui.html`: Einstellungsseite mit simulierter Sitzung (zwei Profile, ein freier Tab, Sync-Speicher). `#fresh` simuliert ein Gerät ohne Vorlage.
- `http://localhost:8765/tests/popup.html`: Popup mit zwei Profilen.

Ist Port 8765 belegt, `-Port 8766` anhängen.

**Abgedeckt:** Validierung, Installation, Mehrfach-Wiederherstellen, Schließen einzeln, mehrfach, als Gruppe, letzter Tab, fremder Tab, Fenster, Edge-Ende, Neustart mit und ohne bzw. mit verspäteter Sitzungswiederherstellung, Start ohne Fenster, SW-Neustart, Update, Navigation, Verschieben, Schutz aus/an, Schleifenschutz, Konfigurationsänderungen, gleiche URLs, Sitzungsübernahme mit Verknüpfung, Sync (Kodierung, neues Gerät, Empfang, Upload, Konflikt), Profile, freie Tabs, Favoriten-HTML, Linkliste.

## Manuelle Tests in Edge

**Vorbereitung:** Tabi laden und eine Vorlage speichern, z. B. im Editor die Beispielvorlage mit **„Als Standard speichern“**. Popup anheften. Das Debug-Protokoll (Einstellungen → Protokoll) oder die Service-Worker-Konsole offen halten.

| # | Test | Schritte | Soll-Ergebnis | |
|---|---|---|---|---|
| 1 | Frischer Browserstart | Starteinstellung „Neue Registerkarte“. Edge komplett beenden (auch im Tray), dann starten. | Nach ca. 2–3 s ist die Vorlage aufgebaut: das erste Vorlagenfenster im Startfenster (Neuer-Tab bleibt), weitere Fenster zusätzlich. Keine leeren Zusatz-Tabs, das Popup ist grün. | [S] [E] |
| 2 | Start mit Sitzungswiederherstellung | Starteinstellung „vorherige Sitzung“. Einen Pflicht-Tab auf eine Unterseite navigieren, Edge beenden, starten. | Nichts doppelt, die Unterseite bleibt. Protokoll: „Übernahme …“, „0 Tab(s) geöffnet“. | [S] [E] |
| 3 | Einzelnen Pflicht-Tab schließen | portal-2 schließen | Kommt nach ca. 0,5 s zwischen portal-1 und portal-3 zurück, **im Hintergrund**. | [S] [E] |
| 4 | Mehrere schnell schließen | portal-1, portal-3, privat-2 kurz nacheinander mit Strg+W | Alle kommen genau einmal zurück. | [S] [E] |
| 5 | Ganze Gruppe schließen | Rechtsklick „Gaming“ → Gruppe schließen | **Eine** Gruppe „Gaming“, blau, mit allen geschützten Tabs in Reihenfolge, vor „Recherche“. | [S] [E] |
| 6 | Letzten Pflicht-Tab einer Gruppe | Im Fenster „Weitere Portale“ einen eigenen Tab öffnen, dann tool-1 schließen | Gruppe „Tools“ (orange) wird neu erstellt, der eigene Tab bleibt. *Variante:* Ist tool-1 der einzige Tab im Fenster, gilt das als Fenster schließen (siehe 8). | [S] [E] |
| 7 | Nicht verwalteten Tab schließen | Eigenen Tab in „Gaming“ ziehen, dann schließen | Nichts passiert. | [S] [E] |
| 8 | Fenster schließen | Fenster „Daily“ über X | Nichts wird wieder geöffnet, das Popup meldet fehlende Tabs. „Wiederherstellen“ baut das Fenster neu auf. | [S] [E] |
| 9 | Edge beenden und starten | Menü → „Microsoft Edge schließen“, dann starten | Edge beendet sich normal. Danach wie Test 1 bzw. 2. | [S] [E] |
| 10 | Service-Worker neu starten | Worker stoppen ([Fehlersuche](ENTWICKLUNG.md#fehlersuche)), Popup öffnen, portal-2 schließen | Beim Aufwachen öffnet sich nichts. portal-2 kommt zurück. | [S] [E] |
| 11 | Navigation und Login | In portal-1 Unterseite und Login-Weiterleitung, danach „Wiederherstellen“ | Nichts wird blockiert oder zurückgesetzt, kein zweiter portal-1. | [S] [E] |
| 12 | Tab in anderes Fenster ziehen | portal-2 nach „Weitere Portale“ ziehen | Keine Neuerstellung. Popup: „außerhalb der Gruppe“. „Wiederherstellen“ holt den Tab zurück. | [S] [E] |
| 13 | Schutz aus/an | Aus → portal-3 schließen → an | Aus: bleibt zu, Badge `AUS`. An: wird einmal ergänzt. | [S] [E] |
| 14 | Mehrfach wiederherstellen | 3× schnell „Wiederherstellen“ | Keine Duplikate. | [S] [E] |
| 15 | Gleiche URL in zwei Gruppen | Dieselbe URL in Gaming und Tools, speichern, neu starten | Beide werden ihrer Gruppe zugeordnet, nichts doppelt. | [S] [E] |
| 16 | Vorlage ändern | a) Gruppe umbenennen und umfärben → Nur speichern. b) Tab ergänzen → Als Standard speichern. c) Tab aus der Vorlage löschen, speichern, Tab schließen. d) Ungültige Eingabe. | a) Die offene Gruppe ändert sich sofort. b) Der neue Tab erscheint an der richtigen Position. c) Er bleibt nach dem Speichern offen, kommt nach dem Schließen nicht zurück. d) Rote Markierung, Speichern ist gesperrt. | [S] [E] |
| 17 | Schleifenschutz | privat-2 6× schließen | Nach 5× pausiert, Popup „(pausiert)“. „Wiederherstellen“ hebt die Pause auf. | [S] [E] |
| 18 | Export/Import JSON | Exportieren → Alle Profile, dann Importieren → Alle ersetzen | Die Datei wird heruntergeladen. Der Import landet im Editor und wirkt erst nach dem Speichern. | [E] |
| 19 | Update/Neu laden | ⟳ in `edge://extensions` | Es öffnet sich nichts, der Schutz funktioniert weiter. | [S] [E] |
| 20 | Startleistungs-Boost | Boost an, Windows neu anmelden, Edge später öffnen | Die Vorlage wird erst beim ersten Fenster aufgebaut. | [S] [E] |
| 21 | Sitzung als Standard | Zwei Fenster, eine unbenannte Gruppe, ein ungruppierter Tab. „Sitzung als Standard …“, „Sonstiges“ ankreuzen, speichern. | Nichts doppelt. Die unbenannte Gruppe heißt „Gruppe“, der ungruppierte Tab steht in „Sonstiges“. Ein geschlossener Tab kommt zurück. | [S] [E] |
| 22 | Editor | Farbe ändern, Tab in andere Gruppe ziehen, doppelten Gruppennamen eingeben, Strg+Z | Farbe sofort sichtbar. Der doppelte Name ist markiert, Speichern gesperrt. Strg+Z macht rückgängig. | [E] (Vorschau angesehen) |
| 23 | Sync zwischen zwei Geräten | Schlüssel aktiv, Edge-Sync „Erweiterungen“ an. A speichert, B wird frisch geladen. | B erhält die Vorlage nach einigen Minuten. Umbenennungen werden übernommen, neue Tabs gelten als fehlend. | [S] [E] **offen, ob Edge entpackte Erweiterungen synchronisiert** |
| 24 | Sync-Konflikt | Gerät mit eigener abweichender Vorlage schaltet Sync ein | Banner „Welche Vorlage soll gelten?“. Bis zur Wahl wird nichts überschrieben. | [S] [E] |
| 25 | Profilwechsel | Zweites Profil anlegen und speichern. Im Popup wechseln, ohne und mit „Pflicht-Tabs schließen“. | Das neue Profil wird aufgebaut. Ohne Haken bleiben die alten Tabs ungeschützt offen, mit Haken werden nur die alten Pflicht-Tabs geschlossen. Edge bleibt offen. | [S] [E] |
| 26 | Gleichnamige eigene Gruppe | Eigene Gruppe „Musik“ mit fremdem Tab, dann zu einem Profil mit „Musik“ wechseln | Die eigene Gruppe bleibt unverändert, die Vorlagengruppe entsteht separat. | [S] [E] |
| 27 | Freier Tab | Tab auf 🔓 stellen, speichern, schließen | Bleibt zu, nicht „fehlend“. Bei Start bzw. „Wiederherstellen“ wieder da. | [S] [E] |
| 28 | Favoriten-Import | Edge-Favoriten als HTML exportieren und in Tabi importieren | Ordner werden Gruppen und sind abwählbar, Bookmarklets fehlen. | [S] Parser, [E] Dialog |
| 29 | Favoriten-Export | Profil als Favoriten exportieren und in Edge importieren | Ordner „Tabi – Profilname“ mit Unterordnern je Fenster und Gruppe. | [E] |

## Testprotokolle

Für jede Version, die in Edge getestet wurde, eine Zeile ergänzen:

| Version | Datum | Edge-Version | Getestet von | Ergebnis | Bemerkungen |
|---|---|---|---|---|---|
| 0.4.0 | – | – | – | **noch nicht in Edge getestet** | automatisiert: 106/106 [S] |
