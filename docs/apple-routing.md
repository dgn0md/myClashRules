# Apple 分流依据与边界

核对日期：2026-11-16。域名分流发生在加密连接外层，不解密 HTTPS，不读取用户请求内容。优先级见脚本末尾 `finalizeMyClashRules`；这些例外先于广告、Apple 国内、QUIC 和通用服务规则。

| 功能                             | 依据                                                                                                                                                                                                                          | 实现与边界                                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PCC / Intelligence Extensions    | [Apple 企业网络清单](https://support.apple.com/en-us/101555#aisirisearch)、[AppleFlow Apple-PCC 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Apple-PCC.yaml) | 精确端点与指定后缀覆盖 PCC 签发、ROPES、Mask、清理服务及 Apple relay 的 Cloudflare/Fastly/Akamai 域名；不代理整个 CDN。UDP 443 不被后续 QUIC 开关提前拒绝 |
| Siri / 搜索                      | [Apple 企业网络清单](https://support.apple.com/en-us/101555)、[AppleFlow Siri 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Siri-Direct.yaml) | `guzzoni.apple.com` 及子域、`siri.apple.com`、`dejavu.apple.com`、`sequoia.apple.com`、`smoot.apple.com` 及子域。按用户要求全部使用美国出口，不采用 AppleFlow 中文 Siri 直连规则；`smoot` 同时服务 Spotlight、Safari、News 等，无法仅凭域名拆分这些请求 |
| Siri 观察到的 API | 用户在 Siri 请求中观察到 `api-siri-prod.apple.com`；[社区规则原文](https://gist.github.com/byodian/1850cec35f46197d79e8bd1583c0f4bc) 也将其归入 Siri。Apple 官方企业网络清单尚未单列，具体职责未获官方确认 | 精确匹配到 `Siri`，DNS 同步经该组 DoH，优先于广告、Apple 国内与 QUIC 规则；随 `Siri` 开关启停，不扩展到子域或整个 Apple。补齐路由不代表已验证 Siri 恢复可用 |
| Siri 排查中的共享 iCloud 初始化接口 | 用户报告知识问答在规则模式报限额、全局模式成功，并观察到 `setup.icloud.com` 直连；[原始研究记录](https://www.scss.tcd.ie/Doug.Leith/pubs/apple_google_additional_material.pdf) 包含该主机的配置获取与账号初始化请求，不是 Siri 专用端点 | 按用户选择精确匹配 `setup.icloud.com` 到 `Siri`，DNS 同步经该组 DoH，随 `Siri` 开关启停。共享 iCloud 初始化流量也会代理；不覆盖子域、`.com.cn` 或整个 `icloud.com`。全局成功不证明该主机是故障原因，仍需设备侧验证 |
| Siri 相关共享 iCloud 接口 | 用户观察到 Siri 失败期间访问 gateway、edge 与地区根域；[Apple 企业网络清单](https://support.apple.com/en-us/101555) 将其列为 CloudKit/iCloud 服务，未认定为 AI 专用；用户选择整体代理国际内容域 | `Apple智能` 精确覆盖 `gateway.icloud.com`，并通过 `DOMAIN-SUFFIX,icloud-content.com` 覆盖内容域本身及所有子域。DNS 使用 `+.icloud-content.com` 经该组 DoH，不匹配 `.com.cn`。普通照片/文件/备份等国际内容也可能代理，无法按产品拆分；不覆盖整个 `icloud.com` 或 gateway 子域，也不证明 Siri 失败原因 |
| News                             | [DLC Apple 分类](https://github.com/v2fly/domain-list-community/blob/master/data/apple)、[AppleNews 规则维护者](https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/AppleNews)                             | 专用 API 与 `apple.news` 等内容入口；出版商网页仍按各自规则。新增端点采用小范围补充，不使用 `news` 关键字或全部新闻站点聚合                                                          |
| News 地区判断                    | [AppleNews 维护说明](https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Clash/AppleNews/README.md)、[DLC Intelligence 注记](https://github.com/v2fly/domain-list-community/blob/master/data/apple-intelligence) | `gspe1-ssl.ls.apple.com` 单独开关并与 Siri/PCC 共用美国地区选择。共享地区判断可能影响地图、eSIM、Watch 与运营商相关功能，不把它伪装成无副作用的 AI 端点 |
| TV / TV+                         | [DLC TV+ 分类](https://github.com/v2fly/domain-list-community/blob/master/data/apple-tvplus)、[Bett Rules](https://github.com/appshubcc/bett-rules)                                                                           | 维护小范围显式规则并每日加载 `apple-tvplus.mrs`，覆盖播放和 UTS API。`np-edge` / `play-edge` 与其他媒体共享，开启该组可能让部分其他媒体也代理                                        |
| Fitness+ / Sports / Books        | [Apple 媒体服务地区表](https://support.apple.com/en-us/118205)                                                                                                                                                                | 仅其产品专用 `fitness.apple.com`、`sports.apple.com`、`books.apple.com` 域。**专用域名不等于完整产品后端**；共享 iTunes API、授权与视频域名由媒体开关决定，不凭猜测补造大量 API 域名 |
| Private Relay                    | [Apple 企业网络清单](https://support.apple.com/en-us/101555)、[Private Relay 机制](https://support.apple.com/en-us/102602)                                                                                                    | 三个 `mask` 主机可能承载 Private Relay 流量，同时列于 AppleFlow PCC 清单；`Apple智能` 开启时会按精确主机走共同美国出口，即使独立 `AppleRelay` 开关关闭也可能影响 Safari 中继流量。不要把该范围扩大到整个 iCloud 或 CDN |
| Arcade / 海外购买 / 其他共享媒体 | [Apple 媒体服务地区表](https://support.apple.com/en-us/118205)、[DLC iTunes 分类](https://github.com/v2fly/domain-list-community/blob/master/data/itunes)                                                                     | 没有独占域名的流量无法在不解密的前提下保证按产品区分。`Apple海外媒体` 只提供显式、可关闭的共享接口出口；不把整个 App Store 或 Music 一并强制代理                                     |
| 资源下载                         | [Apple 软件与内容端点](https://support.apple.com/en-us/101555)                                                                                                                                                                | `gdmf`、`mesu`、`updates.cdn-apple.com`、`assets.cdn-apple.com` 作为共享系统/资源 CDN 默认直连；不是仅含 AI 模型的专属域名                                                           |

大陆是否提供某个产品以 Apple 当前地区清单为准。Apple Music 与 Classical 等已在大陆提供的服务不因“Apple 海外服务”而默认整体代理。路由配置不会改变 Apple 账号地区、设备资格、内容授权、SIM、系统语言或 GPS 位置，不能保证仅修改 IP 即可开通产品。

`AI`、`Apple智能`、`Siri`、`Apple地区检测` 与可选 `AppleRelay` 组都只指向同一个 `美国` 选择器；对应域名规则的 DNS policy 也使用相同组。没有名称匹配的美国候选时，该选择器为 `REJECT`，不会回退到 `默认代理`、其他地区或直连。候选仍按节点名称生成，名称不能证明公网出口国家；要把候选认定为已验证地区，须经节点实际连接并由两个独立地理来源核对。当前没有订阅节点，未进行该验证。地区相同也不代表出口 IP 固定；配置不会设置设备语言或保证英文 Siri 环境。

`profile.store-selected: true` 会保存策略组当前选择。YAML 中的成员顺序或默认项只表示初始化建议，不证明运行时保存的选择。Mihomo 的策略组状态、DNS 上游出口与目标连接出口应在用户设备日志中复核。

第三方 Siri AI 扩展继续使用动态 `category-ai-!cn` provider，并通过 `AI` 组及相同 DNS policy。没有把 AppleFlow 第三方域名复制成第二套活动规则；逐项 provider 覆盖报告见 [AppleFlow 覆盖审计](validation/appleflow-coverage.json)。`AppleFlow Siri-Direct` 中的主机按用户需求改走 Siri 美国组，而不是中文直连。

Apple 官方指出某些端点并不支持普通 HTTP 网页代理。TUN 转发 TCP/UDP 与 HTTPS MITM 是不同机制；本项目不实施 MITM。使用 iOS/macOS 客户端时，TUN/Network Extension 的权限与流量覆盖由客户端实现负责。

QUIC 拒绝开关默认关闭。开启时，精确 Apple 规则排在 UDP/443 拒绝规则前；这只验证规则选择顺序。实际 UDP 能力取决于节点的 `udp` 声明、客户端与服务端转发能力，不能从“未被 QUIC 规则拒绝”推断可用。`DST-PORT,53` 只接管 TUN 内的 UDP/TCP DNS，不会强制封锁应用自带的 DoH/DoT。

国际内容域使用 Mihomo 标准 [DOMAIN-SUFFIX 路由规则](https://wiki.metacubex.one/config/rules/) 和 [DNS 域名通配符](https://wiki.metacubex.one/handbook/syntax/)。`+.icloud-content.com` 覆盖根域与全部子域，范围与 `DOMAIN-SUFFIX,icloud-content.com` 一致。之前只匹配 edge 的正则遗漏 `ussjc1.icloud-content.com`，按用户最新选择改为整个国际内容域；无需再猜测主机命名结构。

### 国际内容域与中国站的区别

2026-11-13 通过证书验证的 Google DoH 实际查询（固定 IP 连接，未用明文 DNS）核实：

| 输入主机 | Apple DNS 返回的 CNAME | 当前分流例外 |
| --- | --- | --- |
| `edge-013.hkhkg2.icloud-content.com` | `edge-013.hkhkg2.ce.apple-dns.net` | 命中 `Apple智能` |
| `ussjc1.icloud-content.com` | `ussjc1.ce.apple-dns.net` | 命中 `Apple智能` |
| `hkhkg2.icloud-content.com` | `hkhkg2.ce.apple-dns.net` | 命中 `Apple智能` |
| `sgsin8.icloud-content.com` | `sgsin8.ce.apple-dns.net` | 命中 `Apple智能` |
| `edge-051.xactu3.icloud-content.com.cn` | `edge-051.xactu3.ce.apple-dns.cn` | 不命中，继续原规则 |
| `xactu3.icloud-content.com.cn` | `xactu3.ce.apple-dns.cn` | 不命中，继续原规则 |
| `gateway.icloud.com.cn` | `gateway.fe.apple-dns.cn` | 不命中，继续原规则 |

可复核 [ussjc1 DNS 查询](https://dns.google/resolve?name=ussjc1.icloud-content.com&type=A)、[国际 edge](https://dns.google/resolve?name=edge-013.hkhkg2.icloud-content.com&type=A)、[中国站根域](https://dns.google/resolve?name=xactu3.icloud-content.com.cn&type=A)、[中国站 edge](https://dns.google/resolve?name=edge-051.xactu3.icloud-content.com.cn&type=A)、[中国站 gateway](https://dns.google/resolve?name=gateway.icloud.com.cn&type=A)；结果随时间/解析位置变化。中国站实测标签是 `xactu3`，不能只排除假定的 `cn` 地区前缀。

这里的“非 CN”按国际域名命名空间定义，并非 GEOIP 非 CN 检查，不是完整大陆机房清单。即使国际域名以后解析到大陆 IP，仍会按域名规则代理；`.com.cn` 继续原规则，也不保证任意用户设置下都直连。真实 Siri 可用性和运营商网络仍需设备侧验证。
