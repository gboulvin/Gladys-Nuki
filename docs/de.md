# Nuki für Gladys Assistant

Steuern Sie Ihre **Nuki**-Geräte mit Gladys: Smart Lock (alle Generationen, 3.0 Pro, 4. Generation, Ultra), Smart Door und Opener — verriegeln, entriegeln, die Tür öffnen,
Batterien, Türsensor und Keypad überwachen und in Szenen auf jeden Vorgang reagieren.

## Wählen, wie Gladys mit Ihren Nuki-Geräten spricht

Die Integration unterstützt drei Kanäle. Konfigurieren Sie **mindestens einen**; Sie
können sie kombinieren.

| Kanal           | Typ              | Geräte                                           | Was er bietet                                                                  |
| --------------- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Nuki Bridge** | Lokal (HTTP)     | Alle Smart Locks, Smart Doors und Opener         | Funktioniert ohne Internet, Klingelerkennung des Openers                       |
| **MQTT**        | Lokal (Echtzeit) | Smart Lock 3.0 Pro, 4. Generation, Ultra         | Sofortige Updates ohne Abfrage, wer/wie bei jedem Vorgang (Knopf, Keypad…)     |
| **Nuki Web**    | Cloud            | Alle mit Ihrem Nuki-Web-Konto verknüpften Geräte | Wer das Schloss bedient hat (Name, Keypad, Fingerabdruck), Aktivitätsprotokoll |

Erreichen mehrere Kanäle ein Gerät, nutzt Gladys zuerst den **lokalen** (MQTT, dann die
Bridge) und weicht bei einem Fehler auf den anderen aus. Deaktivieren Sie **Lokale
Verbindung bevorzugen** in der Konfiguration, um zuerst Nuki Web zu nutzen. Das Abzeichen
jedes Geräts zeigt den verwendeten Kanal: _Lokal_, _Cloud_ oder _Nicht erreichbar_; ein
orangefarbener Punkt bedeutet einen Ausweichbetrieb (z. B. Bridge offline, stattdessen
Nuki Web).

## Einrichtung

### Nuki Bridge (lokal)

1. Öffnen Sie in der **Nuki-App** _Bridge verwalten_ und aktivieren Sie die **HTTP-API**.
2. Öffnen Sie in Gladys die Konfiguration der Nuki-Integration und klicken Sie auf **Meine
   Bridge finden**: die IP-Adresse wird eingetragen (oder geben Sie sie ein, sie steht in
   der Nuki-App).
3. Klicken Sie auf **Bridge koppeln** und **drücken Sie dann innerhalb von 30 Sekunden den
   Knopf der Bridge**: das API-Token wird automatisch gespeichert. Sie können auch das in
   der App angezeigte Token übernehmen.
4. Lassen Sie **Token gehasht senden** aktiviert (Bridge-Firmware 1.13 oder neuer): das
   Token wird nie im Klartext übertragen.

> Geben Sie der Bridge im Router eine feste IP-Adresse: ändert sie sich, starten Sie
> **Meine Bridge finden** erneut.

### MQTT (lokal, Smart Lock 3.0 Pro / 4.0 / Ultra)

1. Sie benötigen einen MQTT-Broker (Mosquitto…). Der der Gladys-MQTT-Integration funktioniert.
2. Öffnen Sie in der **Nuki-App** die Schloss-Einstellungen → _Funktionen & Konfiguration_ →
   **MQTT**, aktivieren Sie es und tragen Sie **IP-Adresse**, Port, Benutzer und Passwort
   des Brokers ein.
3. Geben Sie in Gladys die **URL des MQTT-Brokers** (z. B. `mqtt://192.168.1.10:1883`),
   Benutzer und Passwort ein. Die Schlösser erscheinen innerhalb von Sekunden.

### Nuki Web (Cloud)

1. Aktivieren Sie **Nuki Web** für Ihre Geräte in der Nuki-App.
2. Öffnen Sie auf [web.nuki.io](https://web.nuki.io/) **API** und erzeugen Sie ein
   **API-Token** mit mindestens den Rechten _Smartlock_, _Smartlock action_ und
   _Smartlock log_.
3. Fügen Sie es in **Nuki Web API-Token** ein.

### Geräte anlegen

Öffnen Sie den Tab **Erkennung** der Integration und legen Sie die gewünschten Geräte an.
Koppeln Sie später einen Türsensor oder ein Keypad, bietet der Tab an, das Gerät zu
aktualisieren.

## Optionen

- **Aktualisierungsintervall**: wie oft die Bridge abgefragt wird (mindestens 10 s,
  Standard 30 s). Nuki Web wird höchstens alle 30 Sekunden und nur bei Bedarf abgefragt.
  MQTT braucht keine Abfrage.
- **Wenn Gladys entriegelt**: _Nur entriegeln_ (Standard) oder _Entriegeln und Tür öffnen_.
- **Wenn Gladys verriegelt**: _Verriegeln_ (Standard) oder _Doppelt verriegeln_ (zwei
  Umdrehungen, ab Smart Lock 3.0; bei älteren Modellen einfach verriegeln).

## Geräte und Funktionen

**Smart Lock / Smart Door**

| Funktion           | Beschreibung                                           |
| ------------------ | ------------------------------------------------------ |
| Schloss            | Schalter: 1 = verriegelt, 0 = entriegelt (steuerbar)   |
| Schlosszustand     | Verriegelt / entriegelt / in Bewegung / Fehler         |
| Batterie           | Ladestand in %                                         |
| Batterie schwach   | Warnung bei kritischer Batterie                        |
| Lädt               | Laden des Power Packs (ab 3.0)                         |
| Tür                | Offen / geschlossen (wenn ein Türsensor gekoppelt ist) |
| Türsensor-Batterie | (wenn ein Türsensor gekoppelt ist)                     |
| Keypad-Batterie    | (wenn ein Keypad gekoppelt ist)                        |

**Opener**: Schalter _Ring to Open_ und _Daueröffnung_, _Batterie schwach_ und _Klingel_
(Klingelerkennung über die Bridge).

## Szenen

### Auslöser

- **Nuki-Schloss bedient** — ein Schloss wurde ver-, entriegelt, geöffnet oder hat Lock 'n'
  Go genutzt. Filtern Sie nach Schloss, Vorgang, **wie** es bedient wurde (App, von Hand,
  Knopf, Keypad, Fingerabdruck, Auto-Lock, Nuki Web, HomeKit, MQTT, Gladys…) und nach dem
  **Nuki-Benutzer** (mit Nuki Web). Variablen: `action`, `trigger`, `user`, `device_name`.
  _Beispiel: „wenn Alice die Haustür per Keypad entriegelt, Alarm ausschalten“._
- **Nuki Opener: es hat geklingelt** — jemand hat an der Sprechanlage geklingelt (Opener
  mit Bridge).
- **Problem mit Nuki-Schloss** — Motor blockiert, Schloss nicht kalibriert oder Befehl
  abgelehnt.
- **Nuki-Batterie kritisch** — die Batterie eines Schlosses, Openers, Keypads oder
  Türsensors ist schwach.

Von Gladys selbst ausgelöste Vorgänge werden mit dem Auslöser `gladys` gemeldet: schließen
Sie ihn im Filter aus, damit eine Szene nicht auf ihre eigenen Aktionen reagiert.

### Aktionen

- **Nuki-Schloss bedienen** — verriegeln, entriegeln, Tür öffnen, Lock 'n' Go, doppelt
  verriegeln. Ausgabe: `success`.
- **Nuki Opener bedienen** — Türsummer, Ring to Open ein/aus, Daueröffnung ein/aus.
  Ausgabe: `success`.
- **Nuki-Gerät auslesen** — Ausgaben `locked`, `state`, `door_open`, `battery`,
  `battery_critical`, `reachable` für die folgenden Aktionen (z. B. Nachricht „die Tür ist
  noch entriegelt“).
- **Alle Nuki-Schlösser verriegeln** — Ausgaben `locked_count` und `failed_count`.

Der Standard-Auslöser „Gerätezustand“ von Gladys funktioniert ebenfalls für jede Funktion
(Tür geöffnet, Batterie unter 20 %…).

## Dashboard-Widgets

- **Nuki-Schloss** — ein Schloss oder Opener: Zustand, Live-Batterie, Tür, Zubehör, Kanal,
  letzte Aktivität und Tasten _Verriegeln_ / _Entriegeln_ / _Tür öffnen_ (das Öffnen
  verlangt eine Bestätigung). Beim Opener: _Öffnen_ und _Ring to Open_.
- **Nuki-Übersicht** — alle Nuki-Geräte auf einen Blick und eine Taste **Alle verriegeln**.
- **Nuki-Aktivität** — die letzten Vorgänge: wer, wie und wann (aus Nuki Web, falls
  konfiguriert, sonst aus den Beobachtungen der Integration).

## Fehlerbehebung

- **„The Nuki Bridge refused the API token“**: koppeln Sie die Bridge erneut oder
  deaktivieren Sie _Token gehasht senden_, wenn die Bridge-Firmware älter als 1.13 ist.
- **„Nuki Bridge unreachable“**: prüfen Sie die IP-Adresse und ob die HTTP-API aktiviert
  ist. Die Bridge bearbeitet eine Anfrage nach der anderen: vermeiden Sie, dass andere
  Software sie zu oft abfragt.
- **MQTT: kein Schloss erscheint**: prüfen Sie in der Nuki-App, dass MQTT verbunden ist,
  das Schloss die **IP-Adresse** des Brokers nutzt und Gladys denselben Broker verwendet.
- **Kein Benutzername in den Auslösern**: die Namen kommen von Nuki Web; fügen Sie ein
  API-Token hinzu.
- Die Taste **Verbindung testen** prüft jeden konfigurierten Kanal und zeigt, was funktioniert.

## Datenschutz und Sicherheit

Tokens und Passwörter werden von Gladys als Geheimnisse gespeichert und nie protokolliert.
Das Bridge-Token wird standardmäßig gehasht gesendet. Nuki Web wird nur kontaktiert, wenn
Sie ein API-Token konfigurieren. Der Aktivitätsverlauf liegt im eigenen Datenvolume der
Integration.
