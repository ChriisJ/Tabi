# Tabi – Tab-Vorlagen und geschützte Tabs für Microsoft Edge

[![Version](https://img.shields.io/badge/version-0.4.0-blue)](CHANGELOG.md)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Edge](https://img.shields.io/badge/Microsoft%20Edge-Chromium-0078D7)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow)](LICENSE)

**Tabi** baut beim Start von Edge deine festen Fenster mit **nativen Registerkartengruppen** und Pflicht-Tabs auf. Schließt du einen Pflicht-Tab versehentlich, öffnet Tabi ihn im Hintergrund wieder, in seiner Gruppe und an seiner Position.

> **Ersatz für die verlorene Tab-Sperre aus den Edge-Arbeitsbereichen.**
> Die früheren Edge-Arbeitsbereiche (Workspaces) konnten Tabs sperren. In den neuen Arbeitsbereichen (ab Edge 144) fehlt diese Funktion laut Nutzerberichten ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/12673294)). Tabi bringt das Verhalten zurück: Wichtige Tabs bleiben da, als Teil einer festen Vorlage aus Fenstern und Gruppen.
> *Technischer Hinweis:* Keine Erweiterung kann das Schließen eines Tabs wirklich verhindern, die Schnittstellen von Edge erlauben das nicht. Tabi öffnet geschützte Tabs deshalb sofort wieder (Details: [Architektur](docs/ARCHITEKTUR.md#1-machbarkeit)).

Tabi pinnt keine Tabs an, ersetzt keine Tab-Leiste, sperrt keine Navigation und sendet keine Daten.

---

## Funktionen

| | |
|---|---|
| 🗂️ **Vorlage** | Feste Fenster → native Edge-Gruppen (Name, Farbe, Reihenfolge, auf-/zugeklappt) → Tabs |
| 🔒 **Geschützte Tabs** | Geschlossene Pflicht-Tabs kommen sofort zurück, auch ganze geschlossene Gruppen. Einzelne Tabs können als 🔓 *frei* markiert werden. |
| 👤 **Profile** | Mehrere Vorlagen, z. B. „Standard“ und „Dev“. Sie laufen **gleichzeitig in eigenen Fenstern** oder einzeln, an- und abschaltbar per Klick. |
| 🖱️ **Visueller Editor** | Farben, Namen, Drag & Drop, „aktuelle Sitzung übernehmen“, URLs einfügen, Rückgängig |
| 🔄 **Sync** | Vorlage über dein Edge-Konto auf andere Geräte übertragen (siehe Hinweise) |
| ⇄ **Export/Import** | JSON, Edge-Favoritendatei (HTML), Linkliste (TXT) |
| 🧭 **Navigation frei** | Logins, Weiterleitungen und Unterseiten sind erlaubt. Die Identität eines Tabs hängt nicht an seiner URL. |
| 🛡️ **Sicher** | Kein Konflikt mit der Sitzungswiederherstellung, keine Duplikate, Schleifenschutz, beendet Edge nie zwangsweise |
| 🔐 **Datenschutz** | Keine Telemetrie, kein Netzwerk, keine externen Skripte ([Datenschutz](docs/DATENSCHUTZ.md)) |

---

## Schnellstart

1. **Herunterladen:** Das ZIP aus den [Releases](https://github.com/ChriisJ/Tabi/releases) entpacken oder das Repository klonen.
2. **Laden:** In Edge `edge://extensions` öffnen → **Entwicklermodus** einschalten → **Entpackte Erweiterung laden** → den Ordner mit `manifest.json` wählen.
3. **Einrichten:** Fenster und Gruppen in Edge so anordnen, wie du sie willst. Dann Tabi-Symbol → **„Sitzung als Standard …“** → **„Als Standard speichern“**.
4. Fertig. Schließt du jetzt einen Pflicht-Tab, kommt er zurück.

Empfohlene Edge-Einstellung: *Beim Start → Registerkarten aus der vorherigen Sitzung öffnen*. Mehr dazu in der [Bedienungsanleitung](docs/BEDIENUNG.md#edge-einstellungen).

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [Bedienung](docs/BEDIENUNG.md) | Installation, Editor, Profile, Schutz pro Tab, Sync, Export/Import, Deinstallation |
| [Vorlagenformat](docs/VORLAGENFORMAT.md) | JSON-Referenz mit Beispiel |
| [Architektur](docs/ARCHITEKTUR.md) | Machbarkeit, Aufbau, Lebenszyklus, Wiedererkennung, bekannte Grenzen |
| [Testplan](docs/TESTPLAN.md) | Manuelle Tests in Edge und automatisierte Logiktests |
| [Entwicklung & Release](docs/ENTWICKLUNG.md) | Projektstruktur, Debugging, Tests, Versionierung, Veröffentlichung |
| [Datenschutz](docs/DATENSCHUTZ.md) | Welche Daten Tabi wo speichert |
| [Changelog](CHANGELOG.md) | Patchnotes aller Versionen |

---

## Status

Tabi ist in **früher Entwicklung (0.x)**. Die Logik ist mit einer simulierten Browser-API automatisiert getestet (106 Prüfungen). Der vollständige Test in echtem Edge steht noch aus, siehe [Testplan](docs/TESTPLAN.md). Fehler und Wünsche bitte als [Issue](https://github.com/ChriisJ/Tabi/issues) melden.

**Bekannte Einschränkungen (Auszug):** Ein wieder geöffneter Tab startet auf seiner Start-URL ohne Zurück-Verlauf. Ob der Sync bei *entpackten* Erweiterungen zwischen Geräten funktioniert, ist von Microsoft nicht dokumentiert. Vollständige Liste: [Architektur → Bekannte Grenzen](docs/ARCHITEKTUR.md#8-bekannte-grenzen).

---

## Lizenz

[MIT](LICENSE) © 2026 ChriisJ. „Microsoft Edge“ ist eine Marke von Microsoft. Tabi ist ein unabhängiges Projekt und steht in keiner Verbindung zu Microsoft.
