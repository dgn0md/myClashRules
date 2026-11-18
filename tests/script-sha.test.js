'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('../tools/build');
const { computeScriptSha256, updateScriptSha256 } = require('../tools/script-sha');
const { buildCdnScript } = require('../tools/build-cdn-script');

const MARKERS = `/**
 * 脚本 SHA-256：${'0'.repeat(64)}
 * 示例脚本内容
 */
`;

test('script SHA-256 is stable when its own identifier fields are updated', () => {
  const result = updateScriptSha256(MARKERS);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(computeScriptSha256(result.text), result.sha256);
  assert.equal(result.text.match(new RegExp(result.sha256, 'g')).length, 1);
  assert.notEqual(computeScriptSha256(result.text.replace('示例脚本内容', '更新后的脚本内容')), result.sha256);
});

test('source keeps its own SHA while the generated CDN script identifies that source', () => {
  const script = fs.readFileSync('Script/mihomoScript.js', 'utf8');
  const sha256 = computeScriptSha256(script);
  const cdnScript = buildCdnScript(script).text;
  const text = build().text;
  assert.match(script, new RegExp(`脚本 SHA-256：${sha256}`));
  assert.doesNotMatch(script, /CDN 对应源脚本 SHA-256/);
  assert.match(cdnScript, new RegExp(`CDN 对应源脚本 SHA-256：${sha256}`));
  assert.ok(cdnScript.includes('https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.cdn.js'));
  assert.ok(text.includes('https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.cdn.js'));
  assert.ok(text.includes('https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Config/mihomoConfig.yaml'));
  assert.ok(text.includes(`CDN 对应源脚本 SHA-256：${sha256}`));
});
