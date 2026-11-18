'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { computeScriptSha256 } = require('./script-sha');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'Script/mihomoScript.js');
const CDN_SCRIPT = path.join(ROOT, 'Script/mihomoScript.cdn.js');
const CDN_LINK = /^([ \t]*\* CDN 脚本链接：https:\/\/cdn\.jsdelivr\.net\/gh\/dgn0md\/myClashRules@main\/Script\/mihomoScript\.cdn\.js)$/gm;

function buildCdnScript(source) {
  const sourceSha256 = computeScriptSha256(source);
  let count = 0;
  const text = source.replace(CDN_LINK, (line) => {
    count++;
    return `${line}\n * CDN 对应源脚本 SHA-256：${sourceSha256}`;
  });
  if (count !== 1) throw new Error('源脚本必须且只能包含一个 CDN 脚本链接');
  return { text, sourceSha256 };
}

function writeCdnScript() {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  const result = buildCdnScript(source);
  fs.writeFileSync(CDN_SCRIPT, result.text);
  return result;
}

if (require.main === module) {
  try {
    const { sourceSha256 } = writeCdnScript();
    console.log(`Generated CDN script from source SHA-256 ${sourceSha256}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildCdnScript, writeCdnScript };
