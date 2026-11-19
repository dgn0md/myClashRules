'use strict';
const { createHash } = require('node:crypto');

const RAW_HASH_FIELD = /^([ \t]*# 最新 Raw SHA-256：)[0-9a-f]{64}$/gm;

function replaceRawHash(source, value) {
  let count = 0;
  const text = source.replace(RAW_HASH_FIELD, (_line, prefix) => {
    count++;
    return `${prefix}${value}`;
  });
  if (count !== 1) throw new Error('YAML 必须且只能包含一个 Raw SHA-256 标识');
  return text;
}

function computeConfigSha256(source) {
  const normalized = replaceRawHash(source, '0'.repeat(64));
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function updateConfigSha256(source) {
  const sha256 = computeConfigSha256(source);
  return { text: replaceRawHash(source, sha256), sha256 };
}

module.exports = { computeConfigSha256, updateConfigSha256 };
