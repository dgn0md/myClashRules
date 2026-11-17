# 节点处理与兼容性测试

此目录包含节点处理逻辑的兼容性回归用例，并在入口中运行 ES2026 语法兼容性和 QuickJS 执行检查。

从仓库根目录运行：

```sh
npm ci
node Test/run-tests.js
```

`npm test` 会运行这里的兼容性套件，随后运行 `tests/*.test.js` 中针对生成配置的 Node 回归。后者覆盖配置图、服务与 Apple 规则、DNS policy 与路由出口、动态 IP provider 顺序、严格加密 DNS、开关行为和静态生成一致性。

`npm run check` 单独比较默认生成结果与提交的 `Config/mihomoConfig.yaml`。可用官方 Mihomo 内核时，`tools/native-check.js` 和 `tools/native-sniffing.js` 提供额外的原生配置与隔离流量检查。配置测试、原生解析和设备/运营商网络行为是不同的检查范围。
