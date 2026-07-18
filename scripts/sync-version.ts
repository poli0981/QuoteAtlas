/**
 * Sync the single source of truth — package.json `version` — into the native build
 * manifests (docs/13 §4): src-tauri/tauri.conf.json and src-tauri/Cargo.toml. The
 * Android versionCode/versionName derive from tauri.conf.json at build time, so
 * this one write covers web, desktop and Android. Run via `npm run sync:version`
 * (release:prep does it before tagging). Idempotent; fails if the files drift in a
 * way it can't safely patch.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const version = pkg.version;
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`sync:version — package.json version "${version}" is not semver`);
  process.exit(1);
}

// tauri.conf.json — replace the top-level "version" string.
const confPath = join(ROOT, 'src-tauri', 'tauri.conf.json');
const conf = readFileSync(confPath, 'utf8');
const nextConf = conf.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
if (nextConf === conf && !conf.includes(`"version": "${version}"`)) {
  console.error('sync:version — could not find a "version" field in tauri.conf.json');
  process.exit(1);
}
writeFileSync(confPath, nextConf);

// Cargo.toml — replace the [package] version (the first `version = "..."`).
const cargoPath = join(ROOT, 'src-tauri', 'Cargo.toml');
const cargo = readFileSync(cargoPath, 'utf8');
const nextCargo = cargo.replace(/^(version\s*=\s*")[^"]*(")/m, `$1${version}$2`);
if (nextCargo === cargo && !cargo.includes(`version = "${version}"`)) {
  console.error('sync:version — could not find a version field in Cargo.toml');
  process.exit(1);
}
writeFileSync(cargoPath, nextCargo);

console.log(`sync:version — OK: tauri.conf.json + Cargo.toml set to ${version}`);
