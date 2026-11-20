'use strict';
// Production DNS matchers with local instrumented upstreams; no public DNS traffic.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const dgram = require('node:dgram');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const YAML = require('yaml');
const { build } = require('./build');
const { fixtures, freePort } = require('./runtime-routing');

async function dnsStub() {
  const queries = [];
  const server = dgram.createSocket('udp4');
  server.on('message', (query, peer) => {
    let offset = 12;
    const labels = [];
    while (query[offset]) {
      const size = query[offset++];
      labels.push(query.toString('ascii', offset, offset + size));
      offset += size;
    }
    const type = query.readUInt16BE(++offset);
    offset += 4;
    queries.push({ host: labels.join('.').toLowerCase(), type });
    const data =
      type === 1
        ? Buffer.from([127, 0, 0, 1])
        : type === 28
          ? Buffer.from('00000000000000000000000000000001', 'hex')
          : null;
    const header = Buffer.alloc(12);
    query.copy(header, 0, 0, 2);
    header.writeUInt16BE(0x8180, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(data ? 1 : 0, 6);
    const parts = [header, query.subarray(12, offset)];
    if (data) {
      const answer = Buffer.alloc(12);
      answer.writeUInt16BE(0xc00c, 0);
      answer.writeUInt16BE(type, 2);
      answer.writeUInt16BE(1, 4);
      answer.writeUInt32BE(60, 6);
      answer.writeUInt16BE(data.length, 10);
      parts.push(answer, data);
    }
    server.send(Buffer.concat(parts), peer.port, peer.address);
  });
  server.bind(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    queries,
    url: `udp://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function verifyDnsWhitelist({ binary, rulesDir, temp }) {
  const domestic = await dnsStub();
  const foreign = await dnsStub();
  const local = await fixtures();
  const evidence = [];
  const node = { name: '美国 DNS 测试', type: 'socks5', server: '127.0.0.1', port: local.socksPort };
  const modes = [
    { name: 'provider', options: {} },
    { name: 'expanded', options: {}, expanded: true },
    { name: 'minimal', options: { 极简国内外分流模式: true } },
    { name: 'domestic-off', options: { 国内CDNDNS: false } },
    { name: 'microsoft-off', options: { 微软下载DNS: false } },
    { name: 'steam-off', options: { Steam下载DNS: false } },
    { name: 'all-off', options: { 国内CDNDNS: false, 微软下载DNS: false, Steam下载DNS: false } },
    { name: 'domestic-route-off', options: { 国内服务优先直连: false } },
  ];
  try {
    for (const { name, options, expanded } of modes) {
      const config = build({
        settings: { options },
        ...(expanded ? { subscription: { proxies: [node] } } : {}),
      }).config;
      const port = await freePort();
      const proxyPort = await freePort();
      config.tun.enable = false;
      config.ntp.enable = false;
      config.dns.listen = '';
      config.dns['use-hosts'] = false;
      config.dns['use-system-hosts'] = false;
      // The omission of direct-nameserver is intentional: test actual direct dial resolution too.
      assert.equal(config.dns['direct-nameserver'], undefined);
      const instrument = (value) => {
        if (typeof value === 'string' && value.startsWith('rcode://')) return value;
        return value.map((server) =>
          /^https:\/\/(223\.5\.5\.5|1\.12\.12\.12)\//.test(server) ? domestic.url : foreign.url,
        );
      };
      for (const key of ['nameserver', 'default-nameserver', 'proxy-server-nameserver'])
        config.dns[key] = instrument(config.dns[key]);
      for (const key of Object.keys(config.dns['nameserver-policy']))
        config.dns['nameserver-policy'][key] = instrument(config.dns['nameserver-policy'][key]);
      config['mixed-port'] = proxyPort;
      config['external-controller'] = `127.0.0.1:${port}`;
      config.profile = { 'store-selected': false, 'store-fake-ip': false };
      config.proxies = config.proxies.map((proxy) =>
        ['direct', 'dns'].includes(proxy.type)
          ? proxy
          : { name: proxy.name, type: 'socks5', server: '127.0.0.1', port: local.socksPort },
      );
      if (!expanded) {
        const file = path.join(temp, `dns-${name}-nodes.yaml`);
        fs.writeFileSync(file, YAML.stringify({ proxies: [node] }));
        config['proxy-providers'] = { 订阅: { type: 'file', path: file, 'health-check': { enable: false } } };
      }
      for (const [key, spec] of Object.entries(config['rule-providers'])) {
        if (spec.type === 'inline') continue;
        const filename = key + path.extname(spec.path);
        const file = path.join(temp, filename);
        fs.copyFileSync(path.resolve(rulesDir, filename), file);
        config['rule-providers'][key] = { type: 'file', behavior: spec.behavior, format: spec.format, path: file };
      }
      // Synthetic direct domains test the direct dial path without altering production DNS policies.
      config.rules.unshift('DOMAIN,unknown-direct.dns-whitelist-probe.net,直连', 'DOMAIN,cdn-direct.hdslb.com,直连');
      const filename = path.join(temp, `dns-${name}.yaml`);
      fs.writeFileSync(filename, YAML.stringify(config));
      const child = spawn(binary, ['-d', temp, '-f', filename], { stdio: ['ignore', 'pipe', 'pipe'] });
      let logs = '';
      child.stdout.on('data', (bytes) => {
        logs += bytes;
      });
      child.stderr.on('data', (bytes) => {
        logs += bytes;
      });
      const api = async (route) =>
        (await fetch(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(3000) })).json();
      try {
        let ready = false;
        for (let i = 0; i < 50; i++) {
          assert.equal(child.exitCode, null, logs);
          try {
            const { providers } = await api('/providers/rules');
            ready = providers && Object.values(providers).every((provider) => provider.ruleCount > 0);
            if (ready) break;
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        assert.ok(ready, logs);
        const cases = [
          ['i0.hdslb.com', options.国内CDNDNS !== false],
          ['qhimgs7.com', options.国内CDNDNS !== false],
          ['res.cdn.office.net', options.微软下载DNS !== false],
          ['dl.steam.clngaa.com', options.Steam下载DNS !== false],
          ['alibaba.cdn.steampipe.steamcontent.com', options.Steam下载DNS !== false],
          ['ugc.steamusercontent.com', false],
          ['api.steamserver.net', false],
          ['store.steampowered.com', false],
          ['steamcommunity.com', false],
          ['www.baidu.com', false],
          ['www.qq.com', false],
          ['www.bilibili.com', false],
          ['download.dns-whitelist-probe.net', false],
          ['fsend.cn', false],
          ['chatgpt.com', false],
          ['guzzoni.apple.com', false],
          ['mesu.apple.com', true],
          ['gs-loc-cn.apple.com', options.国内服务优先直连 !== false],
        ];
        for (const [host, allowed] of cases) {
          for (const type of ['A', 'AAAA']) {
            domestic.queries.length = foreign.queries.length = 0;
            const response = await api(`/dns/query?name=${host}&type=${type}`);
            assert.equal(response.Status, 0, `${name}: ${host} ${type}: ${JSON.stringify(response)}`);
            const selected = allowed ? domestic : foreign;
            const excluded = allowed ? foreign : domestic;
            assert.ok(
              selected.queries.some((query) => query.host === host),
              `${name}: ${host} ${type}: expected ${allowed ? 'domestic' : 'foreign'} DNS; ${logs}`,
            );
            assert.ok(
              !excluded.queries.some((query) => query.host === host),
              `${name}: ${host} ${type}: query leaked to wrong upstream`,
            );
            evidence.push({ mode: name, host, type, upstream: allowed ? 'domestic' : 'foreign' });
          }
        }
        for (const [host, allowed] of [
          ['unknown-direct.dns-whitelist-probe.net', false],
          ['cdn-direct.hdslb.com', options.国内CDNDNS !== false],
        ]) {
          domestic.queries.length = foreign.queries.length = 0;
          const socket = local.track(net.connect(proxyPort, '127.0.0.1'));
          try {
            await once(socket, 'connect');
            socket.write(`CONNECT ${host}:${local.sinkPort} HTTP/1.1\r\nHost: ${host}\r\n\r\n`);
            const [response] = await Promise.race([
              once(socket, 'data'),
              new Promise((_, reject) => {
                socket.setTimeout(5000, () => reject(new Error(`${name}: direct CONNECT timeout: ${host}`)));
              }),
            ]);
            assert.match(response.toString(), /200 Connection established/i);
            socket.write(`GET / HTTP/1.1\r\nHost: ${host}\r\n\r\n`);
            for (let i = 0; i < 50; i++) {
              if ([...domestic.queries, ...foreign.queries].some((query) => query.host === host)) break;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            let connection;
            for (let i = 0; i < 30; i++) {
              const active = (await api('/connections')).connections || [];
              connection = active.find((entry) => String(entry.metadata.sourcePort) === String(socket.localPort));
              if (connection) break;
              await new Promise((resolve) => setTimeout(resolve, 25));
            }
            assert.ok(connection?.chains.includes('直连'), `${name}: ${host}: missing actual direct connection`);
            const selected = allowed ? domestic : foreign;
            const excluded = allowed ? foreign : domestic;
            assert.ok(
              selected.queries.some((query) => query.host === host),
              `${name}: direct ${host}: wrong DNS`,
            );
            assert.ok(!excluded.queries.some((query) => query.host === host), `${name}: direct ${host}: DNS leak`);
            evidence.push({ mode: name, host, type: 'direct-CONNECT', upstream: allowed ? 'domestic' : 'foreign' });
          } finally {
            socket.destroy();
          }
        }
      } finally {
        fs.writeFileSync(path.join(temp, `dns-${name}.log`), logs);
        if (child.exitCode === null) {
          const exited = once(child, 'exit');
          child.kill('SIGTERM');
          await exited;
        }
      }
    }
  } finally {
    await Promise.all([domestic.close(), foreign.close(), local.close()]);
  }
  return evidence;
}

module.exports = { verifyDnsWhitelist };
