# 节点处理与兼容性测试

此目录包含节点处理逻辑的兼容性回归用例，并在入口中运行 ES2026 语法兼容性和 QuickJS 执行检查。

从仓库根目录运行：

```sh
npm ci
node Test/run-tests.js
```

`npm test` 会运行这里的兼容性套件，随后运行 `tests/*.test.js` 中针对生成配置的 Node 回归。后者覆盖配置图、服务与 Apple 规则、DNS policy 与路由出口、动态 IP provider 顺序、严格加密 DNS、开关行为和静态生成一致性。

`npm run check` 单独比较默认生成结果与提交的 `Config/mihomoConfig.yaml`。可用官方 Mihomo 内核时，`tools/native-check.js` 和 `tools/native-sniffing.js` 提供额外的原生配置与隔离流量检查。配置测试、原生解析和设备/运营商网络行为是不同的检查范围。

新增模块与测试遵守 [模块化与动态规则集开发原则](../docs/development-principles.md)，复用统一开关，移除无用接口，避免逐业务域名维护。现有 Apple 精确功能回归按其专项约定保留。

## 国内服务路由模块

`tests/config.test.js` 验证阿里、百度、B站、字节、三家运营商、华为云、京东、网易、腾讯、小米模块的统一开关、专用服务优先级、静态/展开与全量/极简输出；模块不单独生成厂商 DNS policy，重叠 `geolocation-cn` 的域名仍按该集合解析。`tools/native-check.js` 直接从实际 Bett 厂商 MRS 快照自动提取候选；有同源 `@!cn` 时同时提取排除样本，在全量/极简和统一开关的四种组合下执行回环 CONNECT 验证。集合外样本使用随机 `.invalid` 域名。运行时样本与解码文件只保存在忽略的临时目录，不用于生成或发布客户端规则。

## DNS 白名单回归原则

修改 DNS、规则源或相关开关前遵守 [国内 DNS 白名单维护原则](../docs/dns-whitelist.md)。兼容性测试不能恢复“所有直连都使用国内 DNS”、通用 `cn` 国内解析或通用 `direct-nameserver` 等旧行为来适配断言；应明确区分连接路由、`geolocation-cn` policy、白名单授权和 Apple/启动解析例外。

`tests/config.test.js` 覆盖 `geolocation-cn` policy、白名单开关组合、服务组/极简模式独立性、DNS provider 引用及优先级。`tools/native-check.js` 调用 `tools/native-dns-whitelist.js`，从实际 `geolocation-cn` 快照抽取域名样本，并保留生产 policy 顺序，用回环上游计数验证 A/AAAA 和真实直连拨号。确认更具体的服务 policy、Steam 排除项和名单外查询仍使用各自解析器；上游成员更新仍由客户端 HTTP provider 每日直接拉取。

只改文档时检查链接与原则一致性即可；行为改动须运行项目测试、生成一致性检查与可用的原生验证。方法和隐私/延迟结论的边界见 [验证说明](../docs/validation.md)。
