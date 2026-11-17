# myClashRules

myClashRules 是面向 Mihomo 的完整规则与配置生成项目，提供订阅节点整理、服务分流、严格加密 DNS、DNS 解析出口控制、Apple 服务细分路由和纯 IP 域名识别。脚本覆写、静态配置与本地订阅展开共用同一套规则生成逻辑。

## 项目能力

- **全量节点名称识别**：自动识别 26 个地区节点名称，以及倍率、家宽/住宅节点；按名称文字纠正冲突国旗。默认过滤面板、公告和网址行，包含地区名也会过滤。静态 provider 只能按正则筛选候选，不能重命名或纠正旗帜；地区名称也不证明实际出口地区。
- **完整订阅节点整理**：节点名称清理与补旗、去重、`dialer-proxy` 与必要的 hosts 节点映射均由项目脚本处理。
- **机场设置由脚本接管**：展开机场配置时只读取并处理节点；机场的 DNS、`fake-ip-filter`、DNS policy、路由、策略组及其他设置不会进入输出。最终 DNS、hosts、路由和开关都由本脚本生成。
- **单一规则来源**：`Script/mihomoScript.js` 定义选项、组、DNS 和路由；`Config/mihomoConfig.yaml` 是由它生成的全量静态配置。仓库只发布这两个全量产物。
- **DNS 与出口保持一致**：可路由的显式域名规则和动态 domain/classical 规则集使用与目标组对应的 DNS policy；私网、CN、douyin 等保留专用 DNS policy。Apple IP 与各服务 IP 规则先于 `cn_ip` 直连兜底。
- **服务组地区选择**：`AI`、`Google`、`TikTok`、`Meta` 与 `Siri Ai/Apple Intelligence` 等几十个自动分流策略组。这些组的 DNS 解析出口跟随该组当前选择。
- **Apple 细分为三个独立组**：`Siri Ai/Apple Intelligence`、`Apple Product地区`、`Other Apple Service`。范围与作用见[Apple 分流说明](docs/apple-routing.md)。
- **严格加密 DNS 默认开启**：机场 DNS 设置完全丢弃，最终配置使用脚本生成的加密解析；严格模式校验生成结果，不接受明文上游或不安全 TLS，也不静默降级。
- **纯 IP 入站的域名识别**：TUN 内的 HTTP Host、TLS SNI 与可识别 QUIC 握手可补充域名元数据；默认不改写实际目标地址，也不解密 HTTPS。
- **完整配置与静态配置共用构建链**：静态 YAML 的扩展开关经脚本生成后才生效；传入本地订阅文件时，构建工具也能按脚本算法处理实际节点。

## 发布入口

| 文件 | 用途 |
| --- | --- |
| [全量覆写脚本](Script/mihomoScript.js) | 输入含 `proxies` 数组的 Clash/Mihomo 配置，动态处理节点和完整路由。 |
| [jsDelivr CDN](https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.js) | GitHub Actions 每 3 小时请求并验证脚本响应。 |
| [全量静态配置](Config/mihomoConfig.yaml) | 使用 Mihomo 的 proxy provider 与 rule provider；也可由构建工具从订阅展开生成个人配置。 |

## 使用覆写脚本

将下列脚本链接导入支持 `main(config)` 的 Mihomo 脚本覆写客户端：

```text
https://raw.githubusercontent.com/dgn0md/myClashRules/main/Script/mihomoScript.js
https://cdn.jsdelivr.net/gh/dgn0md/myClashRules@main/Script/mihomoScript.js
```

第二个链接使用 jsDelivr CDN；定时任务每 3 小时检查该地址与 GitHub 源码。分支别名有缓存窗口，更新可能延迟。

在脚本顶部的 `ruleOptionsEnable` 中设置布尔选项。需要 Bettbox 图形界面的客户端可读取脚本提供的策略组开关元数据。自定义节点写入 `customizeProxies`；开启 `链式代理` 后，自定义节点作为落地节点，经 `链式中转` 组连接。

`自动选择ex(大陆&香港)` 开关默认生成同名测速组，取代原自动选择组，并作为 `GLOBAL`、`默认代理` 和通用服务组的候选。它按节点名称排除大陆和香港候选并保留台湾节点；有地区候选限制的服务组仍遵循其地区范围。构建器兼容旧设置键 `自动选择`；静态 YAML 更改后需重新生成。

## 使用静态配置

下载[全量 YAML](https://raw.githubusercontent.com/dgn0md/myClashRules/main/Config/mihomoConfig.yaml)，将 `proxy-providers.订阅.url` 改为自己的订阅链接，再导入 Mihomo 客户端。

静态 YAML 中的 `x-myClashRules.options` 是构建输入，Mihomo 内核不会执行这些扩展字段。更改选项后需重新生成。只需使用静态规则时，可在仓库根目录运行：

```sh
npm ci
node tools/build.js --settings Config/mihomoConfig.yaml --output .local/myConfig.yaml
```

如需让生成配置按脚本处理实际节点与节点 hosts 映射，先将订阅保存到已忽略的 `.local/subscription.yaml`，再运行：

```sh
node tools/build.js --settings Config/mihomoConfig.yaml --subscription .local/subscription.yaml --output .local/myConfig.yaml
```

展开模式会把节点写入生成文件。订阅更新后须重新生成；个人订阅和生成文件可能带有密码，不要提交到仓库。

## Apple 服务分组

| 策略组 | 默认行为 | 范围 |
| --- | --- | --- |
| `Siri Ai/Apple Intelligence` | 可选地区组排除香港、澳门、大陆及美国制裁/出口限制涉及地区；默认美国（有美国候选时）。无可用地区候选时拒绝连接，DNS 跟随当前选择。 | Apple Intelligence、Siri、PCC、地区检测端点及部分共享 Relay/iCloud 内容端点。 |
| `Apple Product地区` | 初始选择美国，可在客户端切换，包括直连。 | News、TV、Fitness、Sports、Books，以及 `apple_ip`。 |
| `Other Apple Service` | 默认直连。 | 广泛 Apple 域名规则，以及精确主机 `gateway.icloud.com`、`setup.icloud.com`。 |
| `Apple海外媒体` | 默认关闭。 | 可选共享购买和媒体接口。 |
| `Apple模型下载直连` | 默认开启。 | 系统与模型共用资源按直连规则处理。 |

共享域名可能同时服务多个 Apple 产品。国际 iCloud 内容规则按域名后缀匹配，可能覆盖照片、文件等普通流量；它表示路由范围，不证明服务器 IP 的地理位置，也不单独决定账号或设备资格。

## DNS 与路由边界

默认严格加密 DNS 使用固定 IP 的 AliDNS 与 DNSPod DoH 作为启动、节点和直连解析器；一般代理解析使用 Cloudflare 与 Google DoH，并将请求交给相应策略组。机场的 DNS resolver、`fake-ip-filter`、DNS policy 和其他 DNS 开关均会被丢弃，不会因其中含有 system/DHCP、明文 UDP/TCP 或跳过证书校验而阻断覆写。严格模式只校验脚本生成的 DNS 配置，不会静默降级。展开模式可用机场 hosts 映射改写节点 server，但不会把机场 hosts 表复制到输出。

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

更多说明：[功能目录](docs/feature-matrix.md)、[Apple 路由范围](docs/apple-routing.md)、[动态规则来源](docs/rule-sources.md)、[节点处理与兼容性测试](Test/README.md)。

## 来源与许可

本项目以独立仓库维护规则、DNS、路由与配置生成。项目起始代码来自 [AIsouler/MyClash@4861619](https://github.com/AIsouler/MyClash/commit/4861619be366c7bacabfed6d581bb8c450de1ca1)；相关 MIT 许可与作者署名见 [LICENSE](LICENSE)。图标按原 SVG URL 引用，不修改图形。
