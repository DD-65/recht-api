const express = require("express");
const { execFile } = require("child_process");
const path = require("path");

const APP = express();
const PORT = process.env.PORT || 3000;
const RECHT_BIN = "recht";
const CACHE = new Map();

// ---------- REST API
APP.get("/map", (req, res) => {
  const q = (req.query.q || "").trim(); // z.B. "111 BGB" oder "1 4 BGB"
  if (!q) return res.status(400).json({ error: "Parameter q fehlt" });

  if (CACHE.has(q)) {
    return res.json(CACHE.get(q));
  }

  // eingabe splitten und an recht übergeben
  const args = ["get", ...q.split(/\s+/)];

  execFile(RECHT_BIN, args, (err, stdout, stderr) => {
    if (err) {
      console.error("recht fehlgeschlagen:", stderr || err);
      return res
        .status(500)
        .json({ error: "Nicht gefunden oder recht-Fehler" });
    }
    const response = { url: stdout.toString().trim() };
    CACHE.set(q, response);
    res.json(response);
  });
});

// ---------- Test-Frontend
APP.use(express.static(path.join(__dirname, "public")));

// starten
APP.listen(PORT, () =>
  console.log(`recht-API läuft auf http://localhost:${PORT}`)
);
