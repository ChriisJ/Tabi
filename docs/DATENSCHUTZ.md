# Datenschutz

Stand: Version 0.4.0 · [Zurück zur Übersicht](../README.md)

**Kurz:** Tabi sendet keine Daten an den Entwickler oder an Dritte. Es gibt keine Telemetrie, keine Werbung, keine Netzwerkzugriffe und keine extern nachgeladenen Skripte. Daten liegen nur in deinem Browser und, wenn du Sync nutzt, in deinem eigenen Edge-Konto.

## Berechtigungen

| Berechtigung | Wofür |
|---|---|
| `tabs` (in Edge: „Browserverlauf lesen“) | Adressen offener Tabs lesen, um Pflicht-Tabs nach einem Neustart wiederzuerkennen und „Aktuelle Sitzung übernehmen“ anzubieten. Der Browserverlauf selbst wird **nicht** gelesen. |
| `tabGroups` | Native Registerkartengruppen anlegen, benennen, einfärben und erkennen |
| `storage` | Vorlage und Einstellungen speichern, optional synchronisieren |

Tabi hat **keine** Host-Berechtigungen und keine Content-Scripts. Es kann den Inhalt von Webseiten weder lesen noch verändern.

## Gespeicherte Daten

| Daten | Ort | Zweck |
|---|---|---|
| Vorlage: Profile, Fenster, Gruppennamen und -farben, Start-URLs | `storage.local`, bei aktivem Sync zusätzlich `storage.sync` (dein Edge-Konto) | Kernfunktion |
| Zuletzt gesehene URL je Pflicht-Tab, zuletzt gesehener Gruppentitel | `storage.local`, nur auf diesem Gerät | Wiedererkennung nach einem Neustart, auch nach Navigation |
| Laufende Profile, Schutz an/aus, Gerätename, Sync-Status | `storage.local` | Einstellungen dieses Geräts |
| Laufzeitzuordnung und Protokoll (max. 300 Einträge, mit Tab-Schlüsseln und Adressen) | `storage.session`, gelöscht beim Browserneustart | Betrieb und Fehlersuche |

- **Sync** nutzt den Speicher deines Edge-Kontos (`chrome.storage.sync`). Übertragen wird nur die Vorlage. Der Sync lässt sich in den Einstellungen pro Gerät ausschalten.
- **Exporte** erzeugen Dateien auf deinem Rechner. Sie enthalten deine Vorlagen-URLs.
- Beim **Deinstallieren** löscht Edge alle gespeicherten Daten der Erweiterung.

## Text für Store-Angaben

> Tabi speichert die vom Nutzer angelegte Tab-Vorlage (Fenster, Gruppen, Start-URLs) lokal im Browser und, falls der Nutzer Sync aktiviert, über den Synchronisierungsspeicher seines eigenen Browserkontos. Zur Wiedererkennung von Tabs nach einem Browserneustart liest Tabi die Adressen offener Tabs und speichert die zuletzt gesehene Adresse der verwalteten Tabs lokal. Es werden keine Daten an den Entwickler oder Dritte übertragen, keine Analyse- oder Werbedienste genutzt und keine Webseiteninhalte gelesen.
