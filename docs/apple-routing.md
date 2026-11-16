# Apple 分流范围与边界

Apple 域名分流依据公开的 Apple 企业网络资料、AppleFlow 清单及产品规则来源。规则在加密连接外层匹配，不解密 HTTPS。优先级由 `Script/mihomoScript.js` 中的规则定义决定。

| 功能 | 规则来源 | 分流范围与限制 |
| --- | --- | --- |
| PCC / Intelligence Extensions | [Apple 企业网络清单](https://support.apple.com/en-us/101555#aisirisearch)、[AppleFlow PCC 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Apple-PCC.yaml) | 精确端点与指定后缀归入 Siri AI 组；不将整个 CDN 纳入代理。UDP 443 屏蔽规则排在这些例外之后。 |
| Siri / 搜索 | [Apple 企业网络清单](https://support.apple.com/en-us/101555)、[AppleFlow Siri 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Siri-Direct.yaml) | Siri、听写、Spotlight 搜索相关端点共用 `Siri Ai/Apple Intelligence` 出口；共享端点可能服务其他 Apple 功能，不能只凭域名区分应用用途。 |
| News 与地区服务 | [AppleNews 规则](https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/AppleNews)、[DLC Intelligence 分类](https://github.com/v2fly/domain-list-community/blob/master/data/apple-intelligence) | News 专用接口与地区服务归入 `Apple Product地区`，与其他 Apple 产品共用选择器。地区服务也可能影响地图、eSIM、Watch 与运营商相关功能。 |
| TV / TV+ | [DLC TV+ 分类](https://github.com/v2fly/domain-list-community/blob/master/data/apple-tvplus)、[Bett Rules](https://github.com/appshubcc/bett-rules) | 采用有限的显式规则和动态 TV+ 规则集；部分播放接口与其他媒体服务共享。 |
| Fitness+ / Sports / Books | [Apple 媒体服务地区表](https://support.apple.com/en-us/118205) | 专用产品规则归入 `Apple Product地区`；共享 API、授权与视频接口不一定能按产品单独区分。 |
| Private Relay | [Apple 企业网络清单](https://support.apple.com/en-us/101555)、[Private Relay 机制](https://support.apple.com/en-us/102602) | 与 PCC 规则重叠的 Relay 端点使用 Siri AI 组，可能影响 Safari 中继流量；不扩展到整个 iCloud 或 CDN。 |
| Arcade、购买与共享媒体 | [Apple 媒体服务地区表](https://support.apple.com/en-us/118205)、[DLC iTunes 分类](https://github.com/v2fly/domain-list-community/blob/master/data/itunes) | `Apple海外媒体` 提供可关闭的共享接口出口；不将整个 App Store 或 Music 一并强制代理。 |
| 软件与系统资源 | [Apple 企业网络清单](https://support.apple.com/en-us/101555) | 共享下载与更新资源使用直连规则；这些资源不只服务 AI 模型。 |

Apple 产品是否在某地区提供，由账号地区、设备资格、内容授权、SIM、系统语言等因素共同决定，单独调整网络出口不能改变这些条件。

`Siri Ai/Apple Intelligence` 固定使用 `美国` 选择器；没有美区候选时拒绝连接。`Apple Product地区` 默认美国，并可切换地区或直连；`apple_ip` 与该组共用出口。`Other Apple Service` 承接广泛 Apple 域名规则并默认直连。私网 IP 先直连，服务 IP 规则先于通用 CN IP 直连规则。

节点名称只用于生成候选地区组，不能证明出口地理位置。`profile.store-selected: true` 保存运行时选择；策略组顺序只决定初始选择建议。DNS 上游与目标连接都依据运行时的策略组选择。

第三方 AI 使用动态 `category-ai-!cn` provider 与 `AI` 组及其 DNS policy；不复制 AppleFlow 第三方域名作为第二套活动规则。AppleFlow Siri 清单中由路由规则覆盖的主机使用 Siri AI 组，不采用中文 Siri 直连规则。

部分 Apple 端点不支持普通 HTTP 网页代理。TUN 转发与 HTTPS MITM 是不同机制，本项目不实施 MITM。iOS/macOS 客户端负责授予 Network Extension 权限并决定实际流量覆盖范围。

QUIC 屏蔽默认关闭。启用后，Apple 专用规则先于 UDP/443 拒绝规则。UDP 能力取决于节点的 `udp` 设置及客户端和服务端的转发能力。`DST-PORT,53` 只接管 TUN 内的 UDP/TCP DNS，不会封锁应用自带的 DoH/DoT。

国际 iCloud 内容使用有限后缀匹配，DNS policy 与域名出口组一致；中国地区专用命名空间不纳入该匹配。域名后缀表示规则匹配范围，不代表服务器的 IP 地理位置。
