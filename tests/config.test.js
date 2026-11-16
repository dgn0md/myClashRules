'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { build, load } = require('../tools/build');
const YAML = require('yaml');
const fx = require('../Test/lib/fixtures');
const siriAiGroup = 'Siri Ai/Apple Intelligence';
const appleProductGroup = 'Apple Product地区';
const otherAppleGroup = 'Other Apple Service';
const clean = () => ({
  proxies: [{ name: '美国 测试', type: 'ss', server: '192.0.2.1', port: 443, cipher: 'aes-128-gcm', password: 'test' }],
});
function graph(config) {
  const groups = new Map(config['proxy-groups'].map((g) => [g.name, g]));
  const nodes = new Set(config.proxies.map((p) => p.name));
  const builtins = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE']);
  assert.equal(groups.size, config['proxy-groups'].length, 'duplicate group names');
  assert.equal(nodes.size, config.proxies.length, 'duplicate node names');
  for (const name of groups.keys()) assert.ok(!nodes.has(name), `node collides with group ${name}`);
  const exists = (name) => groups.has(name) || nodes.has(name) || builtins.has(name);
  for (const g of groups.values()) {
    for (const p of g.proxies || []) assert.ok(exists(p), `dangling ${g.name} → ${p}`);
    if (g['default-selected']) assert.ok(g.proxies.includes(g['default-selected']));
  }
  const visited = new Set();
  function visit(name, visiting = new Set()) {
    if (visited.has(name) || !groups.has(name)) return;
    assert.ok(!visiting.has(name), `cycle at ${name}`);
    const next = new Set(visiting).add(name);
    for (const target of groups.get(name).proxies || []) visit(target, next);
    visited.add(name);
  }
  for (const g of groups.keys()) visit(g);
  for (const rule of config.rules) {
    const parts = rule.split(',');
    const target = parts.at(-1) === 'no-resolve' ? parts.at(-2) : parts.at(-1);
    assert.ok(exists(target), `unknown rule target ${rule}`);
  }
  const refs = JSON.stringify([config.rules, config.dns]);
  for (const match of refs.matchAll(/(?:RULE-SET,|rule-set:)([A-Za-z0-9_!@.-]+)/g))
    assert.ok(config['rule-providers'][match[1]], `missing provider ${match[1]}`);
  for (const [key, provider] of Object.entries(config['rule-providers'])) {
    if (provider.type !== 'inline') assert.equal(provider.interval, 86400);
    assert.ok(refs.includes(`RULE-SET,${key},`) || refs.includes(`rule-set:${key}\"`), `unused provider ${key}`);
  }
  for (const p of config.proxies) if (p['dialer-proxy']) assert.ok(exists(p['dialer-proxy']));
}
function encryptedDns(config) {
  const dns = config.dns;
  assert.equal(dns['use-system-hosts'], false);
  assert.equal(dns['prefer-h3'], false);
  assert.ok(!dns.fallback);
  const arrays = ['default-nameserver', 'nameserver', 'proxy-server-nameserver', 'direct-nameserver'];
  const values = arrays.flatMap((key) => dns[key] || []);
  for (const field of ['nameserver-policy', 'proxy-server-nameserver-policy']) {
    for (const value of Object.values(dns[field] || {})) values.push(...(Array.isArray(value) ? value : [value]));
  }
  for (const value of values) {
    assert.match(value, /^(https|tls|rcode):\/\//);
    assert.doesNotMatch(value, /skip-cert-verify=true|^system|^dhcp/);
  }
  for (const value of dns['default-nameserver']) assert.match(value, /^https:\/\/[\d.]+\/dns-query#DIRECT$/);
}
test('default script and provider YAML have complete graphs and encrypted DNS', () => {
  for (const config of [build({ subscription: fx.typicalSubscription() }).config, build().config]) {
    graph(config);
    encryptedDns(config);
    assert.equal(config['allow-lan'], false);
    assert.equal(config.tun.stack, 'mixed');
    assert.deepEqual(config.tun['dns-hijack'], ['any:53', 'tcp://any:53']);
  }
});
test('sniffing recovers pure-IP domain metadata without overriding destinations in every output mode', () => {
  for (const subscription of [undefined, clean()]) {
    for (const minimal of [false, true]) {
      const config = build({ subscription, settings: { options: { 极简国内外分流模式: minimal } } }).config;
      assert.equal(config.sniffer.enable, true);
      assert.equal(config.sniffer['parse-pure-ip'], true);
      assert.equal(config.sniffer['force-dns-mapping'], true);
      assert.equal(config.sniffer['override-destination'], false);
      for (const protocol of ['HTTP', 'TLS', 'QUIC']) {
        assert.ok(config.sniffer.sniff[protocol].ports.length > 0);
        assert.ok(!config.sniffer.sniff[protocol]['override-destination']);
      }
      encryptedDns(config);
      assert.equal(build({ subscription, settings: { options: { 域名嗅探: false } } }).config.sniffer.enable, false);
    }
  }
});
test('Apple AI/Siri and product endpoints precede Apple CN, advertising and QUIC', () => {
  const config = build({ settings: { options: { 屏蔽代理QUIC流量: true } } }).config;
  const rules = config.rules;
  assert.equal(config['rule-providers'].apple_cn.behavior, 'classical');
  assert.equal(config['rule-providers'].apple_cn.format, 'text');
  assert.match(config['rule-providers'].apple_cn.url, /SukkaW\/Surge@0afc9c2.*\/apple_cn\.conf$/);
  assert.ok(rules.indexOf('RULE-SET,apple_cn,直连') < rules.indexOf(`RULE-SET,apple,${otherAppleGroup}`));
  const apple = rules.indexOf(`DOMAIN-SUFFIX,apple-relay.apple.com,${siriAiGroup}`);
  assert.ok(apple >= 0);
  for (const ref of ['RULE-SET,apple_cn,直连', 'RULE-SET,category-ads,AdBlock']) assert.ok(apple < rules.indexOf(ref));
  assert.ok(apple < rules.findIndex((r) => r.startsWith('AND,')));
  assert.ok(rules.indexOf(`DOMAIN-SUFFIX,smoot.apple.com,${siriAiGroup}`) < rules.indexOf('RULE-SET,apple_cn,直连'));
  assert.ok(!rules.includes(`DOMAIN-SUFFIX,apple.com,${siriAiGroup}`));
  assert.equal(config['proxy-groups'].find((g) => g.name === siriAiGroup).proxies[0], '美国');
  const products = config['proxy-groups'].find((g) => g.name === appleProductGroup);
  assert.equal(products.proxies[0], '美国');
  assert.ok(products.proxies.includes('直连'));
  for (const name of [otherAppleGroup, 'Microsoft'])
    assert.equal(config['proxy-groups'].find((g) => g.name === name).proxies[0], '直连');
  assert.ok(config.rules.includes(`RULE-SET,apple_ip,${appleProductGroup}`));
  assert.ok(rules.indexOf(`RULE-SET,apple_ip,${appleProductGroup}`) < rules.indexOf('RULE-SET,cn_ip,直连'));
  assert.ok(config.dns['nameserver-policy']['+.apple-relay.apple.com'][0].endsWith(`#${siriAiGroup}`));
  assert.ok(config.dns['nameserver-policy']['+.smoot.apple.com'][0].endsWith(`#${siriAiGroup}`));
  assert.ok(rules.includes('DOMAIN,assets.cdn-apple.com,直连'));
  assert.ok(!rules.includes('RULE-SET,cn,直连'));
});
test('Apple IP routes to Apple Product地区 before cn_ip in every output mode', () => {
  for (const subscription of [undefined, clean()]) {
    for (const minimal of [false, true]) {
      const config = build({ subscription, settings: { options: { 极简国内外分流模式: minimal } } }).config;
      assert.ok(config['rule-providers'].apple_ip);
      const appleIp = config.rules.indexOf(`RULE-SET,apple_ip,${appleProductGroup}`);
      assert.ok(appleIp >= 0);
      assert.ok(appleIp < config.rules.indexOf('RULE-SET,cn_ip,直连'));
      const products = config['proxy-groups'].find((g) => g.name === appleProductGroup);
      assert.ok(products.proxies.includes('直连'));
      assert.equal(products.proxies[0], '美国');
    }
  }
});
test('dynamic IP rules keep service egress aligned with their domain DNS policy', () => {
  const expectedTargets = {
    apple_ip: appleProductGroup,
    cn_ip: '直连',
    private_ip: '直连',
    google_ip: 'Google',
    microsoft_ip: 'Microsoft',
    telegram_ip: 'Telegram',
    steam_ip: 'Steam',
    tiktok_ip: 'TikTok',
    twitter_ip: 'Twitter',
    facebook_ip: 'Meta',
    netflix_ip: 'Netflix',
    spotify_ip: 'Spotify',
  };
  const domainPartners = {
    apple_ip: 'apple_tv',
    google_ip: 'google',
    microsoft_ip: 'microsoft',
    telegram_ip: 'telegram',
    steam_ip: 'steam',
    tiktok_ip: 'tiktok',
    twitter_ip: 'twitter',
    facebook_ip: 'meta',
    netflix_ip: 'netflix',
    spotify_ip: 'spotify',
  };
  for (const subscription of [undefined, clean()]) {
    for (const minimal of [false, true]) {
      const config = build({ subscription, settings: { options: { 极简国内外分流模式: minimal } } }).config;
      const routes = new Map();
      for (const rule of config.rules) {
        const match = /^RULE-SET,([^,]+),([^,]+)/.exec(rule);
        if (!match || config['rule-providers'][match[1]]?.behavior !== 'ipcidr') continue;
        const [, provider, target] = match;
        assert.equal(target, expectedTargets[provider], `unexpected target for ${provider}`);
        // IP-CIDR providers have no DNS names; their domain companion carries the DNS policy.
        assert.equal(config.dns['nameserver-policy'][`rule-set:${provider}`], undefined);
        routes.set(provider, target);
      }
      const privateIpIndex = config.rules.indexOf('RULE-SET,private_ip,直连');
      const cnIpIndex = config.rules.indexOf('RULE-SET,cn_ip,直连');
      for (const provider of routes.keys()) {
        const index = config.rules.indexOf(`RULE-SET,${provider},${routes.get(provider)}`);
        if (provider === 'apple_ip') assert.ok(index < privateIpIndex && index < cnIpIndex);
        else if (!['cn_ip', 'private_ip'].includes(provider)) assert.ok(index > privateIpIndex && index < cnIpIndex);
      }
      for (const [ipProvider, domainProvider] of Object.entries(domainPartners)) {
        const target = routes.get(ipProvider);
        if (!target) continue;
        assert.ok(config.rules.includes(`RULE-SET,${domainProvider},${target}`), `${domainProvider} must share ${ipProvider} egress`);
        const dns = config.dns['nameserver-policy'][`rule-set:${domainProvider}`];
        assert.ok(dns, `missing DNS policy for ${domainProvider}`);
        for (const resolver of Array.isArray(dns) ? dns : [dns])
          assert.ok(resolver.endsWith(`#${target}`), `${ipProvider} → ${target}, ${domainProvider} DNS → ${resolver}`);
      }
      if (routes.has('cn_ip'))
        assert.deepEqual(config.dns['nameserver-policy']['rule-set:cn'], config.dns['direct-nameserver']);
      if (routes.has('private_ip')) assert.equal(config.dns['nameserver-policy']['rule-set:private'], 'rcode://success');
      if (routes.has('apple_ip')) {
        assert.ok(config.rules.indexOf(`RULE-SET,apple_ip,${appleProductGroup}`) < config.rules.indexOf('RULE-SET,cn_ip,直连'));
        if (config['rule-providers'].apple) {
          assert.ok(config.rules.includes(`RULE-SET,apple,${otherAppleGroup}`));
          assert.ok(config.dns['nameserver-policy']['rule-set:apple'].every((dns) => dns.endsWith(`#${otherAppleGroup}`)));
        }
      }
    }
  }
});
test('Siri AI domain routes use matching DNS policy and precede QUIC rejection in both output modes', () => {
  for (const subscription of [undefined, clean()]) {
    for (const minimal of [false, true]) {
      const config = build({
        subscription,
        settings: { options: { 极简国内外分流模式: minimal, 屏蔽代理QUIC流量: true } },
      }).config;
      const routes = config.rules
        .map((rule, index) => ({ index, parts: rule.split(',') }))
        .filter(({ parts }) => ['DOMAIN', 'DOMAIN-SUFFIX'].includes(parts[0]) && parts[2] === siriAiGroup);
      assert.ok(routes.length > 0, 'expected Siri AI domain routes');
      const quic = config.rules.findIndex((entry) => entry.startsWith('AND,') && entry.endsWith(',REJECT'));
      assert.ok(quic >= 0, 'QUIC reject rule is enabled for this test');
      for (const { index, parts } of routes) {
        assert.ok(index < quic, `${parts[0]},${parts[1]} must precede QUIC rejection`);
        const key = parts[0] === 'DOMAIN-SUFFIX' ? `+.${parts[1]}` : parts[1];
        const resolvers = config.dns['nameserver-policy'][key];
        assert.ok(resolvers, `missing DNS policy for ${key}`);
        for (const resolver of Array.isArray(resolvers) ? resolvers : [resolvers])
          assert.ok(resolver.endsWith(`#${siriAiGroup}`), `${key} DNS must use ${siriAiGroup}`);
      }
    }
  }
});
test('international iCloud content suffix shares priority routing and DNS while excluding China sites', () => {
  const targets = [
    [`DOMAIN,gateway.icloud.com,${siriAiGroup}`, 'gateway.icloud.com'],
    [`DOMAIN-SUFFIX,icloud-content.com,${siriAiGroup}`, '+.icloud-content.com'],
  ];
  for (const subscription of [undefined, clean()]) {
    for (const minimal of [false, true]) {
      const config = build({
        subscription,
        settings: { options: { 极简国内外分流模式: minimal, 屏蔽代理QUIC流量: true } },
      }).config;
      graph(config);
      encryptedDns(config);
      assert.ok(!config['rule-providers'].apple_ai_edge);
      assert.ok(!config.rules.includes(`RULE-SET,apple_ai_edge,${siriAiGroup}`));
      assert.ok(!config.dns['nameserver-policy']['rule-set:apple_ai_edge']);
      for (const [rule, policy] of targets) {
        const index = config.rules.indexOf(rule);
        assert.ok(index >= 0, `missing AI exception: ${rule}`);
        for (const [i, other] of config.rules.entries()) {
          if (/^RULE-SET,(apple_cn|apple|category-ads),|^AND,/.test(other))
            assert.ok(index < i, `${policy} must precede ${other}`);
        }
        assert.deepEqual(
          config.dns['nameserver-policy'][policy],
          config.dns['nameserver-policy']['+.apple-relay.apple.com'],
        );
      }
      for (const suffix of ['icloud.com', 'icloud.com.cn', 'icloud-content.com.cn', 'gateway.icloud.com']) {
        assert.ok(!config.rules.includes(`DOMAIN-SUFFIX,${suffix},${siriAiGroup}`));
        assert.ok(!config.dns['nameserver-policy'][`+.${suffix}`]);
      }
      for (const host of ['gateway.icloud.com.cn', 'ussjc1.icloud-content.com.cn', 'xactu3.icloud-content.com.cn']) {
        assert.ok(!config.rules.includes(`DOMAIN,${host},${siriAiGroup}`));
        assert.ok(!config.dns['nameserver-policy'][host]);
      }
    }
    const off = build({ subscription, settings: { options: { [siriAiGroup]: false } } }).config;
    graph(off);
    for (const [rule, policy] of targets) {
      assert.ok(!off.rules.includes(rule));
      assert.ok(!off.dns['nameserver-policy'][policy]);
    }
  }
});
test('strict DNS rejects private plaintext and insecure TLS instead of changing the resolver', () => {
  for (const resolver of [
    '192.168.1.1',
    'udp://10.2.3.4:53',
    'tcp://10.2.3.4:53',
    'http://private.test/dns-query',
    'https://private.test/dns-query#skip-cert-verify=true',
  ]) {
    const subscription = clean();
    subscription.proxies[0].server = 'us.node.test';
    subscription.dns = { nameserver: [resolver] };
    assert.throws(() => build({ subscription }), /严格加密DNS/);
  }
});
test('strict private DNS keeps exact per-node policies and fills partially covered nodes', () => {
  const subscription = clean();
  subscription.proxies[0].server = 'a.example.co.uk';
  subscription.proxies.push({ ...subscription.proxies[0], name: '香港 测试', server: 'b.example.co.uk' });
  subscription.dns = {
    nameserver: ['tls://private.test:853'],
    'proxy-server-nameserver-policy': { 'a.example.co.uk': 'https://special.test/dns-query' },
  };
  const policy = build({ subscription }).config.dns['proxy-server-nameserver-policy'];
  assert.deepEqual(policy, {
    'a.example.co.uk': 'https://special.test/dns-query',
    'b.example.co.uk': ['tls://private.test:853'],
  });
  assert.ok(!('+.co.uk' in policy));
});
test('private hosts rewrite still removes local-loop DNS before strict validation', () => {
  const config = build({ subscription: fx.hostsMappedSubscription() }).config;
  encryptedDns(config);
  assert.ok(config.proxies.some((p) => p.server === 'node-a1b2c3.example-apt.com'));
});
test('each boolean option is accepted, takes part in generation and leaves valid graphs', () => {
  const defaults = load().ruleOptionsEnable;
  for (const [key, value] of Object.entries(defaults)) {
    const settings = { options: { [key]: !value } };
    if (key === '链式代理') settings.customProxies = [{ ...clean().proxies[0], name: '自建 日本' }];
    for (const subscription of [undefined, clean()]) {
      const result = build({ settings, subscription });
      graph(result.config);
      assert.equal(YAML.parse(result.text)['x-myClashRules'].options[key], !value);
      if (key !== '严格加密DNS') encryptedDns(result.config);
    }
  }
});
test('minimal mode keeps independently enabled Apple and DNS protections', () => {
  const config = build({ settings: { options: { 极简国内外分流模式: true } } }).config;
  graph(config);
  encryptedDns(config);
  assert.ok(config.rules.includes(`DOMAIN,guzzoni.apple.com,${siriAiGroup}`));
  assert.ok(config.rules.includes(`RULE-SET,apple_ip,${appleProductGroup}`));
  assert.ok(!config['proxy-groups'].some((g) => g.name === 'YouTube'));
  assert.equal(config.rules.at(-1), 'MATCH,默认代理');
});
test('Apple/CDN/PCDN/IPv6/TUN/LAN switches change their advertised behavior', () => {
  const config = build({
    settings: {
      options: {
        [siriAiGroup]: false,
        [appleProductGroup]: false,
        Apple模型下载直连: false,
        PCDN拦截: false,
        IPv6: false,
        TUN: false,
        局域网访问: true,
        拦截外部明文DNS: false,
      },
    },
  }).config;
  assert.ok(!config.rules.some((r) => r.endsWith(`,${siriAiGroup}`) || r.endsWith(`,${appleProductGroup}`)));
  assert.ok(!config.dns['nameserver-policy']['apple-relay.apple.com']);
  assert.ok(!config.rules.includes('DOMAIN,assets.cdn-apple.com,直连'));
  assert.ok(!Object.keys(config.hosts).some((key) => key.includes('mcdn')));
  assert.equal(config.ipv6, false);
  assert.equal(config.dns.ipv6, false);
  assert.equal(config.tun.enable, false);
  assert.equal(config['allow-lan'], true);
  assert.equal(config['bind-address'], '*');
  assert.ok(!config.rules.some((r) => r.startsWith('DST-PORT,53,')));
});
test('invalid true/false values and unknown options are rejected', () => {
  for (const value of ['ture', 'false', 1, null])
    assert.throws(() => build({ settings: { options: { [siriAiGroup]: value } } }), /true.*false/);
  assert.throws(() => build({ settings: { options: { typo: true } } }), /未知配置项/);
});
test('default YAML is deterministic, commented and contains no template credentials', () => {
  const { config, text } = build();
  assert.ok(!JSON.stringify(config).includes('template'));
  assert.equal(fs.readFileSync('Config/mihomoConfig.yaml', 'utf8'), text);
  assert.deepEqual(YAML.parse(text).dns, config.dns);
  assert.match(text, /Mihomo 不执行 x-myClashRules/);
  assert.match(text, /Siri Ai\/Apple Intelligence: true #/);
  assert.equal(text, build().text);
  const metadata = YAML.parse(text)['x-myClashRules'];
  assert.equal(text, build({ settings: metadata }).text);
});
test('combined group switches and custom chain stay acyclic', () => {
  const settings = {
    options: {
      链式代理: true,
      手动选择: false,
      自动选择: false,
      负载均衡: false,
      生成地区自动选择组: false,
      生成高低倍率组: false,
      生成家宽节点组: false,
      分流组添加所有节点: true,
      过滤高倍率节点: true,
    },
    customProxies: [{ ...clean().proxies[0], name: '日本 自建 住宅' }],
  };
  graph(build({ settings }).config);
  graph(build({ settings, subscription: clean() }).config);
});
test('Apple product endpoints share one regional group and overseas media stays opt-in', () => {
  const defaults = build().config;
  const products = defaults['proxy-groups'].find((group) => group.name === appleProductGroup);
  assert.ok(products);
  assert.equal(products.proxies[0], '美国');
  assert.ok(products.proxies.includes('直连'));
  for (const rule of defaults.rules) {
    const match = /^(DOMAIN|DOMAIN-SUFFIX),([^,]+),(.+)$/.exec(rule);
    if (!match || ![siriAiGroup, appleProductGroup, otherAppleGroup].includes(match[3])) continue;
    const [, type, domain, target] = match;
    const policyKey = type === 'DOMAIN-SUFFIX' ? `+.${domain}` : domain;
    const policy = defaults.dns['nameserver-policy'][policyKey];
    assert.ok(policy, `missing DNS policy for ${rule}`);
    for (const resolver of Array.isArray(policy) ? policy : [policy])
      assert.ok(resolver.endsWith(`#${target}`), `${rule} uses ${policyKey} → ${resolver}`);
  }
  for (const domain of [
    'news-client-search.apple.com',
    'uts-api.itunes.apple.com',
    '+.fitness.apple.com',
    '+.sports.apple.com',
    '+.books.apple.com',
    'gspe1-ssl.ls.apple.com',
  ]) {
    const ruleDomain = domain.startsWith('+.') ? domain.slice(2) : domain;
    const type = domain.startsWith('+.') ? 'DOMAIN-SUFFIX' : 'DOMAIN';
    assert.ok(defaults.rules.includes(`${type},${ruleDomain},${appleProductGroup}`));
    assert.ok(defaults.dns['nameserver-policy'][domain]?.[0].endsWith(`#${appleProductGroup}`));
  }
  assert.ok(defaults['rule-providers'].apple_tv.url.endsWith('/apple-tvplus.mrs'));
  assert.ok(defaults.rules.indexOf(`RULE-SET,apple_tv,${appleProductGroup}`) < defaults.rules.indexOf('RULE-SET,apple_cn,直连'));
  assert.ok(defaults.rules.includes(`RULE-SET,apple_ip,${appleProductGroup}`));
  assert.ok(defaults.rules.includes(`DOMAIN,mask.icloud.com,${siriAiGroup}`));
  for (const oldName of ['AppleNews', 'AppleTV', 'AppleFitness', 'AppleSports', 'AppleBooks', 'AppleRelay', 'Apple地区检测'])
    assert.ok(!defaults['proxy-groups'].some((group) => group.name === oldName));
  const off = build({ settings: { options: { [appleProductGroup]: false } } }).config;
  assert.ok(!off['proxy-groups'].some((group) => group.name === appleProductGroup));
  assert.ok(!off['rule-providers'].apple_ip);
  assert.ok(!off['rule-providers'].apple_tv);
  assert.ok(!off.rules.some((rule) => rule.endsWith(`,${appleProductGroup}`)));
  const media = build({ settings: { options: { Apple海外媒体: true } } }).config;
  for (const host of ['buy.itunes.apple.com', 'p12-buy.itunes.apple.com', 'play.itunes.apple.com'])
    assert.ok(media.rules.includes(`DOMAIN,${host},${appleProductGroup}`));
});
test('every literal domain route uses DNS from the same egress group', () => {
  for (const subscription of [undefined, clean()]) {
    for (const minimal of [false, true]) {
      const config = build({ subscription, settings: { options: { 极简国内外分流模式: minimal } } }).config;
      const groups = new Map(config['proxy-groups'].map((group) => [group.name, group]));
      let checked = 0;
      for (const rule of config.rules) {
        const match = /^(DOMAIN|DOMAIN-SUFFIX),([^,]+),([^,]+)(?:,|$)/.exec(rule);
        if (!match) continue;
        const [, type, domain, target] = match;
        const group = groups.get(target);
        if (target !== '直连' && !group) continue;
        const policyKey = type === 'DOMAIN-SUFFIX' ? `+.${domain}` : domain;
        const policy = config.dns['nameserver-policy'][policyKey];
        assert.ok(policy, `missing nameserver-policy for ${rule}`);
        checked++;
        if (target === '直连') {
          assert.deepEqual(policy, config.dns['direct-nameserver'], `${rule} must resolve through DIRECT`);
        } else if (
          group.proxies.length &&
          group.proxies.every((proxy) => ['REJECT', 'REJECT-DROP', 'PASS'].includes(proxy))
        ) {
          assert.equal(policy, 'rcode://name_error', `${rule} must fail closed with its group`);
        } else {
          for (const resolver of Array.isArray(policy) ? policy : [policy])
            assert.ok(resolver.endsWith(`#${target}`), `${rule} uses ${policyKey} → ${resolver}`);
        }
      }
      assert.ok(checked > 0);
    }
  }
});
test('legacy Apple group switches migrate to the consolidated names and explicit new names win', () => {
  const legacy = {
    Apple: false,
    Apple智能: true,
    Siri: false,
    AppleNews: false,
    AppleTV: true,
    AppleFitness: false,
    AppleSports: false,
    AppleBooks: false,
    AppleRelay: false,
    Apple地区检测: false,
  };
  const migrated = build({ settings: { options: legacy } }).config;
  assert.ok(migrated['proxy-groups'].some((group) => group.name === siriAiGroup));
  assert.ok(migrated['proxy-groups'].some((group) => group.name === appleProductGroup));
  assert.ok(!migrated['proxy-groups'].some((group) => group.name === otherAppleGroup));

  const explicit = build({
    settings: {
      options: {
        ...legacy,
        [siriAiGroup]: false,
        [appleProductGroup]: false,
        [otherAppleGroup]: true,
      },
    },
  }).config;
  assert.ok(!explicit['proxy-groups'].some((group) => group.name === siriAiGroup));
  assert.ok(!explicit['proxy-groups'].some((group) => group.name === appleProductGroup));
  assert.ok(explicit['proxy-groups'].some((group) => group.name === otherAppleGroup));
});

test('AppleFlow PCC and Siri endpoints route through the shared US selector before QUIC rejection', () => {
  const config = build({ subscription: clean(), settings: { options: { 屏蔽代理QUIC流量: true } } }).config;
  const pcc = [
    ['DOMAIN', 'gspe1-ssl.ls.apple.com', appleProductGroup],
    ['DOMAIN-SUFFIX', 'issuer.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'ropes.apple.com', siriAiGroup],
    ['DOMAIN', 'mask-api.icloud.com', siriAiGroup],
    ['DOMAIN', 'mask.icloud.com', siriAiGroup],
    ['DOMAIN', 'mask-h2.icloud.com', siriAiGroup],
    ['DOMAIN', 'ss-cleanup-proxy-prod.us-east-1m.app.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'app.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'apple-relay.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'apple-relay.cloudflare.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'apple-relay.fastly-edge.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'apple-relay.akamaized.net', siriAiGroup],
    ['DOMAIN', 'cp4.cloudflare.com', siriAiGroup],
  ];
  const siri = [
    ['DOMAIN', 'guzzoni.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'guzzoni.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'siri.apple.com', siriAiGroup],
    ['DOMAIN', 'dejavu.apple.com', siriAiGroup],
    ['DOMAIN', 'sequoia.apple.com', siriAiGroup],
    ['DOMAIN-SUFFIX', 'smoot.apple.com', siriAiGroup],
  ];
  const quicReject = config.rules.findIndex((rule) => rule.startsWith('AND,') && rule.endsWith(',REJECT'));
  assert.ok(quicReject >= 0, 'QUIC reject rule is enabled for this test');
  for (const [type, domain, target] of [...pcc, ...siri]) {
    const rule = `${type},${domain},${target}`;
    const index = config.rules.indexOf(rule);
    assert.ok(index >= 0, `missing ${rule}`);
    assert.ok(index < quicReject, `${rule} must precede QUIC rejection`);
    const policyKey = type === 'DOMAIN-SUFFIX' ? `+.${domain}` : domain;
    assert.ok(config.dns['nameserver-policy'][policyKey]?.some((dns) => dns.endsWith(`#${target}`)));
    assert.ok(config.dns['fake-ip-filter'].includes(policyKey), `missing real-IP exception ${policyKey}`);
  }
  for (const name of ['AI', siriAiGroup]) {
    assert.deepEqual(config['proxy-groups'].find((group) => group.name === name).proxies, ['美国']);
  }
  assert.equal(config['proxy-groups'].find((group) => group.name === appleProductGroup).proxies[0], '美国');
  const usGroup = config['proxy-groups'].find((group) => group.name === '美国');
  assert.ok(usGroup.proxies.includes('美国-自动选择'));
  assert.ok(config['proxy-groups'].find((group) => group.name === '美国-自动选择').proxies.includes('🇺🇸 美国 测试'));
  assert.ok(!config.rules.some((rule) => /,(直连|DIRECT)$/.test(rule) && /guzzoni|siri\.apple|dejavu|sequoia|smoot/.test(rule)));
});

test('Apple US-bound routes fail closed when there is no US-labelled candidate', () => {
  const subscription = { proxies: [{ ...clean().proxies[0], name: 'Unlabelled node' }] };
  for (const settings of [{}, { options: { 极简国内外分流模式: true } }]) {
    const config = build({ subscription, settings }).config;
    assert.ok(!config['proxy-groups'].some((group) => group.name === '美国'));
    for (const name of ['AI', siriAiGroup]) {
      const group = config['proxy-groups'].find((entry) => entry.name === name);
      if (name === 'AI' && settings.options?.极简国内外分流模式) assert.equal(group, undefined);
      else assert.deepEqual(group.proxies, ['REJECT']);
    }
    const products = config['proxy-groups'].find((group) => group.name === appleProductGroup);
    assert.ok(products);
    assert.equal(products.proxies[0], '默认代理');
    assert.ok(products.proxies.includes('直连'));
  }
});

test('every routed domain rule-set uses its route target as DNS egress', () => {
  const config = build().config;
  const expectedPolicies = new Map();
  for (const rule of config.rules) {
    const match = /^RULE-SET,([^,]+),([^,]+)(?:,|$)/.exec(rule);
    if (!match) continue;
    const [, providerName, target] = match;
    const provider = config['rule-providers'][providerName];
    if (!provider || !['domain', 'classical'].includes(provider.behavior)) continue;
    if (['REJECT', 'REJECT-DROP', 'PASS'].includes(target)) continue;
    if (['private', 'cn', 'douyin'].includes(providerName)) continue;
    expectedPolicies.set(providerName, target);
  }
  assert.ok(expectedPolicies.size > 0);
  for (const [providerName, target] of expectedPolicies) {
    const dns = config.dns['nameserver-policy'][`rule-set:${providerName}`];
    assert.ok(dns, `missing DNS egress for rule-set:${providerName} → ${target}`);
    const targetGroup = config['proxy-groups'].find((group) => group.name === target);
    if (targetGroup?.proxies.length && targetGroup.proxies.every((proxy) => ['REJECT', 'REJECT-DROP', 'PASS'].includes(proxy))) {
      assert.equal(dns, 'rcode://name_error');
    } else if (target === '直连') assert.deepEqual(dns, config.dns['direct-nameserver']);
    else for (const resolver of Array.isArray(dns) ? dns : [dns]) assert.ok(resolver.endsWith(`#${target}`));
  }
  assert.ok(config.dns['nameserver-policy']['rule-set:ai'].every((dns) => dns.endsWith('#AI')));
  assert.ok(config.dns['nameserver-policy']['rule-set:google'].every((dns) => dns.endsWith('#Google')));
  assert.ok(config.dns['nameserver-policy']['rule-set:youtube'].every((dns) => dns.endsWith('#YouTube')));
  assert.ok(config.rules.includes('RULE-SET,emby_keyword,Emby'));
  assert.deepEqual(config['rule-providers'].emby_keyword.payload, ['DOMAIN-KEYWORD,emby']);
  assert.ok(config.dns['nameserver-policy']['rule-set:emby_keyword'].every((dns) => dns.endsWith('#Emby')));
});

test('Apple real-IP DNS exceptions preserve encrypted route-specific resolvers and narrow iCloud suffix', () => {
  const config = build().config;
  const filters = config.dns['fake-ip-filter'];
  for (const domain of [
    'gspe1-ssl.ls.apple.com',
    'guzzoni.apple.com',
    '+.guzzoni.apple.com',
    '+.siri.apple.com',
    '+.smoot.apple.com',
    '+.issuer.apple.com',
    '+.ropes.apple.com',
    'mask-api.icloud.com',
    'mask.icloud.com',
    'mask-h2.icloud.com',
    '+.app.apple.com',
    '+.apple-relay.akamaized.net',
  ]) assert.ok(filters.includes(domain), `missing Fake-IP filter ${domain}`);
  assert.ok(!filters.includes('+.icloud-content.com'));
  const policy = config.dns['nameserver-policy'];
  for (const key of ['gspe1-ssl.ls.apple.com', 'guzzoni.apple.com', '+.guzzoni.apple.com', '+.siri.apple.com']) {
    assert.ok(policy[key]);
    for (const resolver of policy[key]) assert.match(resolver, /^https:\/\//);
  }
  const suffixMatches = (suffix, domain) => domain === suffix || domain.endsWith(`.${suffix}`);
  for (const host of ['icloud-content.com', 'edge.hkg.icloud-content.com', 'a.b.icloud-content.com'])
    assert.equal(suffixMatches('icloud-content.com', host), true);
  for (const host of ['icloud-content.com.cn', 'fakeicloud-content.com', 'icloud-content.com.evil'])
    assert.equal(suffixMatches('icloud-content.com', host), false);
});

test('dynamic AI provider and DNS policy share the AI egress group', () => {
  const config = build().config;
  assert.ok(config.rules.includes('RULE-SET,ai,AI'));
  const resolvers = config.dns['nameserver-policy']['rule-set:ai'];
  assert.ok(resolvers?.length > 0, 'missing DNS policy for the AI rule-set');
  assert.ok(resolvers.every((dns) => dns.endsWith('#AI')));
});

test('node UDP declarations pass through unchanged and QUIC blocking stays opt-in', () => {
  for (const udp of [true, false, undefined]) {
    const node = { ...clean().proxies[0], name: '美国 UDP fixture' };
    if (udp !== undefined) node.udp = udp;
    const config = build({ subscription: { proxies: [node] } }).config;
    const actual = config.proxies.find((proxy) => proxy.name.includes('UDP fixture'));
    assert.equal(actual.udp, udp);
  }
  const defaults = build().config;
  assert.equal(load().ruleOptionsEnable['屏蔽代理QUIC流量'], false);
  assert.ok(!defaults.rules.some((rule) => rule.startsWith('AND,') && rule.endsWith(',REJECT')));
  const enabled = build({ settings: { options: { 屏蔽代理QUIC流量: true } } }).config;
  assert.ok(enabled.rules.some((rule) => rule.startsWith('AND,') && rule.endsWith(',REJECT')));
});
test('provider IP preference and both rate filters preserve ordinary region groups', () => {
  const config = build({
    settings: { options: { 代理IPV4优先: true, 过滤高倍率节点: true, 过滤低倍率节点: true } },
  }).config;
  assert.equal(config['proxy-providers'].订阅.override['ip-version'], 'ipv4-prefer');
  assert.ok(config['proxy-groups'].some((g) => g.name === '香港'));
  const both = build({ settings: { options: { 代理IPV4优先: true, 代理IPV6优先: true } } }).config;
  assert.ok(!both['proxy-providers'].订阅.override);
});
test('private policy chooses the most specific suffix for each node', () => {
  const subscription = clean();
  subscription.proxies[0].server = 'a.special.nodes.test';
  subscription.dns = {
    'proxy-server-nameserver-policy': {
      '+.nodes.test': 'https://broad.test/dns-query',
      '+.special.nodes.test': 'https://specific.test/dns-query',
    },
  };
  assert.deepEqual(build({ subscription }).config.dns['proxy-server-nameserver-policy'], {
    'a.special.nodes.test': 'https://specific.test/dns-query',
  });
});
test('CLI applies edited booleans and preserves the subscription URL from a settings YAML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myclash-cli-'));
  const settings = YAML.parse(build().text);
  settings['x-myClashRules'].options[siriAiGroup] = false;
  settings['proxy-providers'].订阅.url = 'https://subscription.example.test/fixture';
  const input = path.join(dir, 'settings.yaml');
  const output = path.join(dir, 'output.yaml');
  fs.writeFileSync(input, YAML.stringify(settings));
  const result = spawnSync(process.execPath, ['tools/build.js', '--settings', input, '--output', output], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const generated = YAML.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(generated['proxy-providers'].订阅.url, settings['proxy-providers'].订阅.url);
  assert.ok(!generated['proxy-groups'].some((group) => group.name === siriAiGroup));
});
