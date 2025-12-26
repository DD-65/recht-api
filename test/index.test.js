const test = require("node:test");
const assert = require("node:assert/strict");
const { lookupLaw, normalizeQuery } = require("../index");

test("normalizeQuery normalizes casing and padding", () => {
  const normalized = normalizeQuery("bGb 001a 04");
  assert.deepStrictEqual(normalized, {
    cacheKey: "BGB 1A 4",
    args: ["get", "BGB", "1A", "4"],
  });
});

test("normalizeQuery rejects incomplete or invalid input", () => {
  assert.equal(normalizeQuery("BGB"), null);
  assert.equal(normalizeQuery("BGB foo"), null);
});

test("lookupLaw returns the parsed payload for valid input", async () => {
  let receivedArgs = null;
  const runner = async (args) => {
    receivedArgs = args;
    return Buffer.from("https://example.test/bgb/1\n§ 1 BGB\nAbs. 1");
  };

  const response = await lookupLaw("bGb 001", runner);
  assert.deepStrictEqual(receivedArgs, ["get", "BGB", "1"]);
  assert.equal(response.status, 200);
  assert.equal(response.body.url, "https://example.test/bgb/1");
  assert.equal(response.body.text, "§ 1 BGB\nAbs. 1");
});

test("lookupLaw rejects incomplete queries", async () => {
  const response = await lookupLaw("foo");
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Vorschrift/);
});

test("lookupLaw surfaces backend failures", async () => {
  const runner = async () => {
    const err = new Error("missing binary");
    err.code = "ENOENT";
    throw err;
  };

  const response = await lookupLaw("HGB 2", runner);
  assert.equal(response.status, 500);
  assert.equal(response.body.error, "recht-Binary wurde nicht gefunden");
});

test("lookupLaw omits url when recht output lacks a valid link", async () => {
  const runner = async () => Buffer.from("§ 1 GG\nAbs. 1");
  const response = await lookupLaw("GG 1", runner);
  assert.equal(response.status, 200);
  assert.equal(response.body.url, null);
  assert.equal(response.body.text, "§ 1 GG\nAbs. 1");
});
