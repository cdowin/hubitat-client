// All literals in one place — no magic strings/numbers elsewhere.
// Paths and form fields target the Hubitat web-UI endpoints (platform 2.4.x);
// update here if a future hub firmware changes them.

// Hubitat hubs advertise themselves via mDNS as `hubitat.local`. Override with
// the HUBITAT_URL env var or by passing a base URL to the Hubitat constructor.
export const DEFAULT_BASE_URL = "http://hubitat.local";

export const TIMEOUT_MS = { GET: 10_000, POST: 12_000 };

export const HTTP_METHOD = { GET: "GET", POST: "POST" };
export const HEADER = { CONTENT_TYPE: "Content-Type", REQUESTED_WITH: "X-Requested-With" };
export const CONTENT_TYPE_FORM = "application/x-www-form-urlencoded";
export const XHR = "XMLHttpRequest";

export const DEFAULT_EVENTS_MAX = 20;

// Endpoints: static strings, or builders for parameterized paths.
export const ENDPOINT = {
  HUB_DETAILS: "/hub/details/json",
  LOCATION: "/location/data",
  LOCATION_UPDATE: "/location/update",
  LOCATION_MODE_UPDATE: "/location/mode/update",
  ZIP_LOOKUP: (zip) => `/location/zipcodelookup/${zip}`,
  DEVICES_LIST: "/hub2/devicesList",
  DEVICE_DETAIL: (id) => `/device/fullJson/${id}`,
  DEVICE_EVENTS: (id, max) => `/device/eventsJson/${id}?max=${max}`,
  APPS_LIST: "/hub2/appsList",
  RUN_METHOD: "/device/runmethod",
};

// Argument types for /device/runmethod (argType.N field).
export const ARG_TYPE = { NUMBER: "NUMBER", STRING: "STRING", ENUM: "ENUM", BOOL: "BOOL" };

// Common device command names. Availability depends on the device's driver —
// check device(id).commands for what a given device actually supports.
export const COMMAND = {
  ON: "on",
  OFF: "off",
  REFRESH: "refresh",
  SET_LEVEL: "setLevel",
  SET_COLOR_TEMPERATURE: "setColorTemperature",
  SET_HUE: "setHue",
  SET_SATURATION: "setSaturation",
  SET_HEATING_SETPOINT: "setHeatingSetpoint",
  SET_COOLING_SETPOINT: "setCoolingSetpoint",
};

// Hubitat's default location modes. Your hub may define different ones —
// read location().modes for the authoritative list.
export const MODE = { DAY: "Day", EVENING: "Evening", NIGHT: "Night", AWAY: "Away" };

// Selected device `type` values from /hub2/devicesList, for filtering by kind.
// Hue bulbs share a prefix: hueBridgeBulb, hueBridgeBulbCT, hueBridgeBulbRGBW.
export const DEVICE_TYPE = {
  HUE_BULB_PREFIX: "hueBridgeBulb",
  HUE_PLUG: "hueBridgePlug",
  HUE_BRIDGE: "hueBridge",
  ECOBEE_THERMOSTAT: "Ecobee Thermostat",
  ECOBEE_SENSOR: "Ecobee Sensor",
  CHROMECAST: "Chromecast Video",
  OPEN_WEATHER: "OpenWeatherMap",
};

// /location/update is a full-form POST; we round-trip every field to avoid
// clobbering unrelated settings. Keys = form field names, values = where the
// current value lives in /hub/details/json.
export const LOCATION_FORM_FIELD = {
  name: "hubName",
  timeZone: "timeZone",
  latitude: "latitude",
  longitude: "longitude",
  clock: "timeFormat",
  zipCode: "zipCode",
  temperatureScale: "tempScale",
  voice: "ttsCurrent",
  mdnsName: "mdnsName",
};

export const LOCATION_MODE_FIELD = "mode";

// /device/runmethod form fields (arg indices are 1-based).
export const RUN_METHOD_FIELD = {
  ID: "id",
  METHOD: "method",
  argType: (i) => `argType.${i}`,
  arg: (i) => `arg[${i}]`,
};
