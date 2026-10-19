# Vorlagenformat (JSON)

Stand: Vorlagenformat **2** (ab Tabi 0.4.0) · [Zurück zur Übersicht](../README.md)

Die Vorlage lässt sich im Editor unter **JSON** bearbeiten oder als Datei exportieren und importieren. Normalerweise brauchst du das Format nicht, weil der visuelle Editor alles abdeckt.

## Aufbau

```
Vorlage
├── version: 2
├── settings
└── profiles[]            (mind. 1)
    └── windows[]         (mind. 1 je Profil)
        └── groups[]      (mind. 1 je Fenster)  = native Edge-Registerkartengruppe
            └── tabs[]    (mind. 1 je Gruppe)
```

Die **Reihenfolge** in den Listen ist die Reihenfolge im Browser.

## Felder

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `version` | Zahl | – | Formatversion, aktuell `2` |
| `settings.reuseEmptyStartupWindow` | bool | – | Standard `true`: Ein Fenster, das beim Start nur eine leere Neuer-Tab-Seite enthält, wird für das erste fehlende Vorlagenfenster mitbenutzt. Die Neuer-Tab-Seite bleibt erhalten. |
| `settings.focusCreatedWindows` | bool | – | Standard `true`: Neu aufgebaute Fenster kommen in den Vordergrund (nie bei automatischen Reparaturen). |
| `profiles[].id` | Text | ✔ | stabile ID, eindeutig über die ganze Vorlage |
| `profiles[].name` | Text | ✔ | Anzeigename, eindeutig |
| `windows[].id` | Text | ✔ | stabile ID |
| `windows[].name` | Text | – | nur zur Anzeige (Edge kennt keine Fensternamen) |
| `groups[].id` | Text | ✔ | stabile ID |
| `groups[].title` | Text | ✔ | Name der Edge-Gruppe, **je Profil eindeutig**. Dient zum Wiedererkennen nach einem Neustart. |
| `groups[].color` | Text | – | `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange` (Standard `grey`) |
| `groups[].collapsed` | bool | – | Zustand beim **Neuaufbau** der Gruppe. Bestehende Gruppen klappt Tabi nicht auf oder zu. |
| `tabs[].id` | Text | ✔ | stabile ID |
| `tabs[].url` | Text | ✔ | Start-URL, nur `http://` oder `https://` |
| `tabs[].protect` | bool | – | `false` = „frei“, darf geschlossen bleiben. Ohne Angabe ist der Tab geschützt. |
| `$comment` | beliebig | – | auf jeder Ebene als Kommentar erlaubt |

**IDs:** Buchstaben, Ziffern, `-`, `_`, `.`. Beginn mit Buchstabe oder Ziffer, max. 64 Zeichen. Eindeutig über **alle** Profile. IDs verbinden offene Tabs, Wiedererkennungs-Hinweise und Sync-Daten mit der Vorlage. Ändere sie nicht, wenn du nur eine URL anpasst. Der Editor vergibt IDs automatisch.

**Gleiche URL mehrfach** ist erlaubt, auch in verschiedenen Gruppen.

## Beispiel

```json
{
  "version": 2,
  "settings": {
    "reuseEmptyStartupWindow": true,
    "focusCreatedWindows": true
  },
  "profiles": [
    {
      "id": "standard",
      "name": "Standard",
      "windows": [
        {
          "id": "daily",
          "name": "Daily",
          "groups": [
            {
              "id": "gaming",
              "title": "Gaming",
              "color": "blue",
              "collapsed": false,
              "tabs": [
                { "id": "gaming-portal-1", "url": "https://example.com/portal-1" },
                { "id": "gaming-portal-2", "url": "https://example.com/portal-2" },
                { "id": "gaming-portal-3", "url": "https://example.com/portal-3", "protect": false }
              ]
            },
            {
              "id": "recherche",
              "title": "Recherche",
              "color": "green",
              "collapsed": true,
              "tabs": [
                { "id": "recherche-privat-1", "url": "https://example.org/privat-1" },
                { "id": "recherche-privat-2", "url": "https://example.org/privat-2" }
              ]
            }
          ]
        },
        {
          "id": "weitere-portale",
          "name": "Weitere Portale",
          "groups": [
            {
              "id": "tools",
              "title": "Tools",
              "color": "orange",
              "tabs": [
                { "id": "tools-tool-1", "url": "https://example.net/tool-1" }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "abend",
      "name": "Abend",
      "windows": [
        {
          "id": "abend-fenster",
          "name": "Entspannen",
          "groups": [
            {
              "id": "musik",
              "title": "Musik",
              "color": "pink",
              "tabs": [
                { "id": "musik-1", "url": "https://music.example.com/" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Profil-Export

„Dieses Profil (JSON)“ erzeugt:

```json
{ "tabiProfile": 1, "version": 2, "profile": { "id": "…", "name": "…", "windows": [ … ] } }
```

Beim Import bekommen kollidierende IDs automatisch neue Werte.

## Format 1 (bis Tabi 0.3.x)

Format 1 hatte statt `profiles` direkt `windows` auf oberster Ebene:

```json
{ "version": 1, "settings": { … }, "windows": [ … ] }
```

Tabi übernimmt solche Vorlagen beim Laden, beim Import und aus dem Sync automatisch als Profil `standard` / „Standard“. Gruppennamen mussten in Format 1 über die ganze Vorlage eindeutig sein, in Format 2 nur je Profil.

## Was nicht in der Vorlage steht

Diese Daten speichert Tabi **pro Gerät** (`chrome.storage.local`). Sie werden nicht synchronisiert und nicht exportiert:
- welche Profile auf dem Gerät laufen (`activeProfiles`, Liste; bis 0.4.x ein einzelnes `activeProfile`)
- Schutz an/aus (`enabled`)
- zuletzt gesehene URLs und Gruppentitel zur Wiedererkennung (`hints`)
- Gerätename und Sync-Status (`sync`, `syncState`)
- Revision der Vorlage (`configRev`)

Details: [Architektur → Datenhaltung](ARCHITEKTUR.md#3-datenhaltung).
