'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('../tools/build');
const { computeScriptSha256, updateScriptSha256 } = require('../tools/script-sha');

const MARKERS = `/**
 * 脚本唯一 SHA-256（哈希字段值不参与计算）：${'0'.repeat(64)}
 * CDN 缓存源脚本 SHA-256（哈希字段值不参与计算）：${'0'.repeat(64)}
 * 示例脚本内容
 */
`;

test('script SHA-256 is stable when its own identifier fields are updated', () => {
  const result = updateScriptSha256(MARKERS);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(computeScriptSha256(result.text), result.sha256);
  assert.equal(result.text.match(new RegExp(result.sha256, 'g')).length, 2);
  assert.notEqual(computeScriptSha256(result.text.replace('示例脚本内容', '更新后的脚本内容')), result.sha256);
});

test('generated YAML contains both CDN URLs and the source script SHA-256', () => {
  const script = fs.readFileSync('Script/mihomoScript.js', 'utf8');
  const sha256 = computeScriptSha256(script);
  const text = build().text;
  assert.match(script, new RegExp(`脚本唯一 SHA-256（哈希字段值不参与计算）：${sha256}`));
  assert.match(script, new RegExp(`CDN 缓存源脚本 SHA-256（哈希字段值不参与计算）：${sha256}`));
  assert.ok(text.includes('https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.js'));
  assert.ok(text.includes('https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Config/mihomoConfig.yaml'));
  assert.ok(text.includes(`源脚本 SHA-256（脚本头部两个 SHA 字段值归零后计算）：${sha256}`));
});
