# 仓库功能目录

本页描述当前源码和生成配置实际提供的行为，不记录个人测试过程。规则以 `Script/mihomoScript.js` 为准，静态配置由同一脚本生成。

## 仓库结构

| 文件或目录 | 职责 |
| --- | --- |
| `Script/mihomoScript.js` | 规则、策略组、DNS、节点处理与所有开关的唯一来源。 |
| `Config/mihomoConfig.yaml` | 面向静态使用的全量生成配置。 |
| `tools/build.js` | 读取扩展开关，生成静态 YAML；可选载入本地订阅并展开节点。 |
| `Test/`、`tests/` | 上游算法回归、生成配置回归、兼容性和 DNS/路由不变量。 |
| `tools/native-check.js`、`tools/native-sniffing.js` | 用 Mihomo 内核检查配置解析、规则加载及隔离的嗅探路由。 |
| `docs/upstream/` | 保存上游维护约定与许可证。 |

## 本仓库的主要特色

| 能力 | 当前实现 | 使用边界 |
| --- | --- | --- |
| 上游全量节点算法 | 延续地区、倍率、家宽分类，节点补旗与名称标准化，零宽字符匹配，信息节点过滤、去重与链式引用修复。 | 静态 provider 模式由内核对节点名过滤；需要完整订阅节点变换时使用展开生成。 |
| 地区与策略组 | 香港、日本、美国、新加坡、台湾节点按名称归类；可生成手动、自动、负载均衡、地区、倍率、家宽和自定义组。 | 节点名称只是筛选依据，不证明实际出口国家。 |
| 单一来源与双全量产物 | 脚本管理行为，YAML 通过构建器再生成；无第二份精简规则。 | 静态 YAML 中的扩展选项须重新生成。 |
| 细分 Apple 路由 | 采用 `Siri Ai/Apple Intelligence`、`Apple Product地区`、`Other Apple Service` 三组。 | 共享 HTTPS 主机无法按应用路径拆分；详见[Apple 路由范围](apple-routing.md)。 |
| DNS 与路由同组 | 可路由的精确域名、后缀及动态 domain/classical provider 的 DNS resolver 标签跟随路由目标组。 | 私网、CN、douyin 等保留集合使用专用 policy；IP-CIDR provider 不发起域名查询。 |
| 服务 IP 细分 | Apple 与 Google、Microsoft、Telegram、Steam、TikTok、Twitter、Meta、Netflix、Spotify 的 IP provider 分别使用对应服务组。 | 专用 IP 规则在通用 `cn_ip` 直连兜底之前；私网 IP 仍直连。 |
| 严格加密 DNS | 默认使用 DoH，按直连或代理策略组选出口；严格模式拒绝明文私有 DNS、系统 DNS 和不安全 TLS 配置。 | 无法安全兼容的机场 DNS 会报错，需要机场提供加密解析或 hosts/IP。 |
| 纯 IP 域名嗅探 | 使用 HTTP Host、TLS SNI 与受支持的 QUIC 元数据补充规则匹配。 | 不解密 HTTPS，不改写目标地址；未进入 TUN 或无可见域名的流量仍按其他规则处理。 |
| 显式依赖管理 | rule provider 只在路由或 DNS policy 实际引用时保留；Emby 关键词使用 classical 匹配。 | 上游集合内容随 provider 更新而变化。 |
| 安全与客户端选项 | 可切换 TUN、IPv6、局域网访问、QUIC 阻断、PCDN hosts 规则、节点 IP 优先级和链式代理。 | 客户端权限和未进入内核的网络接口不受配置控制。 |

## Apple 组的职责

| 策略组 | 负责范围 | 默认与出口 |
| --- | --- | --- |
| `Siri Ai/Apple Intelligence` | Apple Intelligence、Siri、PCC 及少量共享 iCloud/Relay 端点。 | 通过美国组；没有符合名称筛选的美国候选时使用拒绝策略。 |
| `Apple Product地区` | News、TV、Fitness、Sports、Books、地区检测与 `apple_ip`。 | 默认美国，客户端可改选其他候选或直连。 |
| `Other Apple Service` | 广泛 Apple 动态域名集合及常规 Apple 服务。 | 默认直连。 |

共享域名可能承担多个功能；国际内容域后缀只定义匹配范围，不代表 IP 地理位置。模型/系统资源默认由直连规则处理；共享媒体代理选项默认关闭。

## 配置模式差异

| 模式 | 输入 | 节点处理 |
| --- | --- | --- |
| 脚本覆写 | Mihomo/Clash 展开后的配置，包含 `proxies` 数组。 | 运行上游完整节点算法，并生成最终配置。 |
| 静态 YAML | 修改 `proxy-providers.订阅.url` 后导入 Mihomo。 | 通过内核 provider 与正则筛选；无法读取订阅内部节点 DNS/hosts，也无法在生成时处理节点名称。 |
| 订阅展开 | 静态选项 YAML 加本地 `--subscription` 输入。 | 构建器将节点交给同一脚本处理；订阅变化后需要重新生成。 |

## 关键默认值

- 严格加密 DNS、TUN、DNS 53 接管、纯 IP 域名嗅探、IPv6 与 PCDN 拦截默认开启。
- Apple 服务默认启用；`Apple海外媒体` 默认关闭。
- `Apple Product地区` 初始选择美国；`Other Apple Service` 默认直连。
- 局域网访问、非国内目标 QUIC 阻断、链式代理默认关闭。
- 低/高倍率节点过滤默认关闭；非地区信息节点过滤默认开启。
- `cn_ip` 仅是规则顺序靠后的直连兜底，不代表全部中国域名或地址集合都可直连。

更多维护约束见仓库根目录 `AGENTS.md`。
