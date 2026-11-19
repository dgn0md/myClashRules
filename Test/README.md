# 节点处理与兼容性测试

此目录包含节点处理逻辑的兼容性回归用例，并在入口中运行 ES2026 语法兼容性和 QuickJS 执行检查。

从仓库根目录运行：

```sh
npm ci
node Test/run-tests.js
```

`npm test` 会运行这里的兼容性套件，随后运行 `tests/*.test.js` 中针对生成配置的 Node 回归。后者覆盖配置图、服务与 Apple 规则、DNS policy 与路由出口、动态 IP provider 顺序、严格加密 DNS、开关行为和静态生成一致性。

`npm run check` 单独比较默认生成结果与提交的 `Config/mihomoConfig.yaml`。可用官方 Mihomo 内核时，`tools/native-check.js` 和 `tools/native-sniffing.js` 提供额外的原生配置与隔离流量检查。配置测试、原生解析和设备/运营商网络行为是不同的检查范围。

## DNS 白名单回归原则

修改 DNS、规则源或相关开关前遵守 [国内 DNS 白名单维护原则](../docs/dns-whitelist.md)。兼容性测试不能恢复“直连就使用国内 DNS”、通用 `cn` 国内解析或通用 `direct-nameserver` 等旧行为来适配断言；应明确区分连接路由、白名单授权和 Apple/启动解析例外。

`tests/config.test.js` 覆盖白名单开关组合、服务组/极简模式独立性、DNS 专用 provider 引用及优先级。`tools/native-check.js` 调用 `tools/native-dns-whitelist.js`，保留实际规则成员与生产 policy 顺序，用回环上游计数验证 A/AAAA 和真实直连拨号。新增源或例外时补充获准域名、未获准域名和重叠成员，确认未选中解析器没有收到同域查询；名单成员更新仍由客户端 HTTP provider 每日直接拉取，不改为测试或 CI 发布名单。

只改文档时检查链接与原则一致性即可；行为改动须运行项目测试、生成一致性检查与可用的原生验证。方法和隐私/延迟结论的边界见 [验证说明](../docs/validation.md)。
