// Provision Next's WASM fallback from an npm-integrity-verified dependency.
// Older hosting images cannot load the native SWC binary's required glibc.
// Next 16.4.5's fallback loader expects wasm.js at this generated cache path.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { cp, mkdir, readFile } from 'node:fs/promises';

const [major, minor] = process.versions.node.split('.').map(Number);
if (!((major === 22 && minor >= 13) || major === 24)) {
  throw new Error('Select Node.js 24.x or Node.js 22.13+ in your hosting settings. This app uses node:sqlite.');
}
const require = createRequire(import.meta.url);
const nextManifest = require.resolve('next/package.json');
const wasmManifest = require.resolve('@next/swc-wasm-nodejs/package.json');
const next = JSON.parse(await readFile(nextManifest, 'utf8'));
const wasm = JSON.parse(await readFile(wasmManifest, 'utf8'));
if (next.version !== wasm.version) {
  throw new Error('Next.js and @next/swc-wasm-nodejs must have identical versions. Reinstall using the committed package-lock.json.');
}
const destination = join(dirname(nextManifest), 'wasm', '@next', 'swc-wasm-nodejs');
let cacheMatches = false;
try {
  // Reuse a verified cache at startup, including on read-only runtime images.
  const checks = await Promise.all(['package.json', 'wasm.js', 'wasm_bg.wasm'].map(async file => {
    const [source, cached] = await Promise.all([
      readFile(join(dirname(wasmManifest), file)),
      readFile(join(destination, file))
    ]);
    return source.equals(cached);
  }));
  cacheMatches = checks.every(Boolean);
} catch { /* A missing or incomplete cache will be repaired from the verified dependency. */ }
if (!cacheMatches) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(dirname(wasmManifest), destination, { recursive: true, force: true });
}
console.log(`${cacheMatches ? 'Verified' : 'Prepared'} SWC ${wasm.version} WebAssembly fallback for hosts with older glibc.`);
