#!/usr/bin/env node
// Thin CLI over hubitat.mjs. Talks to the hub over your LAN.
// Set HUBITAT_URL to point at your hub (defaults to http://hubitat.local).
//
//   node cli.mjs devices                 list all devices (id, type, key states)
//   node cli.mjs apps                     list installed apps
//   node cli.mjs device <id|name>         full detail + available commands
//   node cli.mjs location                 current hub location/settings
//   node cli.mjs ziplookup <zip>          lat/lon/sunrise for a US zip
//   node cli.mjs events <id> [max]        recent device events
//
//   node cli.mjs on <id> | off <id>       *** state-changing — double-check the target first ***
//   node cli.mjs level <id> <0-100>       *** state-changing ***
//   node cli.mjs cmd <id> <method> [a...] *** state-changing — generic command ***
//   node cli.mjs setmode <Day|Evening|Night|Away>   *** state-changing ***
//
// State-changing commands require --yes to run, a guard against accidental side
// effects in an occupied home.

import { Hubitat } from "./hubitat.mjs";

const argv = process.argv.slice(2);
const yes = argv.includes("--yes");
const args = argv.filter(a => a !== "--yes");
const [cmd, ...rest] = args;
const hub = new Hubitat(); // honors HUBITAT_URL, else http://hubitat.local

const out = v => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
const WRITES = new Set(["on", "off", "level", "cmd", "setmode"]);

function guard() {
  if (!yes) {
    console.error(`Refusing to run state-changing '${cmd}' without --yes (occupied-home guard).`);
    process.exit(2);
  }
}

try {
  if (WRITES.has(cmd)) guard();
  switch (cmd) {
    case "devices": {
      const ds = await hub.listDevices();
      for (const d of ds.sort((a, b) => a.type.localeCompare(b.type))) {
        const st = Object.entries(d.states).map(([k, v]) => `${k}=${v}`).join(", ").slice(0, 60);
        console.log(`[${String(d.id).padStart(3)}] ${d.name.padEnd(28)} | ${d.type.padEnd(22)} | ${st}`);
      }
      break;
    }
    case "apps":
      for (const a of await hub.listApps())
        console.log(`[${String(a.id).padStart(3)}] ${a.name}${a.disabled ? " (disabled)" : ""} | ${a.type}`);
      break;
    case "device": {
      const d = await hub.findDevice(rest[0]);
      if (!d) { console.error("no device matches", rest[0]); process.exit(1); }
      const full = await hub.device(d.id);
      out({ ...full, raw: undefined, commands: full.commands.map(c => c.name) });
      break;
    }
    case "location":  out(await hub.location()); break;
    case "ziplookup": out(await hub.zipLookup(rest[0])); break;
    case "events":    out(await hub.events(rest[0], rest[1] ? Number(rest[1]) : 20)); break;

    case "on":      out(await hub.on(Number(rest[0]))); break;
    case "off":     out(await hub.off(Number(rest[0]))); break;
    case "level":   out(await hub.setLevel(Number(rest[0]), Number(rest[1]))); break;
    case "setmode": out(await hub.setMode(rest[0])); break;
    case "cmd": {
      const [id, method, ...a] = rest;
      const coerced = a.map(x => (/^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x));
      out(await hub.sendCommand(Number(id), method, coerced));
      break;
    }
    default:
      console.error("unknown command:", cmd ?? "(none)", "\nSee header of cli.mjs for usage.");
      process.exit(1);
  }
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
