const express = require("express");
const { execFile } = require("child_process");
const path = require("path");

const APP = express();
const PORT = process.env.PORT || 3000;
const RECHT_BIN = "recht";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const ERROR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE = new Map();

// Periodically clean up expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of CACHE.entries()) {
    const ttl = entry.response.error ? ERROR_CACHE_TTL : CACHE_TTL;
    if (now - entry.timestamp > ttl) {
      CACHE.delete(key);
    }
  }
}, CACHE_TTL);

// ---------- REST API
APP.get("/map", (req, res) => {
  const q = (req.query.q || "").trim(); // z.B. "111 BGB" oder "1 4 BGB"
  if (!q) return res.status(400).json({ error: "Parameter q fehlt" });

  const cachedEntry = CACHE.get(q);
  if (cachedEntry) {
    const ttl = cachedEntry.response.error ? ERROR_CACHE_TTL : CACHE_TTL;
    if (Date.now() - cachedEntry.timestamp < ttl) {
      const { response } = cachedEntry;
      if (response.error) {
        return res.status(500).json(response);
      }
      return res.json(response);
    }
  }

  // eingabe splitten und an recht übergeben
  const args = ["get", ...q.split(/\s+/)];

  execFile(RECHT_BIN, args, (err, stdout, stderr) => {
    if (err) {
      console.error("recht fehlgeschlagen:", stderr || err);
      const errorResponse = { error: "Vorschrift nicht gefunden" };
      CACHE.set(q, { response: errorResponse, timestamp: Date.now() });
      return res.status(500).json(errorResponse);
    }
    const response = { url: stdout.toString().trim() };
    CACHE.set(q, { response, timestamp: Date.now() });
    res.json(response);
  });
});

// ---------- Test-Frontend
APP.use(express.static(path.join(__dirname, "public")));

// starten
APP.listen(PORT, "0.0.0.0", () =>
  console.log(`recht-API läuft auf http://localhost:${PORT}`)
);
