'use strict';
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '../Script/mihomoScript.js');
const HASH_FIELDS = [/^([ \t]*\* 最新 Raw SHA-256：)[0-9a-f]{64}$/gm];

function replaceHashFields(source, value) {
  let output = source;
  for (const pattern of HASH_FIELDS) {
    let count = 0;
    output = output.replace(pattern, (_line, prefix) => {
      count++;
      return `${prefix}${value}`;
    });
    if (count !== 1) throw new Error('脚本必须且只能包含一个对应的 SHA-256 标识行');
  }
  return output;
}

function computeScriptSha256(source) {
  return createHash('sha256')
    .update(replaceHashFields(source, '0'.repeat(64)), 'utf8')
    .digest('hex');
}

function updateScriptSha256(source) {
  const sha256 = computeScriptSha256(source);
  return { text: replaceHashFields(source, sha256), sha256 };
}

function updateFile({ check = false } = {}) {
  const source = fs.readFileSync(SCRIPT, 'utf8');
  const result = updateScriptSha256(source);
  if (check && result.text !== source) throw new Error('脚本 SHA-256 标识已过期，请运行 GitHub Actions 更新配置');
  if (!check && result.text !== source) fs.writeFileSync(SCRIPT, result.text);
  return result.sha256;
}

function cli(args) {
  if (args.length !== 1 || !['--update', '--check'].includes(args[0]))
    throw new Error('用法：node tools/script-sha.js --update|--check');
  const sha256 = updateFile({ check: args[0] === '--check' });
  console.log(`Script SHA-256: ${sha256}`);
}

module.exports = { computeScriptSha256, updateScriptSha256, updateFile };
if (require.main === module) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
