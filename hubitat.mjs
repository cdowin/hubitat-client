// Hubitat client — ESM, zero dependencies (Node 18+ global fetch).
//
// Talks to a Hubitat Elevation hub over the LAN using its web-UI endpoints
// (reverse-engineered, not the official Maker API). Works when the hub's "Hub
// Login Security" is disabled — the endpoints take no auth in that mode.
//
// Layering: constants.mjs (literals) <- http.mjs (transport) <- this facade (API).
// Split a concern into its own resource module only once it grows real logic;
// today these are thin groupings over one transport, so one class is simpler.

import { HttpClient } from "./http.mjs";
import {
  DEFAULT_BASE_URL, ENDPOINT, COMMAND, ARG_TYPE,
  LOCATION_FORM_FIELD, LOCATION_MODE_FIELD, RUN_METHOD_FIELD, DEFAULT_EVENTS_MAX,
} from "./constants.mjs";

const argTypeFor = (val) => (typeof val === "number" ? ARG_TYPE.NUMBER : ARG_TYPE.STRING);

export class Hubitat {
  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.http = new HttpClient(baseUrl);
  }

  // ---------------------------------------------------------------- reads ---

  hubDetails() { return this.http.getJson(ENDPOINT.HUB_DETAILS); }
  location()   { return this.http.getJson(ENDPOINT.LOCATION); }

  /** Installed apps, flattened: [{id, name, type, disabled}]. Real fields are under `.data`. */
  async listApps() {
    const data = await this.http.getJson(ENDPOINT.APPS_LIST);
    return (data.apps ?? []).map(({ data: a }) => ({ id: a.id, name: a.name, type: a.type, disabled: !!a.disabled }));
  }

  /** All devices, flattened: [{id, name, type, room, states:{key:value}}]. */
  async listDevices() {
    const data = await this.http.getJson(ENDPOINT.DEVICES_LIST);
    return (data.devices ?? []).map(({ data: d }) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      room: d.roomName || null,
      states: Object.fromEntries((d.currentStates ?? []).map((s) => [s.key, s.value])),
    }));
  }

  /** Find one device by id, label, or case-insensitive name substring. */
  async findDevice(query) {
    const devs = await this.listDevices();
    if (typeof query === "number" || /^\d+$/.test(query)) {
      return devs.find((d) => d.id === Number(query)) ?? null;
    }
    const q = String(query).toLowerCase();
    return devs.find((d) => d.name.toLowerCase() === q)
        ?? devs.find((d) => d.name.toLowerCase().includes(q)) ?? null;
  }

  /** Full device detail incl. available commands. */
  async device(id) {
    const d = await this.http.getJson(ENDPOINT.DEVICE_DETAIL(id));
    return {
      id: d.device?.id ?? id,
      name: d.device?.label ?? d.device?.name,
      type: d.device?.typeName ?? d.device?.type,
      states: d.deviceState ?? d.device?.currentStates,
      commands: (d.commands ?? []).map((c) => ({ name: c.name, parameters: c.parameters ?? [] })),
      raw: d,
    };
  }

  events(id, max = DEFAULT_EVENTS_MAX) { return this.http.getJson(ENDPOINT.DEVICE_EVENTS(id, max)); }

  // ------------------------------------------------------------- location ---

  zipLookup(zip) { return this.http.getJson(ENDPOINT.ZIP_LOOKUP(zip)); }

  /**
   * Patch hub location/settings. Round-trips ALL current fields and overrides
   * only the keys you pass, so unrelated settings are never clobbered.
   * NOTE: changing timeZone triggers a hub reboot prompt — avoid unless intended.
   * Accepts the keys of LOCATION_FORM_FIELD (name, timeZone, latitude, ...).
   */
  async updateLocation(patch = {}) {
    const details = await this.hubDetails();
    const current = Object.fromEntries(
      Object.entries(LOCATION_FORM_FIELD).map(([field, source]) => [field, details[source]]),
    );
    return this.http.postForm(ENDPOINT.LOCATION_UPDATE, { ...current, ...patch });
  }

  /** Look up a US zip and set zip/lat/lon from it in one call. */
  async setLocationByZip(zip) {
    const z = await this.zipLookup(zip);
    return this.updateLocation({ zipCode: String(zip), latitude: z.latitude, longitude: z.longitude });
  }

  setMode(mode) { return this.http.postForm(ENDPOINT.LOCATION_MODE_UPDATE, { [LOCATION_MODE_FIELD]: mode }); }

  // ------------------------------------------------------------- commands ---

  /**
   * Send a device command via /device/runmethod.
   * @param {number} id        device id
   * @param {string} method    command name (use COMMAND.*)
   * @param {Array}  args       positional arguments
   * @param {Array<string>} argTypes  optional explicit ARG_TYPE per arg; inferred otherwise.
   */
  async sendCommand(id, method, args = [], argTypes = null) {
    const params = { [RUN_METHOD_FIELD.ID]: String(id), [RUN_METHOD_FIELD.METHOD]: method };
    args.forEach((val, i) => {
      const n = i + 1; // Hubitat arg indices are 1-based
      params[RUN_METHOD_FIELD.argType(n)] = argTypes?.[i] ?? argTypeFor(val);
      params[RUN_METHOD_FIELD.arg(n)] = val == null ? "" : val;
    });
    // /device/runmethod returns the device's HTML page on success, not JSON.
    const r = await this.http.postForm(ENDPOINT.RUN_METHOD, params);
    return typeof r === "string" ? { success: true, id, method, args } : r;
  }

  // Convenience wrappers for the common Hue/Ecobee commands on this hub.
  on(id)  { return this.sendCommand(id, COMMAND.ON); }
  off(id) { return this.sendCommand(id, COMMAND.OFF); }
  refresh(id) { return this.sendCommand(id, COMMAND.REFRESH); }
  setLevel(id, level, duration) {
    const args = duration == null ? [level] : [level, duration];
    return this.sendCommand(id, COMMAND.SET_LEVEL, args, [ARG_TYPE.NUMBER, ARG_TYPE.NUMBER]);
  }
  setColorTemperature(id, kelvin) { return this.sendCommand(id, COMMAND.SET_COLOR_TEMPERATURE, [kelvin], [ARG_TYPE.NUMBER]); }
  setHue(id, hue)                 { return this.sendCommand(id, COMMAND.SET_HUE, [hue], [ARG_TYPE.NUMBER]); }
  setSaturation(id, sat)          { return this.sendCommand(id, COMMAND.SET_SATURATION, [sat], [ARG_TYPE.NUMBER]); }
  setHeatingSetpoint(id, temp)    { return this.sendCommand(id, COMMAND.SET_HEATING_SETPOINT, [temp], [ARG_TYPE.NUMBER]); }
  setCoolingSetpoint(id, temp)    { return this.sendCommand(id, COMMAND.SET_COOLING_SETPOINT, [temp], [ARG_TYPE.NUMBER]); }
}

export { COMMAND, ARG_TYPE, MODE, DEVICE_TYPE } from "./constants.mjs";
export default Hubitat;
