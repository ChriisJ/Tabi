# Bedienung

Stand: Version 0.5.0 · [Zurück zur Übersicht](../README.md)

- [Installation](#installation)
- [Edge-Einstellungen](#edge-einstellungen)
- [Erste Einrichtung](#erste-einrichtung)
- [Das Popup](#das-popup)
- [Der Editor](#der-editor)
- [Profile](#profile)
- [Schutz pro Tab](#schutz-pro-tab)
- [Export und Import](#export-und-import)
- [Sync zwischen Geräten](#sync-zwischen-geräten)
- [Was passiert wann?](#was-passiert-wann)
- [Update, Deinstallation, Rollback](#update-deinstallation-rollback)

---

## Installation

1. Den Tabi-Ordner an einen **dauerhaften** Ort legen, z. B. `C:\Users\<du>\Tools\Tabi`. Edge lädt die Erweiterung direkt aus diesem Ordner. Verschiebst oder löschst du ihn, funktioniert sie nicht mehr.
   - Aus einem Release: ZIP von der [Releases-Seite](https://github.com/ChriisJ/Tabi/releases) entpacken.
   - Oder klonen:
     ```bash
     git clone https://github.com/ChriisJ/Tabi.git
     ```
2. In Edge `edge://extensions` öffnen.
3. Unten links **„Entwicklermodus“** einschalten.
4. **„Entpackte Erweiterung laden“** klicken und den Ordner mit `manifest.json` wählen.
5. Edge zeigt die Berechtigungen an. „Browserverlauf lesen“ ist die Berechtigung `tabs`. Tabi braucht sie, um offene Tabs nach einem Neustart wiederzuerkennen. Die URLs verlassen dabei nie deinen Rechner ([Datenschutz](DATENSCHUTZ.md)).
6. Tabi öffnet die Einstellungen mit dem Hinweis „Noch keine eigene Vorlage“. Weiter mit der [ersten Einrichtung](#erste-einrichtung).
7. Optional: Über das Puzzle-Symbol in der Symbolleiste Tabi **anheften**. Dann sind Status und Badge immer sichtbar.

> Edge weist beim Start eventuell auf „Erweiterungen im Entwicklermodus“ hin. Das ist bei entpackten Erweiterungen normal und entfällt bei einer Store-Version.

## Edge-Einstellungen

`edge://settings` → **Start, Startseite und neue Registerkarten** → „Wenn Edge gestartet wird“:

| Einstellung | Zusammenspiel mit Tabi | Empfehlung |
|---|---|---|
| **Registerkarten aus der vorherigen Sitzung öffnen** | Edge stellt Fenster, Gruppen und Tabs samt Unterseiten wieder her. Tabi wartet, bis das fertig ist, übernimmt die Pflicht-Tabs und ergänzt nur Fehlendes. | ✅ **Empfohlen** |
| Neue Registerkarte öffnen | Tabi nutzt das leere Startfenster für das erste Vorlagenfenster mit. Die Neuer-Tab-Seite bleibt offen. Pflicht-Tabs starten auf ihrer Start-URL. | funktioniert |
| Diese Seiten öffnen | Edge öffnet die Seiten **ohne Gruppen**, Tabi baut eigene auf. Ergebnis: doppelte Seiten. | ❌ nicht verwenden |

`edge://settings/system`:
- **Startleistungs-Boost:** möglichst **aus**. Tabi kommt damit zurecht und baut erst beim ersten echten Fenster auf.
- **„Erweiterungen und Apps im Hintergrund weiter ausführen …“:** möglichst **aus**. Mit dieser Option gilt das erste neue Fenster nach „alle Fenster geschlossen“ als Start.

## Erste Einrichtung

**Der schnellste Weg:**
1. Fenster, Gruppen (Name, Farbe) und Tabs in Edge so anordnen, wie sie immer sein sollen.
2. Tabi-Symbol → **„Sitzung als Standard …“**, oder in den Einstellungen **„Aktuelle Sitzung übernehmen“**.
3. Fenster auswählen. Ungruppierte Tabs kannst du optional als Gruppe „Sonstiges“ aufnehmen. Interne Seiten (`edge://…`) werden übersprungen.
4. **„Als Standard speichern“.** Die offenen Tabs werden direkt verknüpft, es öffnet sich **nichts doppelt**. Unbenannte Gruppen bekommen in Edge den Namen aus der Vorlage.

Alternativ kannst du die Vorlage im [Editor](#der-editor) von Hand aufbauen oder eine Datei [importieren](#export-und-import).

## Das Popup

- **Profile** (ab zwei Profilen): ein Schalter je Profil zum zusätzlichen Öffnen oder Beenden, dazu „nur dieses“ ([Profile](#profile)). Laufen mehrere, sind die Fenster darunter nach Profil gruppiert.
- **Schalter oben rechts:** Schutz an/aus. Beim Ausschalten bleiben alle Tabs unverändert. Beim Einschalten wird einmal abgeglichen und Fehlendes ergänzt.
- **Status:**
  - grün: alle geschützten Tabs offen
  - gelb: es fehlen Tabs, z. B. weil ein Fenster geschlossen wurde
  - grau: Schutz aus oder noch keine Vorlage
  - rot: Fehler oder Schleifenschutz aktiv
- **Liste:** Fenster und Gruppen mit „offen/gesamt“. „fehlt: …“ sind geschützte Tabs, „geschlossen (darf): …“ sind freie Tabs.
- **„Vorlage jetzt wiederherstellen“:** öffnet alles Fehlende, auch geschlossene Fenster und freie Tabs, holt verschobene Pflicht-Tabs an ihren Platz zurück und setzt Namen und Farben der Gruppen. Mehrfaches Klicken ist unschädlich.
- **Badge am Symbol:** Anzahl fehlender Tabs, `AUS` bei Schutz aus, `!` bei Fehlern.

## Der Editor

Öffnen: Popup → **„Vorlage bearbeiten“**, oder Rechtsklick auf das Symbol → *Erweiterungsoptionen*.

| Bereich | Bedienung |
|---|---|
| **Fenster** | Name oben in der Karte. ↑/↓ ändern die Reihenfolge. Das Badge zeigt „offen“ / „nicht offen“. Edge kennt keine Fensternamen, der Name dient nur dir. |
| **Gruppen** | Name im farbigen Chip. Ein Klick auf den Farbpunkt zeigt die 9 Edge-Farben. „aufgeklappt/eingeklappt“ legt den Zustand beim *Neuaufbau* fest. Ziehen am Griff ⋮⋮ verschiebt Gruppen, auch in andere Fenster. |
| **Tabs** | „+ Tab“, Enter im URL-Feld legt den nächsten an. Fügst du mehrere URLs ein, entstehen mehrere Tabs. Sortieren per Ziehen oder Alt+↑/↓. 🔒/🔓 siehe [Schutz pro Tab](#schutz-pro-tab). |
| **„URLs einfügen“ / „Mehrere URLs“** | Liste einfügen, eine Adresse pro Zeile. `https://` wird ergänzt, Ungültiges wird angezeigt und ignoriert. Ziel ist eine bestehende Gruppe oder eine neue Gruppe in einem bestehenden oder neuen Fenster. |
| **„Aus offenen Tabs“** | Offene Tabs auswählen. Sie werden verknüpft und beim Speichern in die Gruppe **verschoben**, nicht neu geöffnet. |
| **Links ziehen** | Einen Link oder die Adresse aus der Adressleiste auf eine Gruppe ziehen. |
| **Live-Punkt je Tab** | grün = offen und geschützt · Ring = nicht offen · orange = offen, aber außerhalb seiner Gruppe |

**Speichern**
- **„Als Standard speichern“** (Strg+S): speichert und öffnet fehlende Tabs sofort.
- **„Nur speichern“**: Fehlende Tabs öffnen sich erst beim nächsten Start oder über „Vorlage wiederherstellen“.
- **„Verwerfen“**: zurück zum gespeicherten Stand.
- **Rückgängig:** Strg+Z (außerhalb von Eingabefeldern) oder der Knopf in der Meldung.
- Probleme wie doppelte Gruppennamen oder fehlende URLs werden rot markiert und in der Leiste unten erklärt. Ein Klick springt zur Stelle. Gespeichert werden kann erst, wenn alles gültig ist.

**Weitere Bereiche**
- **Sync zwischen Geräten** und **Verhalten beim Aufbau** (leeres Startfenster mitbenutzen, neue Fenster in den Vordergrund holen): Karten unterhalb der Fenster.
- **JSON**: die Vorlage als Text für Experten ([Vorlagenformat](VORLAGENFORMAT.md)).
- **Protokoll**: die letzten 300 Ereignisse, hilfreich bei Fehlern ([Fehlersuche](ENTWICKLUNG.md#fehlersuche)).

## Profile

- Eine Vorlage kann **mehrere Profile** enthalten, z. B. „Standard“ und „Dev“, jedes mit eigenen Fenstern, Gruppen und Tabs.
- **Mehrere Profile können gleichzeitig laufen**, jedes in seinen eigenen Fenstern und jedes geschützt. Beispiel: „Standard“ in einem Fenster, „Dev“ in einem zweiten.
- Welche Profile auf einem Gerät laufen, wird nur lokal gespeichert. Laptop und Desktop können also verschiedene Profile nutzen. Die Profile selbst werden [synchronisiert](#sync-zwischen-geräten).

**Im Popup** hat jedes Profil einen Schalter:

| Aktion | Wirkung |
|---|---|
| Schalter **an** | Das Profil startet **zusätzlich** in eigenen Fenstern. Bereits offene passende Gruppen werden übernommen statt doppelt geöffnet. |
| Schalter **aus** | Das Profil wird beendet. Mit „Seine Pflicht-Tabs schließen“ verschwinden seine Tabs, ohne Haken bleiben sie offen, sind aber nicht mehr geschützt. Eigene Tabs bleiben immer offen. |
| **nur dieses** | Alle anderen Profile werden beendet, wahlweise mit Schließen ihrer Pflicht-Tabs. |

Mindestens ein Profil bleibt immer aktiv, der letzte Schalter ist deshalb gesperrt. Würde das Beenden alle Fenster schließen, lässt Tabi einen Tab offen, damit sich Edge nicht beendet.

**Im Editor**
- Die Profilleiste oben wählt das Profil, das du **bearbeitest**. Laufende Profile sind mit ● markiert. Bearbeiten heißt *nicht* starten.
- Im Profilkopf: **„Zusätzlich öffnen“**, **„Nur dieses aktivieren“** oder bei laufenden Profilen **„Beenden“** bzw. **„Nur dieses“**. Gestartet wird die *gespeicherte* Fassung, also vorher speichern.
- **Anlegen, umbenennen, duplizieren, löschen:** über „+ Profil“, den Namen im Profilkopf und die Symbole rechts daneben. Ein laufendes Profil lässt sich erst nach dem Beenden löschen.
- „Aktuelle Sitzung übernehmen“ kann ein Profil ersetzen, ergänzen oder ein **neues Profil** anlegen.

**Gut zu wissen**
- Gruppennamen dürfen sich zwischen Profilen wiederholen, z. B. „Tools“ in „Standard“ und in „Dev“. Tabi unterscheidet sie über die Tabs.
- Beim Browserstart werden alle laufenden Profile wiederhergestellt bzw. aufgebaut.

## Schutz pro Tab

Edge erlaubt Erweiterungen nicht, das Schließen eines Tabs zu *verhindern*. Tabi öffnet geschützte Tabs deshalb sofort wieder. Pro Tab legst du fest:

| | Bedeutung |
|---|---|
| 🔒 **geschützt** (Standard) | Wird nach dem Schließen automatisch wieder geöffnet, im Hintergrund, in seiner Gruppe und an seiner Position. |
| 🔓 **frei** | Gehört zur Vorlage und öffnet sich beim Start bzw. bei „Vorlage wiederherstellen“, darf aber geschlossen bleiben. Zählt nicht als „fehlend“. |

Umschalten über das Schloss neben der URL. „Alle schützen/freigeben“ gilt für die ganze Gruppe.

**Gut zu wissen**
- Ein wieder geöffneter Tab ist ein **neuer** Tab: Er startet auf seiner Start-URL, ohne Zurück-Verlauf und ohne Formulareingaben. Logins bleiben erhalten, weil die Cookies im Edge-Profil liegen.
- Innerhalb eines Tabs darfst du frei navigieren und dich anmelden. Tabi setzt die Adresse nie zurück.
- Schließt du ein **ganzes Fenster** oder **Edge**, öffnet Tabi nichts wieder. Das Fehlende kommt beim nächsten Start oder über „Vorlage wiederherstellen“.
- Ist ein Pflicht-Tab der **einzige** Tab seines Fensters, schließt Edge mit ihm das Fenster. Das wird wie „Fenster geschlossen“ behandelt.
- Schließt du einen Tab sehr oft hintereinander (5× in 60 s), pausiert Tabi ihn (**Schleifenschutz**). „Vorlage wiederherstellen“ hebt die Pause auf.
- Ziehst du einen Pflicht-Tab woandershin, bleibt er geschützt. Tabi holt ihn erst bei „Vorlage wiederherstellen“ zurück.

## Export und Import

**Exportieren** (Menü „Exportieren“):

| Eintrag | Format | Zweck |
|---|---|---|
| Alle Profile | JSON | vollständige Sicherung |
| Dieses Profil | JSON | ein Profil weitergeben oder übertragen |
| Dieses Profil als Favoriten | HTML | in Edge: *Favoriten → ⋯ → Favoriten importieren → Favoriten- oder Lesezeichen-HTML-Datei* |
| Dieses Profil als Linkliste | TXT | `# Fenster`, `## Gruppe`, darunter eine URL pro Zeile |

Exportiert wird der aktuelle Stand im Editor, auch wenn er noch nicht gespeichert ist.

**Importieren** (das Format wird automatisch erkannt):
- **Tabi-JSON:** komplette Vorlage (alle Profile ersetzen oder als zusätzliche Profile hinzufügen) oder ein einzelnes Profil (neu hinzufügen oder aktuelles ersetzen). Alte Vorlagen im Format 1 werden automatisch zu einem Profil „Standard“.
- **Favoriten-HTML aus Edge/Chrome** (*Favoriten → ⋯ → Favoriten exportieren*): Jeder Ordner mit Links wird eine Gruppe. Im Dialog kannst du Ordner abwählen. Tabi-eigene Favoriten-Exporte werden vollständig wiederhergestellt, inklusive Fenster, Farben und „frei“. Bookmarklets und interne Seiten werden ignoriert.
- **Linkliste (TXT):** mit oder ohne Überschriften, fehlendes `https://` wird ergänzt.
- Ziel ist jeweils ein **neues Profil**, oder du **ergänzt** bzw. **ersetzt** das aktuelle Profil.

Importiertes landet zuerst im Editor. Wirksam wird es erst mit „Als Standard speichern“, Rückgängig ist möglich. Ab 120 Tabs warnt der Dialog, weil sich alle gleichzeitig öffnen würden und der Sync auf ca. 90 KB begrenzt ist.

> Exportierte Dateien können private Adressen enthalten. Nicht unbedacht weitergeben oder ins Repository legen. `.gitignore` schließt die Standard-Dateinamen aus.

## Sync zwischen Geräten

Tabi überträgt die **Vorlage mit allen Profilen** über dein Edge-Konto (`chrome.storage.sync`). **Pro Gerät** bleiben: welches Profil aktiv ist, welche offenen Tabs zugeordnet sind, die URL-Hinweise und „Schutz an/aus“.

**Voraussetzungen**
1. Auf allen Geräten in Edge mit **demselben Konto** angemeldet. Unter `edge://settings/profiles/sync` ist **„Erweiterungen“** eingeschaltet.
2. **Gleiche Erweiterungs-ID auf allen Geräten.** Edge ordnet Sync-Daten der Erweiterungs-ID zu. Bei entpackten Erweiterungen hängt die ID vom Ordnerpfad ab. Das Skript `tools/sync-id-aktivieren.ps1` trägt einen festen Schlüssel ein, die ID ist dann überall `ohoajbcppfidbcpaeipdehpeadbocbah`. Eine spätere Store-Version braucht das nicht.
3. Überall **dieselbe Tabi-Version**.

**Einmalige Umstellung auf einem Gerät, auf dem Tabi schon läuft**

> ⚠️ Mit dem festen Schlüssel ändert sich die ID **einmal**. Die bisher gespeicherte Vorlage ist danach nicht mehr erreichbar.

1. Tabi → „Vorlage bearbeiten“ → **Exportieren → Alle Profile**.
2. Im Tabi-Ordner ausführen:
   ```bash
   powershell -ExecutionPolicy Bypass -File tools\sync-id-aktivieren.ps1
   ```
3. `edge://extensions` → Tabi **entfernen** → „Entpackte Erweiterung laden“ → Ordner wählen.
4. In den Einstellungen **Importieren** (Datei aus Schritt 1) → „Alle Profile ersetzen“ → **Als Standard speichern**. Offene Tabs werden wiedererkannt.

**Weitere Geräte:** denselben Ordner (mit Schlüssel) laden. Tabi wartet auf die Vorlage aus dem Sync und baut sie auf, sobald sie ankommt. Das kann ein paar Minuten dauern. Unter „Name dieses Geräts“ einen Namen vergeben, er erscheint auf den anderen Geräten als Herkunft.

**Im Betrieb**
- „Als Standard speichern“ lädt die Vorlage hoch. Andere Geräte passen Namen und Farben offener Gruppen sofort an.
- **Neue Tabs öffnen sich auf anderen Geräten nicht ungefragt.** Sie gelten dort als „fehlend“ und kommen beim nächsten Start oder über „Vorlage wiederherstellen“.
- **Konflikte:** Die zuletzt gespeicherte Fassung gilt.
  - Synchronisiert ein Gerät mit *eigener, abweichender* Vorlage zum ersten Mal, fragt Tabi: „Vorlage aus dem Sync übernehmen“ oder „Diese Vorlage für alle Geräte verwenden“. Bis dahin wird nichts überschrieben.
  - Kommt eine neue Fassung an, während du im Editor ungespeichert arbeitest, erscheint ein Hinweis.
- Sync lässt sich pro Gerät in der Sync-Karte ausschalten.

> **Offener Punkt:** Microsoft dokumentiert nicht, ob Edge `storage.sync` auch für **entpackte** Erweiterungen zwischen Geräten überträgt. Kommt nichts an, nutze als Ausweichweg Export und Import, z. B. über OneDrive.

## Was passiert wann?

| Situation | Tabi … |
|---|---|
| Edge startet | wartet auf die Sitzungswiederherstellung, übernimmt vorhandene Tabs und ergänzt fehlende Fenster, Gruppen und Tabs **aller laufenden Profile** |
| Profil eingeschaltet | baut es in eigenen Fenstern auf, übernimmt dabei vorhandene passende Gruppen |
| Profil ausgeschaltet | beendet den Schutz, schließt auf Wunsch seine Pflicht-Tabs, aber nie das letzte Fenster |
| Pflicht-Tab geschlossen | öffnet ihn nach ca. 0,5 s im Hintergrund wieder |
| freier Tab geschlossen | nichts |
| eigener Tab geschlossen, auch in einer Vorlagengruppe | nichts |
| ganze Gruppe geschlossen | baut sie **einmal** mit allen geschützten Tabs neu auf |
| Fenster oder Edge geschlossen | nichts, erst beim nächsten Start oder per „Wiederherstellen“ |
| Erweiterung aktualisiert oder neu geladen | übernimmt offene Tabs, öffnet nichts |
| Schutz ausgeschaltet | nichts, alle Tabs bleiben, wie sie sind |
| Schutz eingeschaltet | gleicht einmal ab und ergänzt Fehlendes |

## Update, Deinstallation, Rollback

- **Update (entpackt):** Ordnerinhalt durch die neue Version ersetzen, z. B. mit `git pull`, dann in `edge://extensions` bei Tabi auf ⟳ klicken. Vorlage und Einstellungen bleiben erhalten. Vorher den [Changelog](../CHANGELOG.md) lesen, besonders die Abschnitte **„Achtung“**.
- **Vorher sichern:** Exportieren → Alle Profile.
- **Vorübergehend abschalten:** Schutz im Popup ausschalten, oder Tabi in `edge://extensions` deaktivieren.
- **Deinstallieren:** `edge://extensions` → Tabi → **Entfernen**. Edge löscht die gespeicherten Daten der Erweiterung. Offene Tabs und Gruppen bleiben als normale Edge-Gruppen erhalten.
- **Rollback:** Ordner durch die ältere Version ersetzen → ⟳. Ändert sich zwischen den Versionen das Vorlagenformat (siehe Changelog), danach die gesicherte Datei importieren.
- Edge-Einstellungen (Start, Boost, Hintergrundmodus) bei Bedarf zurückstellen.
