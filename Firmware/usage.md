# Bedienung des Hardware-Saugers (ESP32-Steuerung)

Diese Anleitung beschreibt die **Bedienung am Gerät** und über **WLAN/Web** — ohne Build- oder Flash-Schritte. Für Entwicklung und Upload siehe [README.md](README.md).

---

## Kurzüberblick

- **Trigger-Taste:** Motor ein (gedrückt halten) / aus (loslassen).
- **Hoch / Runter:** Leistungsstufe in **20 %-Schritten** (0 %, 20 %, …, 100 %).
- **Display:** zeigt Spannung, Drehzahl (während der Motor per Trigger läuft), Leistungsbalken und Batterie-Anzeige.
- **LED-Leiste:** zeigt nach dem Start u. a. die gewählte Stufe; Farbe wechselt je nach Motorzustand.
- **WLAN:** Gerät verbindet sich zuerst mit dem konfigurierten Netz; schlägt das fehl, startet es einen **eigenen Hotspot**.
- **Weboberfläche:** Steuerung und Live-Daten im Browser unter der Geräte-IP.
- **Info-Modus (Display):** **Hoch + Runter** etwa **3 Sekunden gleichzeitig halten** → Zusatzseiten mit Akku, WLAN und Systemdaten.

---

## Tasten

| Taste | Funktion im normalen Betrieb |
|--------|------------------------------|
| **Trigger** | Motor läuft, solange die Taste gedrückt ist. Loslassen stoppt den Motor (unabhängig von der Web-UI, solange der Trigger die Priorität hat — siehe unten). |
| **Hoch** | Leistung um eine Stufe erhöhen (+20 %), maximal 100 %. |
| **Runter** | Leistung um eine Stufe verringern (−20 %), minimal 0 %. |

**Hinweis:** Wenn **Hoch und Runter zugleich** gedrückt sind, wird **keine** Stufe geändert (damit der Info-Modus zuverlässig erreichbar ist).

---

## LED-Leiste (5 RGB-LEDs)

- Beim **Einschalten / WLAN-Aufbau:** typischerweise **pulsierendes Weiß** (Suche/Verbindung).
- **Mit WLAN verbunden (Router-Modus):** **Blau**, statisch.
- **Hotspot-Modus (Access Point):** **Orange**, statisch.
- Etwa **2 Sekunden nach dem Start:** Wechsel in die **Stufenanzeige** (Anzahl leuchtender LEDs entspricht der groben Stufe in 20 %-Schritten).
- **Trigger gedrückt (Motor aktiv):** Stufenanzeige in **Rot**; **ohne** Trigger in **Blau**.
- Bei **0 %** pulsiert typischerweise eine LED langsam (Leerlauf-Stufe).

---

## Display (0,91" oder 1,5", je nach Konfiguration)

### Hauptansicht

- **Oben:** Pack-Spannung in Volt **oder** — solange der **Trigger gedrückt** ist und die Drehzahl gültig ist — die **Drehzahl** (bzw. Platzhalter, wenn noch keine Messung da ist).
- **Balken:** aktuelle **Leistungsvorgabe** (0–100 %).
- **Batterie-Symbol:** grober **Ladezustand in %** (nur sinnvoll, wenn der Motor **nicht** läuft; während des Laufs wird oft `--%` und eine andere Füll-Animation gezeigt).

### Info-Modus (Zusatzseiten)

1. **Hoch** und **Runter** **gleichzeitig** etwa **3 Sekunden** halten, bis die Ansicht wechselt.
2. Mit **Hoch** / **Runter** zwischen **drei Seiten** wechseln (zyklisch):
   - **Akku:** Serien-Zellenzahl (Konfiguration), SOC (sofern angezeigt), Pack-Spannung.
   - **WLAN:** ob **Station (Router)** oder **Hotspot**, **IP-Adresse**, **Hostname**, **Netzwerkname** (SSID).
   - **System:** Laufzeit (Uptime), freier Heap-Speicher.
3. Mit **einem Druck auf den Trigger** wieder zur **Hauptansicht** zurück. **Im Info-Modus startet der Trigger den Motor nicht** — er beendet nur den Menümodus.

---

## WLAN und Zugriff im Browser

### Router-Modus (Station)

- Das Gerät nutzt die im Firmware-Quellcode hinterlegten **WLAN-Zugangsdaten** (siehe Modul `wifi`).
- Im Browser: **`http://<IP-Adresse>`** (Port 80) für die Weboberfläche.
- Optional: **`http://<DEVICE_HOSTNAME>.local`** (Hostname Standard: `osh-vac` — anpassbar in `src/settings/settings_config.h`, Eintrag `DEVICE_HOSTNAME`; Vorlage: `settings_config.example.h`), sofern mDNS im Netz funktioniert.

### Hotspot-Modus (Access Point)

- Wenn die Verbindung zum Router **nicht** zustande kommt, startet ein **eigener Hotspot** (Standard-SSID und Passwort stehen im `wifi`-Modul, siehe README / Quellcode).
- Die Weboberfläche erreichen Sie dann typischerweise unter der im Display (Info-Seite WLAN) oder am **seriellen Log** angezeigten **AP-IP** (häufig ein **192.168.4.x**-Adressbereich).

### Serielle Zusammenfassung nach dem Start

- Nach dem Boot erscheint eine Zeile mit **`[BOOT]`**, **Modus** (STA oder AP) und **IP** — praktisch, wenn kein Display angeschlossen ist (USB-Serial, 115200 Baud).

### OTA-Update (Firmware über PlatformIO / ArduinoOTA)

- Voraussetzung: Gerät im gleichen Netz wie der PC, WLAN läuft (STA oder Sie nutzen die AP-IP).
- Build: `pio run` (im Ordner `Firmware/`).
- Wireless-Upload: `pio run -e esp32-s3-ota -t upload --upload-port <Hostname>.local` oder mit **Geräte-IP** statt mDNS.
- **Passwort und Hostname:** `OTA_HTTP_PASSWORD` und `DEVICE_HOSTNAME` in `src/settings/settings_config.h` müssen zur Umgebung **`esp32-s3-ota`** in `platformio.ini` passen (`--auth=…` = gleiches Passwort; `upload_port` = `<Hostname>.local` oder IP). Details und Tabelle: [README.md](README.md) → *OTA (ArduinoOTA / wireless upload)*.
- Nur nutzen, wenn Sie wissen, welches Image Sie einspielen — fehlerhafte Firmware kann ein erneutes Flashen per USB nötig machen.

---

## Weboberfläche und Live-Daten

- **HTTP:** Port **80** — Bedienung und Diagramme.
- **WebSocket:** Port **81** — liefert gebündelt z. B. Temperatur, Batteriespannung, Drehzahl, Stufe und Motorstatus (ein JSON-Objekt pro Intervall).

Details zum JSON-Format stehen in [README.md](README.md) im Abschnitt zur Web-Oberfläche.

**Hinweis:** Die **Web-UI** kann Motor und Stufe setzen. Der **physische Trigger** hat beim **Drücken** Vorrang (Motor an); beim **Loslassen** wird der Motor gestoppt, sobald keine andere Logik dem widerspricht — für den Alltag: zuerst Trigger loslassen, dann gezielt über die Web-UI arbeiten, wenn Sie nur remote steuern möchten.

---

## Sicherheit und Betrieb

- Hohe Drehzahlen und bewegte Teile: **Gerät nur mit Schutz** und nach Herstellervorgaben betreiben.
- **Akku und Hochvolt:** Kurzschluss und falsche Polarität vermeiden; nur passende Zellchemie und Schutzschaltungen verwenden.
- **OTA und Zugangsdaten:** Die dokumentierten Login-Daten sind **Standardwerte** — in exponierten Netzen sollten Sie Firmware/Secrets anpassen (Entwickler-Hinweis).

---

## Wo finde ich mehr?

| Thema | Dokument |
|--------|-----------|
| Bauen, Flashen, Frontend, Projektstruktur | [README.md](README.md) |
| NVS-Einstellungen (Display-Typ, Zellenzahl) | [README.md](README.md) → Konfiguration / `settings_config.example.h` → lokale `settings_config.h` |
| OTA (Wireless-Flash, Passwort/Hostname) | [README.md](README.md) → *OTA (ArduinoOTA / wireless upload)* |
