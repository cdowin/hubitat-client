# hubitat-client

A tiny, zero-dependency Node (ESM) client for the [Hubitat Elevation](https://hubitat.com/)
home-automation hub. List and inspect devices, read state, send commands, and
update hub settings — from scripts or the command line.

It talks to the hub's **local web-UI endpoints** over your LAN (reverse-engineered
from the hub's own UI on platform 2.4.x). It is **not** the official Maker API and
needs no token — it works when the hub's *Hub Login Security* is disabled.

## Requirements

- Node 18+ (uses the global `fetch`)
- A Hubitat hub reachable on your LAN, with Hub Login Security **off**

## Install

```bash
git clone https://github.com/cdowin/hubitat-client.git
cd hubitat-client
```

No `npm install` needed — there are no dependencies.

## Point it at your hub

Hubitat hubs advertise as `hubitat.local`, which is the default. If that doesn't
resolve on your network, set the hub's IP:

```bash
export HUBITAT_URL=http://192.168.1.50
```

## CLI

```bash
node cli.mjs devices            # list devices (id, type, key states)
node cli.mjs apps               # list installed apps
node cli.mjs device <id|name>   # full detail + available commands
node cli.mjs location           # current hub location/settings
node cli.mjs ziplookup 90210    # lat/lon/sunrise for a US zip
node cli.mjs events <id> [max]  # recent device events
```

### State-changing commands (guarded)

These change real devices, so they require an explicit `--yes`:

```bash
node cli.mjs on 7 --yes
node cli.mjs off 7 --yes
node cli.mjs level 9 40 --yes              # setLevel to 40%
node cli.mjs cmd 3 setHeatingSetpoint 70 --yes
node cli.mjs setmode Away --yes
```

## Library use

```js
import { Hubitat, DEVICE_TYPE, COMMAND } from "./hubitat.mjs";

const hub = new Hubitat();                  // or new Hubitat("http://192.168.1.50")

const devices = await hub.listDevices();
const bulbs = devices.filter(d => d.type.startsWith(DEVICE_TYPE.HUE_BULB_PREFIX));

const lamp = await hub.findDevice("Chair Lamp");   // by id, exact name, or substring
await hub.setLevel(lamp.id, 30);

// Generic escape hatch for any driver command:
await hub.sendCommand(lamp.id, COMMAND.SET_COLOR_TEMPERATURE, [2700]);
```

### A few handy methods

| Method | What it does |
| --- | --- |
| `listDevices()` | `[{id, name, type, room, states}]` |
| `listApps()` | `[{id, name, type, disabled}]` |
| `device(id)` | full detail incl. available `commands` |
| `findDevice(idOrName)` | resolve by id, exact name, or substring |
| `events(id, max)` | recent device events |
| `location()` / `setMode(mode)` | read settings / switch hub mode |
| `updateLocation(patch)` | round-trips all settings, overrides only what you pass |
| `setLocationByZip(zip)` | look up a US zip and set lat/lon/zip |
| `on` `off` `setLevel` `setColorTemperature` `setHue` `setSaturation` `setHeatingSetpoint` `setCoolingSetpoint` `refresh` | command wrappers |
| `sendCommand(id, method, args, argTypes)` | generic command |

## Layout

Smallest pieces first, so it's easy to extend:

- **`constants.mjs`** — every literal (endpoints, command names, arg-types, modes, device-types, timeouts, form fields). No magic strings/numbers elsewhere.
- **`http.mjs`** — `HttpClient`: the only code that touches `fetch` (timeouts, errors). Add retries/auth/logging here.
- **`hubitat.mjs`** — the `Hubitat` facade composing the above, organized by domain.
- **`cli.mjs`** — thin command-line wrapper.

To add a call: a new entry in `constants.mjs` + a method in `hubitat.mjs`.

## Caveats

- Uses internal web-UI endpoints, not a documented API — a future firmware could change them. They're all in `constants.mjs` if so.
- Assumes Hub Login Security is off (no auth flow is implemented).
- `/device/runmethod` returns the device's HTML page on success; the client treats any 200 as `{ success: true }`.

## License

[MIT](LICENSE)
