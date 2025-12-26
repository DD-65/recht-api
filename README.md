# Gesetze-Mapper

Mapped §-Angaben wie `111 BGB` oder `1 4 BGB` in Sekundenschnelle auf die
passende Gesetze-im-Internet-URL und gibt den Gesetzestext aus.

Funktionert dank [kmein/recht](https://github.com/kmein/recht).

Benötigt werden node.js und das Haskell-Skript von kmein.

## Konfiguration

Folgende Umgebungsvariablen steuern das Verhalten:

- `RECHT_BIN`: Pfad zum `recht`-Binary (Default: `recht` im `PATH`).
- `RECHT_CACHE_LIMIT`: Maximale Anzahl gecachter Antworten (Default: 500).
- `RECHT_TIMEOUT_MS`: Timeout in Millisekunden für `recht`-Aufrufe (Default: 5000).
- `RECHT_MAX_BUFFER`: Maximale Größe des stdout-Puffers für `recht` (Default: 51200 Bytes).

## Tests

```
npm test
```

Die Tests nutzen den Node.js-Test-Runner und mocken das `recht`-Binary, so dass kein echter Aufruf notwendig ist.
