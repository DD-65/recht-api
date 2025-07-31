const express   = require('express');
const { execFile } = require('child_process');
const path       = require('path');

const APP  = express();
const PORT = process.env.PORT || 3000;
const RECHT_BIN = 'recht';

// ---------- REST-Endpunkt -----------------------------------------------
APP.get('/map', (req, res) => {
  const q = (req.query.q || '').trim();        // z.B. "111 BGB" oder "1 4 BGB"
  if (!q) return res.status(400).json({ error: 'Parameter q fehlt' });

  // whitespace-geteilte Tokens an "recht path" übergeben
  const args = ["get", ...q.split(/\s+/)];

  execFile(RECHT_BIN, args, (err, stdout, stderr) => {
    if (err) {
      console.error('recht fehlgeschlagen:', stderr || err);
      return res.status(500).json({ error: 'Nicht gefunden oder recht-Fehler' });
    }
    res.json({ url: stdout.toString().trim() });
  });
});

// ---------- Statisches Test-Front-End -----------------------------------
APP.use(express.static(path.join(__dirname, 'public')));

// ---------- Start -------------------------------------------------------
APP.listen(PORT, () => console.log(`recht-API läuft auf http://localhost:${PORT}`));
