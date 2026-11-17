# 项目功能目录

本页描述当前源码和生成配置实际提供的行为，不记录个人测试过程。规则以 `Script/mihomoScript.js` 为准，静态配置由同一脚本生成。

## 项目结构

| 文件或目录 | 职责 |
| --- | --- |
| `Script/mihomoScript.js` | 规则、策略组、DNS、节点处理与所有开关的唯一来源。 |
| `Config/mihomoConfig.yaml` | 面向静态使用的全量生成配置。 |
| `tools/build.js` | 读取扩展开关，生成静态 YAML；可选载入本地订阅并展开节点。 |
| `Test/`、`tests/` | 节点处理与配置生成回归，以及 DNS/路由不变量检查。 |
| `tools/native-check.js`、`tools/native-sniffing.js` | 用 Mihomo 内核检查配置解析、规则加载及隔离的嗅探路由。 |
| `docs/upstream/` | 保存原始代码来源的维护约定与许可资料。 |

## 项目主要能力

| 能力 | 当前实现 | 使用边界 |
| --- | --- | --- |
| 完整订阅节点处理 | 识别地区、倍率、家宽分类，清理节点名称与旗帜，处理零宽字符，过滤公告/网址，去重并修复链式引用。 | 静态 provider 模式由内核对节点名过滤；需要完整订阅节点变换时使用展开生成。 |
| 地区与策略组 | 覆盖香港、日本、美国、新加坡、台湾、韩国、澳大利亚、印度、加拿大、德国、英国、法国、荷兰、西班牙、俄罗斯、乌克兰、土耳其、挪威、瑞士、瑞典、爱尔兰、菲律宾、印度尼西亚、越南、泰国和马来西亚。 | 按名称、国家代码或旗帜识别候选；公告/网站行优先过滤。节点名称不证明实际出口国家。 |
| 自动选择排除组 | `自动选择ex(大陆&香港)` 开关默认启用，取代原 `自动选择` 组；加入 `GLOBAL`、`默认代理` 和通用服务组候选。 | 按节点名称排除带大陆/内地/中国旗帜或香港/HK/HKG 标记的候选；保留“中国台湾”节点。静态 provider 使用 Mihomo 名称过滤，展开模式按标准化节点名称筛选。Google、AI、TikTok、Meta 和 Siri 保留现有地区候选限制；旧配置中的 `自动选择` 开关键会迁移为新开关。节点名称不能证明实际出口。 |
| 倍率与家宽节点 | 识别带 `x`、`倍` 等标记的倍率，区分低倍率与大于 1 的高倍率；识别家宽、住宅、原生 IP、ISP、RES 等住宅标签。 | `1x` 不归高倍率；节点编号如 `08` 不按倍率解释。默认只分类，倍率过滤开关默认关闭。 |
| 单一来源与双全量产物 | 脚本管理行为，YAML 通过构建器再生成；无第二份精简规则。 | 静态 YAML 中的扩展选项须重新生成。 |
| 细分 Apple 路由 | 采用 `Siri Ai/Apple Intelligence`、`Apple Product地区`、`Other Apple Service` 三组。 | 共享 HTTPS 主机无法按应用路径拆分；详见[Apple 路由范围](apple-routing.md)。 |
| DNS 与路由出口 | DNS resolver 跟随精确域名、后缀或动态 domain/classical provider 对应的 DNS 出口组。 | `Other Apple Service` 的连接仍由该组选择，默认直连；其通用 Apple DNS policy 跟随 `Siri Ai/Apple Intelligence` 当前选择，`.apple-dns.net` / `.apple-dns.com` 跟随 `Apple Product地区`。私网、CN、douyin 等保留集合使用专用 policy；IP-CIDR provider 不发起域名查询。 |
| 服务 IP 细分 | Apple 与 Google、Microsoft、Telegram、Steam、TikTok、Twitter、Meta、Netflix、Spotify 的 IP provider 分别使用对应服务组。 | 专用 IP 规则在通用 `cn_ip` 直连兜底之前；私网 IP 仍直连。 |
| 服务组地区选择 | `AI`、`Google`、`TikTok`、`Meta` 与 `Siri Ai/Apple Intelligence` 排除香港、澳门、大陆，以及俄罗斯、白俄罗斯、古巴、伊朗、朝鲜、克里米亚、顿涅茨克和卢甘斯克地区组；默认美国（有美国候选时）。 | 按完整地区组名筛选，台湾仍可选；服务组 DNS policy 跟随各自当前选择。`Other Apple Service` 的 DNS 复用 Siri 组。 |
| 机场配置覆盖 | 展开模式只读取机场 `proxies`，并可用机场 hosts 映射改写节点 server；其他机场设置不进入输出。 | DNS、`fake-ip-filter`、DNS policy、路由、策略组、hosts 表和其他非节点设置均由脚本重建；静态 provider 模式无法读取远端订阅节点或 hosts。 |
| 严格加密 DNS | DNS 上游、policy 与 Fake-IP 例外由脚本生成；严格模式校验最终输出，拒绝明文 DNS、system/DHCP 和不安全 TLS 配置，不会静默降级。 | 机场 DNS 设置全部丢弃；即使机场 DNS 含 system/DHCP、明文或跳过证书校验，也不会阻断脚本覆写。 |
| 纯 IP 域名嗅探 | 使用 HTTP Host、TLS SNI 与受支持的 QUIC 元数据补充规则匹配。 | 不解密 HTTPS，不改写目标地址；未进入 TUN 或无可见域名的流量仍按其他规则处理。 |
| 显式依赖管理 | rule provider 只在路由或 DNS policy 实际引用时保留；Emby 关键词使用 classical 匹配。 | 公开规则集内容随提供方更新而变化。 |
| 安全与客户端选项 | 可切换 TUN、IPv6、局域网访问、QUIC 阻断、PCDN hosts 规则、节点 IP 优先级和链式代理。 | 客户端权限和未进入内核的网络接口不受配置控制。 |

## Apple 组的职责

| 策略组 | 负责范围 | 默认与出口 |
| --- | --- | --- |
| `Siri Ai/Apple Intelligence` | Apple Intelligence、Siri、PCC、地区检测端点及少量共享 Relay/iCloud 内容端点。 | 默认美国，可切换到其他允许地区；没有可用地区候选时拒绝连接，DNS 跟随当前选择。 |
| `Apple Product地区` | News、TV、Fitness、Sports、Books、`apple_ip` 与 Apple DNS 的 `.apple-dns.net` / `.apple-dns.com` 域名。 | 默认美国，客户端可改选其他候选或直连。 |
| `Other Apple Service` | 广泛 Apple 动态域名集合、常规 Apple 服务及精确主机 `gateway.icloud.com`、`setup.icloud.com`。 | 默认直连。 |

共享域名可能承担多个功能；国际内容域后缀只定义匹配范围，不代表 IP 地理位置。模型/系统资源默认由直连规则处理；共享媒体代理选项默认关闭。

## 配置模式差异

| 模式 | 输入 | 节点处理 |
| --- | --- | --- |
| 脚本覆写 | Mihomo/Clash 展开后的配置，包含 `proxies` 数组。 | 运行完整订阅节点处理逻辑，并生成最终配置。 |
| 静态 YAML | 修改 `proxy-providers.订阅.url` 后导入 Mihomo。 | 通过内核 provider 与正则筛选；无法读取远端节点或 hosts，也无法在生成时处理节点名称。机场 DNS 等非节点设置不会被远端 provider 注入。 |
| 订阅展开 | 静态选项 YAML 加本地 `--subscription` 输入。 | 构建器只将节点与节点 hosts 映射交给同一脚本处理，机场 DNS/规则等其他设置不会带入；订阅变化后需要重新生成。 |

## 关键默认值

- 严格加密 DNS、TUN、DNS 53 接管、纯 IP 域名嗅探、IPv6 与 PCDN 拦截默认开启。
- Apple 服务默认启用；`Apple海外媒体` 默认关闭。
- `Apple Product地区` 初始选择美国；`Other Apple Service` 默认直连。
- `AI`、`Google`、`TikTok`、`Meta` 与 `Siri Ai/Apple Intelligence` 默认选择美国；上述排除地区组不作为这些组的候选。
- 局域网访问、非国内目标 QUIC 阻断、链式代理默认关闭。
- 低/高倍率节点过滤默认关闭；非地区信息节点过滤默认开启。
- `cn_ip` 仅是规则顺序靠后的直连兜底，不代表全部中国域名或地址集合都可直连。

更多维护约束见仓库根目录 `AGENTS.md`。
