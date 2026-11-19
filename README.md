# myClashRules

面向 Mihomo 的覆写脚本与全量配置生成项目。项目从 [AIsouler/MyClash 全量版](https://github.com/AIsouler/MyClash/commit/4861619be366c7bacabfed6d581bb8c450de1ca1) 起步并独立维护。地区节点分组、倍率与家宽分类、常见服务分流是基础能力；本仓库重点维护以下功能。

## 项目重点

- **Apple 精细分流**：将 Apple Intelligence / Siri、Apple 产品地区服务和其他 Apple 服务分组。Siri 组默认美国，没有合格地区候选时拒绝连接；产品组初始选择美国且可切换直连；其他 Apple 服务默认直连。共享端点和 DNS policy 的细节见 [Apple 路由说明](docs/apple-routing.md)。
- **DNS 白名单与出口联动**：国内 CDN、Microsoft 下载、Steam 国内节点分别由动态白名单控制国内加密 DNS；三个开关默认开启，连接直连不自动授权国内解析。其他业务查询使用国外 DoH，地区服务保持专属解析出口。严格模式不接受生成配置里的明文或不安全 DNS，也不静默回退。它描述的是配置行为，不代表所有设备流量都已被接管。
- **机场配置只接管节点**：展开订阅时处理节点；机场 DNS、路由、策略组和其他非节点设置由脚本重建。机场 hosts 只在满足节点改写条件时用于改写节点 server，不复制到结果配置。
- **纯 IP 域名识别**：从支持的 HTTP Host、TLS SNI 与 QUIC 元数据补充路由所需域名；不解密 HTTPS，也不改写目标地址。
- **脚本与静态配置同源**：`Script/mihomoScript.js` 是规则和选项的来源；`Config/mihomoConfig.yaml` 由 GitHub Actions 构建并回写。YAML 中的 `x-myClashRules` 扩展字段供构建工具读取。
- **自动选择排除组**：`自动选择ex(大陆&香港)` 按节点名称排除大陆和香港候选，保留台湾节点。
- **默认控制面最小化**：发布配置不启动外部控制 API，也不自动下载 Web 控制面；需要管理界面时由本地客户端单独配置并保护 API 密钥。

## 常规能力

提供 26 个地区节点组、倍率和家宽节点分类、AI / Google / YouTube / Microsoft 等常见服务分流，以及手动选择、测速、负载均衡和链式代理等配置选项。
私网 IP 使用 `直连,no-resolve`；Google、Telegram、TikTok、Twitter、Facebook/Meta IP 使用代理出口及 `no-resolve`，关闭服务组或启用极简模式时改用 `默认代理`。Apple、Microsoft、Steam、Netflix、Spotify IP 也使用 `no-resolve` 并保留原有出口组；`cn_ip` 不加该参数，保留末端解析直连兜底。AI 当前使用域名集合，没有独立 IP 集合。
测速域名 `cp.cloudflare.com` 的路由及加密 DNS policy 指向 `默认代理`；测速请求本身由内核通过被测节点发起。

国内 DNS 白名单不强制修改连接路由；关闭相应 DNS 开关后，该集合不再授权国内解析；其他启用集合或专项例外仍可覆盖同一域名。Apple 精确 CDN 与无合格 Siri 地区时的普通 Apple 解析例外保持原有行为。节点域名及 DNS 服务器启动解析仍使用国内加密 DNS；因此此机制减少业务域名披露，不代表完全不向国内解析器发送查询。来源、重叠处理和边界见 [规则来源说明](docs/rule-sources.md)。

## 发布入口

| **产物** | **Raw下载** | **CDN下载** |
| ------ | --------- | --------- |
| 全量覆写脚本 | [mihomoScript.js](https://raw.githubusercontent.com/dgn0md/myClashRules/main/Script/mihomoScript.js) | [mihomoScript.cdn.js](https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.cdn.js) |
| 全量静态配置 | [mihomoConfig.yaml](https://raw.githubusercontent.com/dgn0md/myClashRules/main/Config/mihomoConfig.yaml) | [mihomoConfig.cdn.yaml](https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Config/mihomoConfig.cdn.yaml) |

## 使用

支持 `main(config)` 的 Mihomo 脚本覆写客户端可使用：

```text
https://raw.githubusercontent.com/dgn0md/myClashRules/main/Script/mihomoScript.js
https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.cdn.js
```

静态配置可下载上表中的 YAML，填写 `proxy-providers.订阅.url` 后导入 Mihomo。静态 provider 由内核读取订阅，无法在构建时处理远端节点名称或机场 hosts。需要完整节点处理时，使用本地订阅展开模式，见[功能目录](docs/feature-matrix.md)。

静态 YAML 中的扩展开关不会由 Mihomo 内核执行。更改 `Config/mihomoConfig.yaml` 中的选项并推送后，GitHub Actions 会自动重新生成 Raw YAML 和带独立 CDN SHA-256 的 `Config/mihomoConfig.cdn.yaml`，无需本地构建。

GitHub Actions 每天定时验证并重生静态配置；脚本、配置开关、构建器或依赖锁文件变更时也会触发。只有生成内容变化且行为与原生校验通过时，Action 才会提交更新后的 Raw YAML 和 CDN YAML。也可在仓库的 Actions 页面手动运行 `Sync script and generate config`。

脚本和 YAML 都由 GitHub Actions 生成 CDN 副本；Raw 文件显示 Raw SHA-256，CDN 文件同时显示 Raw 与独立的 CDN SHA-256。YAML CDN 入口直接链接 `mihomoConfig.cdn.yaml`。

## 边界

节点名称用于筛选地区候选，不代表节点的真实出口地区。Apple 共享域名可能由多个产品共用，网络规则不能按 HTTPS 路径拆分应用，也不决定账号或设备资格。

## 维护原则

后续 DNS、规则源和开关更新遵守 [国内 DNS 白名单维护原则](docs/dns-whitelist.md) 与 [仓库维护约定](AGENTS.md)：连接直连不自动授权国内解析；保留小范围白名单、Apple/启动解析例外及 Steam 排除项；客户端 HTTP provider 每日直接更新，上游成员不经本仓库 CI 筛选发布。扩容或换源须同步文档和回归，不能通过恢复通用国内 DNS 兜底解决可用性。

## 开发

当前开发和 CI 锁定 Node.js 24.19.0 与 npm 11.17.0。

```sh
npm ci
npm test
npm run check
```

更多说明：[DNS 白名单原则](docs/dns-whitelist.md)、[功能目录](docs/feature-matrix.md)、[Apple 路由](docs/apple-routing.md)、[动态规则来源](docs/rule-sources.md)、[节点处理测试](Test/README.md)。

可用 `./tools/npmw run diagnose -- --probe-domain gateway.icloud.com` 或 `--probe-ip 17.0.0.1` 在隔离的 Mihomo 回环环境中查看实际命中的规则与策略链；`--select 'Other Apple Service=美国'` 可模拟一次组内选择。诊断使用合成节点和本机下载的规则快照，所有出口终止在本地，不代表真实订阅当前选择、设备网络或 UDP 行为。

图标继续引用上游 SVG URL；相关 MIT 许可与署名见 [LICENSE](LICENSE)。
