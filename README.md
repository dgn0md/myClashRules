# myClashRules

myClashRules 是基于 [AIsouler/MyClash](https://github.com/AIsouler/MyClash) 全量脚本维护的 Mihomo 规则项目。它保留上游节点整理与服务分流能力，并把严格加密 DNS、DNS 与路由出口对齐、Apple 精细分组及纯 IP 域名嗅探整合到同一套生成逻辑。

## 本仓库的特色

- **全量上游能力继续维护**：地区、倍率、家宽节点分类，节点名称清理与补旗、去重、私有 DNS 和 hosts 处理、自定义节点及链式代理均沿用上游算法。
- **单一规则来源**：`Script/mihomoScript.js` 定义选项、组、DNS 和路由；`Config/mihomoConfig.yaml` 是由它生成的全量静态配置。仓库只发布这两个全量产物。
- **DNS 与出口保持一致**：可路由的显式域名规则和动态 domain/classical 规则集使用与目标组对应的 DNS policy；私网、CN、douyin 等保留专用 DNS policy。Apple IP 与各服务 IP 规则先于 `cn_ip` 直连兜底。
- **Apple 细分为三个独立组**：`Siri Ai/Apple Intelligence`、`Apple Product地区`、`Other Apple Service`。范围与副作用见[Apple 分流说明](docs/apple-routing.md)。
- **严格加密 DNS 默认开启**：直连解析使用加密 DNS，代理解析使用经对应代理组的 DoH；严格模式不接受明文私有 DNS 或不安全 TLS DNS，也不静默降级。
- **补充纯 IP 入站的域名识别**：TUN 内的 HTTP Host、TLS SNI 与可识别 QUIC 握手可补充域名元数据；默认不改写实际目标地址，也不解密 HTTPS。
- **完整配置与静态配置共用构建链**：静态 YAML 的扩展开关经脚本生成后才生效；传入本地订阅文件时，构建工具也能按脚本算法处理实际节点。

## 发布入口

| 文件 | 用途 |
| --- | --- |
| [全量覆写脚本](Script/mihomoScript.js) | 输入含 `proxies` 数组的 Clash/Mihomo 配置，动态处理节点和完整路由。 |
| [全量静态配置](Config/mihomoConfig.yaml) | 使用 Mihomo 的 proxy provider 与 rule provider；也可由构建工具从订阅展开生成个人配置。 |

没有独立精简版。`极简国内外分流模式` 是全量脚本内的选项，不是另一份发布产物。

## 使用覆写脚本

将下列脚本链接导入支持 `main(config)` 的 Mihomo 脚本覆写客户端：

```text
https://raw.githubusercontent.com/dgn0md/myClashRules/main/Script/mihomoScript.js
```

在脚本顶部的 `ruleOptionsEnable` 中设置布尔选项。需要 Bettbox 图形界面的客户端可读取脚本提供的策略组开关元数据。自定义节点写入 `customizeProxies`；开启 `链式代理` 后，自定义节点作为落地节点，经 `链式中转` 组连接。

## 使用静态配置

下载[全量 YAML](https://raw.githubusercontent.com/dgn0md/myClashRules/main/Config/mihomoConfig.yaml)，将 `proxy-providers.订阅.url` 改为自己的订阅链接，再导入 Mihomo 客户端。

静态 YAML 中的 `x-myClashRules.options` 是构建输入，Mihomo 内核不会执行这些扩展字段。更改选项后需重新生成。只需使用静态规则时，可在仓库根目录运行：

```sh
npm ci
node tools/build.js --settings Config/mihomoConfig.yaml --output .local/myConfig.yaml
```

如需让生成配置按脚本处理实际节点、节点 DNS 与 hosts，先将订阅保存到已忽略的 `.local/subscription.yaml`，再运行：

```sh
node tools/build.js --settings Config/mihomoConfig.yaml --subscription .local/subscription.yaml --output .local/myConfig.yaml
```

展开模式会把节点写入生成文件。订阅更新后须重新生成；个人订阅和生成文件可能带有密码，不要提交到仓库。

## Apple 服务分组

| 策略组 | 默认行为 | 范围 |
| --- | --- | --- |
| `Siri Ai/Apple Intelligence` | 使用 `美国` 选择器；缺少美区候选时拒绝连接。 | Apple Intelligence、Siri、PCC 及部分共享 Relay 端点。 |
| `Apple Product地区` | 初始选择美国，可在客户端切换，包括直连。 | News、TV、Fitness、Sports、Books、地区检测，以及 `apple_ip`。 |
| `Other Apple Service` | 默认直连。 | 广泛 Apple 域名规则，以及精确主机 `setup.icloud.com`。 |
| `Apple海外媒体` | 默认关闭。 | 可选共享购买和媒体接口。 |
| `Apple模型下载直连` | 默认开启。 | 系统与模型共用资源按直连规则处理。 |

共享域名可能同时服务多个 Apple 产品。国际 iCloud 内容规则按域名后缀匹配，可能覆盖照片、文件等普通流量；它表示路由范围，不证明服务器 IP 的地理位置，也不单独决定账号或设备资格。

## DNS 与路由边界

默认严格加密 DNS 使用固定 IP 的 AliDNS 与 DNSPod DoH 作为启动、节点和直连解析器；一般代理解析使用 Cloudflare 与 Google DoH，并将请求交给相应策略组。严格模式拒绝系统/明文上游、跳过证书校验和静默回退。需要机场私有 DNS 的订阅必须提供受支持的 DoH/DoT 或明确的 hosts/IP 映射。

默认启用 TUN、53 端口接管和纯 IP 域名嗅探；局域网代理监听默认关闭。嗅探仅补充路由可用的域名，不改写目标 IP，不覆盖未进入 TUN 的设备或链路。

IP 路由按专用服务集合处理：`apple_ip` 使用 `Apple Product地区`，私网地址直连，各服务 IP 使用对应服务组，`cn_ip` 最后承担剩余流量直连兜底。`cn_ip` 不是按域名地区划分的完整白名单。Apple 组也不会扩大成整个 Apple、Cloudflare 或整个 `17/8` 网段代理。

这些规则控制网络出口，不提供 Apple 服务解锁保证。账号地区、硬件、系统版本、服务端资格和客户端的流量接管范围仍会影响实际结果。

## 开发与维护

需要 Node.js 24 或更高版本。

```sh
npm ci
npm run build
npm test
npm run check
```

原生 Mihomo 检查可使用已安装的官方内核和当前公开规则文件：

```sh
node tools/download-rules.js .local/rules
node tools/native-check.js /path/to/mihomo .local/rules
```

更多说明：[功能目录](docs/feature-matrix.md)、[Apple 路由范围](docs/apple-routing.md)、[动态规则来源](docs/rule-sources.md)、[上游回归测试](Test/README.md)。

## 来源与许可

本项目基于 [AIsouler/MyClash@4861619](https://github.com/AIsouler/MyClash/commit/4861619be366c7bacabfed6d581bb8c450de1ca1)，保留上游 MIT 许可与作者署名。图标继续使用上游 SVG URL，不修改图形。项目许可见 [LICENSE](LICENSE)。
