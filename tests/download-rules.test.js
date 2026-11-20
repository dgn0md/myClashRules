'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchRule, upstreamUrl, validateYamlClassicalRules } = require('../tools/download-rules');

const cdnUrl = 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geoip/twitter.mrs';
const sourceUrl = 'https://raw.githubusercontent.com/appshubcc/bett-rules/meta/geo/geoip/twitter.mrs';

test('rule download falls back to upstream GitHub after retryable CDN failures', async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return url === cdnUrl ? { ok: false, status: 403 } : { ok: true, status: 200 };
  };
  console.warn = () => {};
  try {
    const result = await fetchRule('twitter_ip', cdnUrl, { sleep: async () => {} });
    assert.equal(result.source, sourceUrl);
    assert.equal(result.response.ok, true);
    assert.deepEqual(calls, [cdnUrl, cdnUrl, cdnUrl, sourceUrl]);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test('rule download does not fall back for permanent CDN errors', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return { ok: false, status: 404 };
  };
  try {
    await assert.rejects(fetchRule('twitter_ip', cdnUrl, { sleep: async () => {} }), /HTTP 404/);
    assert.deepEqual(calls, [cdnUrl]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('upstream fallback is limited to the configured rule repository', () => {
  assert.equal(upstreamUrl(cdnUrl), sourceUrl);
  assert.equal(upstreamUrl('https://example.invalid/rules.mrs'), undefined);
});

test('YAML classical provider validation accepts domain routes and process rules', () => {
  const rules = Buffer.from(
    'payload:\n  - DOMAIN,one.example\n  - DOMAIN-SUFFIX,two.example\n  - PROCESS-NAME,ExampleApp\n',
  );
  assert.doesNotThrow(() => validateYamlClassicalRules('apple_proxy', rules));
});

test('YAML classical provider validation rejects non-classical payloads', () => {
  const rules = Buffer.from('payload:\n  - RULE-SET,private,DIRECT\n');
  assert.throws(() => validateYamlClassicalRules('apple_proxy', rules), /invalid YAML classical domain rules/);
});
