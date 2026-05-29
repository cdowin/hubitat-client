// Zero-dependency tests using Node's built-in runner: `node --test`.
// No network — a fake transport/fetch is injected.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Hubitat } from "../hubitat.mjs";
import { HttpClient } from "../http.mjs";
import { DEFAULT_BASE_URL, ENDPOINT, ARG_TYPE } from "../constants.mjs";

// A fake transport that records calls and returns canned responses keyed by path.
class FakeHttp {
  constructor(responses = {}) {
    this.responses = responses;
    this.calls = [];
  }
  async getJson(path) {
    this.calls.push({ kind: "getJson", path });
    return this.responses[path];
  }
  async postForm(path, params) {
    this.calls.push({ kind: "postForm", path, params });
    return this.responses[path] ?? "";
  }
}

test("base URL resolution: explicit arg > env > default", () => {
  const prev = process.env.HUBITAT_URL;
  try {
    delete process.env.HUBITAT_URL;
    assert.equal(new HttpClient(new Hubitat().http.base).base, DEFAULT_BASE_URL.replace(/\/$/, ""));

    process.env.HUBITAT_URL = "http://from-env:8080";
    assert.equal(new Hubitat().http.base, "http://from-env:8080");

    assert.equal(new Hubitat("http://explicit").http.base, "http://explicit");
  } finally {
    if (prev === undefined) delete process.env.HUBITAT_URL;
    else process.env.HUBITAT_URL = prev;
  }
});

test("listDevices flattens the .data wrapper and folds currentStates", async () => {
  const fake = new FakeHttp({
    [ENDPOINT.DEVICES_LIST]: {
      devices: [
        { data: { id: 7, name: "Bed-1", type: "hueBridgeBulbRGBW", roomName: "", currentStates: [{ key: "switch", value: "on" }, { key: "level", value: 40 }] } },
      ],
    },
  });
  const [dev] = await new Hubitat("http://x", fake).listDevices();
  assert.deepEqual(dev, { id: 7, name: "Bed-1", type: "hueBridgeBulbRGBW", room: null, states: { switch: "on", level: 40 } });
});

test("listApps unwraps .data (regression guard for the top-level-id trap)", async () => {
  const fake = new FakeHttp({
    [ENDPOINT.APPS_LIST]: { apps: [{ id: 16, data: { id: 16, name: "Basic Rules", type: "Basic Rules", disabled: false } }] },
  });
  const [app] = await new Hubitat("http://x", fake).listApps();
  assert.deepEqual(app, { id: 16, name: "Basic Rules", type: "Basic Rules", disabled: false });
});

test("sendCommand encodes 1-based arg/argType fields and infers types", async () => {
  const fake = new FakeHttp();
  await new Hubitat("http://x", fake).sendCommand(9, "setLevel", [40, "fast"]);
  const { path, params } = fake.calls.at(-1);
  assert.equal(path, ENDPOINT.RUN_METHOD);
  assert.equal(params.id, "9");
  assert.equal(params.method, "setLevel");
  assert.equal(params["argType.1"], ARG_TYPE.NUMBER); // inferred from number
  assert.equal(params["arg[1]"], 40);
  assert.equal(params["argType.2"], ARG_TYPE.STRING); // inferred from string
  assert.equal(params["arg[2]"], "fast");
});

test("sendCommand returns {success:true} when the hub replies with HTML", async () => {
  const fake = new FakeHttp({ [ENDPOINT.RUN_METHOD]: "<!doctype html>..." });
  const res = await new Hubitat("http://x", fake).off(22);
  assert.deepEqual(res, { success: true, id: 22, method: "off", args: [] });
});

test("setLevel forces NUMBER arg types", async () => {
  const fake = new FakeHttp();
  await new Hubitat("http://x", fake).setLevel(9, 30);
  const { params } = fake.calls.at(-1);
  assert.equal(params["argType.1"], ARG_TYPE.NUMBER);
  assert.equal(params["arg[1]"], 30);
});

test("updateLocation round-trips current settings and overrides only the patch", async () => {
  const fake = new FakeHttp({
    [ENDPOINT.HUB_DETAILS]: { hubName: "Hub", timeZone: "America/New_York", latitude: 1, longitude: 2, timeFormat: "12", zipCode: "00000", tempScale: "F", ttsCurrent: "Matthew", mdnsName: "hubitat" },
    [ENDPOINT.LOCATION_UPDATE]: { success: true },
  });
  await new Hubitat("http://x", fake).updateLocation({ zipCode: "90210" });
  const { params } = fake.calls.at(-1);
  assert.equal(params.zipCode, "90210");       // overridden
  assert.equal(params.timeZone, "America/New_York"); // preserved
  assert.equal(params.name, "Hub");             // mapped from hubName
});

test("HttpClient.getJson parses JSON, falls back to text, and throws on !ok", async () => {
  const ok = (body) => async () => ({ ok: true, text: async () => body });
  assert.deepEqual(await new HttpClient("http://x/", { fetchImpl: ok('{"a":1}') }).getJson("/p"), { a: 1 });
  assert.equal(await new HttpClient("http://x", { fetchImpl: ok("<html>") }).getJson("/p"), "<html>");

  const notOk = async () => ({ ok: false, status: 503, text: async () => "" });
  await assert.rejects(() => new HttpClient("http://x", { fetchImpl: notOk }).getJson("/p"), /HTTP 503/);
});

test("HttpClient trims a trailing slash from the base URL", () => {
  assert.equal(new HttpClient("http://x:8080/").base, "http://x:8080");
});
