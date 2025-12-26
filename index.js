const express = require("express");
const { execFile } = require("child_process");
const path = require("path");

const RECHT_BIN = process.env.RECHT_BIN || "recht";
const PORT = process.env.PORT || 3000;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const ERROR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_LIMIT = Number(process.env.RECHT_CACHE_LIMIT) || 500;
const REQUEST_TIMEOUT_MS = Number(process.env.RECHT_TIMEOUT_MS) || 5000;
const MAX_BUFFER_BYTES = Number(process.env.RECHT_MAX_BUFFER) || 1024 * 50;
const VALID_SEGMENT_REGEX = /^[0-9]+[a-zA-Z]?$/;

class ResponseCache {
  constructor(limit) {
    this.limit = limit;
    this.store = new Map();
  }

  _buildEntry(value) {
    return {
      value,
      expiresAt: Date.now() + (value.error ? ERROR_CACHE_TTL : CACHE_TTL),
    };
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, this._buildEntry(value));
    if (this.store.size > this.limit) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
  }

  pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

const APP = express();
const CACHE = new ResponseCache(CACHE_LIMIT);

setInterval(() => CACHE.pruneExpired(), CACHE_TTL).unref();

function normalizeQuery(query) {
  if (!query) return null;
  const tokens = query.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  const lawCode = tokens[0]
    .replace(/[^A-Za-zÄÖÜäöüß]/g, "")
    .toUpperCase();
  if (!lawCode) return null;

  const segments = tokens.slice(1).map((segment) => segment.trim());
  if (segments.some((segment) => !VALID_SEGMENT_REGEX.test(segment))) {
    return null;
  }

  const normalizedSegments = segments.map((segment) =>
    segment.replace(/^0+(?=\d)/, "").toUpperCase()
  );

  const cacheKey = `${lawCode} ${normalizedSegments.join(" ")}`;
  const args = ["get", lawCode, ...normalizedSegments];
  return { cacheKey, args };
}

// ---------- REST API
APP.get("/map", async (req, res) => {
  const runner = APP.locals.runRecht || runRecht;
  const result = await lookupLaw(req.query.q || "", runner);
  res.status(result.status).json(result.body);
});

function buildSuccessPayload(stdout) {
  const raw = stdout.toString().trim();
  const [firstLine, ...rest] = raw.split(/\r?\n/);
  let url = null;
  try {
    url = new URL(firstLine).toString();
  } catch (e) {
    url = null;
  }

  const text = url ? rest.join("\n").trim() : raw;
  return {
    url,
    text,
  };
}

function buildErrorResponse(err) {
  if (err.code === "ENOENT") {
    return {
      status: 500,
      error: "recht-Binary wurde nicht gefunden",
    };
  }
  if (err.killed || err.signal === "SIGTERM" || err.code === "ETIMEDOUT") {
    return {
      status: 504,
      error: "recht-Antwort hat zu lange gedauert",
    };
  }

  console.error("recht fehlgeschlagen:", stderrForLog(err));
  return {
    status: 500,
    error: "Vorschrift nicht gefunden",
  };
}

function stderrForLog(err) {
  if (err.stderr) return err.stderr.toString();
  if (err.message) return err.message;
  return String(err);
}

function runRecht(args) {
  return new Promise((resolve, reject) => {
    execFile(
      RECHT_BIN,
      args,
      { timeout: REQUEST_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES },
      (err, stdout, stderr) => {
        if (err) {
          err.stderr = stderr;
          reject(err);
          return;
        }
        resolve(stdout);
      }
    );
  });
}

async function lookupLaw(query, runner = APP.locals.runRecht || runRecht) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return {
      status: 400,
      body: {
        error: "Bitte eine Vorschrift plus Nummer angeben (z.B. BGB 1).",
      },
    };
  }

  const cachedResponse = CACHE.get(normalized.cacheKey);
  if (cachedResponse) {
    return cachedResponse.error
      ? {
          status: cachedResponse.status || 500,
          body: { error: cachedResponse.error },
        }
      : { status: 200, body: cachedResponse };
  }

  try {
    const stdout = await runner(normalized.args);
    const payload = buildSuccessPayload(stdout);
    CACHE.set(normalized.cacheKey, payload);
    return { status: 200, body: payload };
  } catch (err) {
    const errorResponse = buildErrorResponse(err);
    CACHE.set(normalized.cacheKey, errorResponse);
    return {
      status: errorResponse.status || 500,
      body: { error: errorResponse.error },
    };
  }
}

// ---------- Test-Frontend
APP.use(express.static(path.join(__dirname, "public")));

// starten
if (require.main === module) {
  APP.listen(PORT, "0.0.0.0", () =>
    console.log(`recht-API läuft auf http://localhost:${PORT}`)
  );
}

module.exports = { APP, normalizeQuery, ResponseCache, lookupLaw };
