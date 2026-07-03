Befolge diese Schritte, um den Zugriff über die IP-Adresse freizuschalten:

##### Schritt 1: 
Windows-Systemumgebungsvariable setzen
Damit Ollama auf Anfragen von außen reagiert, muss eine spezielle Variable im Windows-System hinterlegt werden.
Drücke die Windows-Taste, tippe Umgebungsvariablen ein und öffne "Systemumgebungsvariablen bearbeiten".
Klicke unten auf den Button Umgebungsvariablen....
Klicke im unteren Bereich ("Systemvariablen") auf Neu....
Trage folgende Werte ein:
Name der Variablen: OLLAMA_HOST
Wert der Variablen: 0.0.0.0
Klicke bei allen Fenstern auf OK, um die Änderungen zu speichern.

##### Schritt 2: 
Ollama komplett neu starten
Die Variable wird erst nach einem vollständigen Neustart der App aktiv.
Suche das Ollama-Symbol unten rechts in deiner Windows-Taskleiste (System-Tray).
Mache einen Rechtsklick darauf und wähle Quit (Beenden).
Starte die Ollama-App über dein Startmenü neu.

##### Schritt 3: 
Windows-Firewall anpassen (Wichtig)
Die Windows-Firewall blockiert standardmäßig den Port 11434 für eingehende Verbindungen.
Drücke die Windows-Taste, tippe Windows Defender Firewall ein und öffne sie.
Klicke links auf Erweiterte Einstellungen.
Klicke links auf Eingehende Regeln und dann ganz rechts auf Neue Regel....
Wähle Port und klicke auf Weiter.
Wähle TCP und trage bei Bestimmte lokale Ports die Nummer 11434 ein. 
Klicke auf Weiter.
Wähle Verbindung zulassen und klicke auf Weiter.
Setze die Haken bei Domäne und Privat (setze den Haken bei Öffentlich aus Sicherheitsgründen nicht). 
Klicke auf Weiter.
Gib der Regel einen Namen (z. B. Ollama extern) und klicke auf Fertig stellen.

##### Schritt 4: 
Das Llama 3.2 Modell herunterladen
Stelle sicher, dass genau das von der Datei geforderte Modell (llama3.2) auf deinem PC installiert ist.
Öffne das Windows-Terminal oder die PowerShell.
Überprüfe mit ollama list, ob llama3.2 existiert.
Falls nicht, lade es mit folgendem Befehl herunter:
```
ollama run llama3.2
```
Testen der Verbindung:
```
curl http://192.168.2.84:11434
Get-Content "$env:LOCALAPPDATA\Ollama\server.log" -Wait -Tail 20
```