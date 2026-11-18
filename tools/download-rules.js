'use strict';
// Downloads only public rule artifacts referenced by the generated config; never reads subscriptions.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { build } = require('./build');
const RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);
const JSDELIVR_RULES_PREFIX = 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/';
const UPSTREAM_RULES_PREFIX = 'https://raw.githubusercontent.com/appshubcc/bett-rules/meta/geo/';

function upstreamUrl(url) {
  return url.startsWith(JSDELIVR_RULES_PREFIX)
    ? `${UPSTREAM_RULES_PREFIX}${url.slice(JSDELIVR_RULES_PREFIX.length)}`
    : undefined;
}

async function fetchRule(name, url, { sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const fallback = upstreamUrl(url);
  const sources = fallback ? [url, fallback] : [url];
  let lastError;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const source = sources[sourceIndex];
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetch(source, { signal: AbortSignal.timeout(60000) });
      } catch (error) {
        lastError = new Error(`${name}: ${source}: ${error.message}`);
      }
      if (response?.ok) {
        if (source !== url) console.warn(`${name}: CDN unavailable; fetched from upstream GitHub`);
        return { response, source };
      }
      if (response) {
        if (!RETRYABLE_STATUSES.has(response.status))
          throw new Error(`${name}: HTTP ${response.status} from ${source}`);
        lastError = new Error(`${name}: HTTP ${response.status} from ${source}`);
      }
      if (attempt < 2) await sleep(1000 * 2 ** attempt);
    }
    if (sourceIndex + 1 < sources.length) console.warn(`${lastError.message}; retrying from upstream GitHub`);
  }
  throw lastError || new Error(`${name}: rule download failed`);
}

async function run() {
  const dir = path.resolve(process.argv[2] || '.local/rules');
  fs.mkdirSync(dir, { recursive: true });
  const entries = Object.entries(build().config['rule-providers']).filter(([, spec]) => spec.type !== 'inline');
  const manifest = [];
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const [name, spec] = entries[cursor++];
      const { response, source } = await fetchRule(name, spec.url);
      const bytes = Buffer.from(await response.arrayBuffer());
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (spec.format === 'mrs') {
        // MRS is Zstandard-compressed; semantic validation is done by native-check.js with Mihomo.
        if (bytes.length < 16 || bytes.subarray(0, 4).toString('hex') !== '28b52ffd')
          throw new Error(`${name}: invalid compressed MRS header`);
      } else if (spec.format === 'text' && spec.behavior === 'classical') {
        const lines = new TextDecoder('utf-8', { fatal: true }).decode(bytes).split(/\r?\n/)
          .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
        if (!lines.length || lines.some((line) => !/^DOMAIN(?:-SUFFIX)?,[a-z0-9.-]+$/i.test(line)))
          throw new Error(`${name}: invalid domain-only classical rules`);
      } else throw new Error(`${name}: unsupported rule format ${spec.format}/${spec.behavior}`);
      fs.writeFileSync(path.join(dir, `${name}${path.extname(spec.path)}`), bytes);
      manifest.push({
        name,
        url: spec.url,
        ...(source !== spec.url ? { downloadedFrom: source } : {}),
        ...(spec.format !== 'mrs' ? { format: spec.format } : {}),
        behavior: spec.behavior,
        bytes: bytes.length,
        sha256: digest,
      });
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  manifest.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ checkedAt: new Date().toISOString(), providers: manifest }, null, 2) + '\n',
  );
  console.log(`Verified ${manifest.length} public rule downloads in ${dir}`);
}
if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { fetchRule, upstreamUrl };
