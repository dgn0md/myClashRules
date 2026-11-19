# 动态规则来源与路由方式

本页说明规则数据由哪里来、如何参与路由和 DNS。活动配置仍以 `Script/mihomoScript.js` 为准，静态 YAML 由 GitHub Actions 运行构建器生成并回写；开发者无需本地生成。

维护与换源先遵守 [国内 DNS 白名单维护原则](dns-whitelist.md)。本页记录具体来源；不能因规则集名称、国内可用性或连接出口为直连，就扩大国内 DNS 的查询范围。

规则模块按 [模块化与动态规则集开发原则](development-principles.md) 设计：优先复用现用上游，核对实际成员后用集合关系控制范围，不逐域名维护同用途清单。

## 规则与技术依据来源

| 来源 | 本项目用途 | 更新与限制 |
| --- | --- | --- |
| [Bett Rules](https://github.com/appshubcc/bett-rules) | 常规服务、国内服务、CN IP、服务 IP、AI 与 TV+ 的 MRS rule provider。 | HTTP provider 按 Mihomo 配置定期更新，当前间隔为 86400 秒；源内容变化会改变成员。 |
| [Bett 厂商集合](https://github.com/appshubcc/bett-rules/tree/meta/geo/geosite) | 路由专用 `domestic_tencent`、`domestic_netease`、`domestic_bytedance`，分别配套 `_noncn` provider，使用同源 `tencent`/`netease`/`bytedance` 与对应 `@!cn` MRS。 | 六个 HTTP provider 每 86400 秒直接更新；运行时 AND/NOT 排除海外子集，不在 CI 合并或发布名单。三个模块统一受 `国内服务优先直连` 开关控制。海外标注不完整不等于剩余域名必然在大陆；不授权国内 DNS。 |
| [SukkaW Surge](https://github.com/SukkaW/Surge) | [`apple_cn` 固定版本规则](https://github.com/SukkaW/Surge/blob/0afc9c2ee92aadbf79ce1c9caf03f724135073ea/Source/non_ip/apple_cn.conf)：大陆专用 Apple classical 文本规则。 | 固定提交使规则内容可复现；它只表达规则列表，不判断解析 IP 的地理位置。 |
| [Sukka 国内 CDN](https://ruleset.skk.moe/Clash/non_ip/domestic_cdn.txt) 与 [Microsoft CDN](https://ruleset.skk.moe/Clash/non_ip/microsoft_cdn.txt) | DNS 专用 `dns_domestic_cdn`、`dns_microsoft_cdn`，使用 classical/text，分别受 `国内CDNDNS`、`微软下载DNS` 控制，默认开启。 | 客户端 HTTP provider 每 86400 秒直接更新；不在 CI 转换、筛选或重新发布。上游成员变化会扩大或缩小授权范围；沿用其 AGPL-3.0 声明。 |
| [MetaCubeX Steam 国内集合](https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam@cn.list) | DNS 专用 `dns_steam_cn` 使用同路径 MRS，受默认开启的 `Steam下载DNS` 控制。 | 仍由客户端每日直接更新。成品含宽泛服务器/用户内容后缀，脚本为 `steamserver.net`、`steamusercontent.com` 明确保留国外 DNS；其余国内下载、更新及中国站条目使用国内 DNS。不是直接解析 v2fly 原始文件，也不声称成品等同于纯 v2fly `@cn`。 |
| [Apple 企业网络清单](https://support.apple.com/en-us/101555) | 约束 PCC、Apple Intelligence、Siri、Relay 与资源端点的精确范围。 | 精确例外由脚本维护，不将整个 Apple 或 CDN 加入代理。 |
| [OpenAI API 支持国家/地区](https://developers.openai.com/api/docs/supported-countries)、[BIS 俄罗斯/白俄罗斯出口管制](https://www.bis.gov/licensing/country-guidance/russia-belarus)、[OFAC 地域制裁说明](https://ofac.treasury.gov/faqs/updated/2026-10-26) | 为 `AI`、`Google`、`TikTok`、`Meta` 与 `Siri Ai/Apple Intelligence` 的地区选择排除受限制地区组提供参考。 | OpenAI 页面列出支持地且未单列不支持地；BIS/OFAC 规则范围各异，不代表一张统一的 AI 服务禁用清单。按完整地区组名排除，当前节点地区定义中额外生效的是俄罗斯。 |
| [AppleFlow](https://github.com/Kianuni/AppleFlow) | [PCC 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Apple-PCC.yaml)、[Siri 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Siri-Direct.yaml)。 | 按固定版本整理端点；不复制整份第三方 AI 主机列表作为第二套活动规则。 |
| [Domain List Community](https://github.com/v2fly/domain-list-community) 与产品规则源 | Apple 产品分类和其他服务的分类参考。 | 服务专用域名不等于产品所有共享后端。 |

## Provider 类别

| Provider 类型 | 典型用途 | 路由与 DNS |
| --- | --- | --- |
| domain MRS | Apple、Google、Microsoft、Telegram、Steam、视频、AI 等服务域名。 | 代理服务的 DNS policy 跟随路由目标组；普通直连域名通过 DNS 白名单或默认国外 DNS 解析；`apple` 的连接目标是 `Other Apple Service`，DNS 使用 `Siri Ai/Apple Intelligence` 当前出口；更具体的 `.apple-dns.net` / `.apple-dns.com` 进入 `Apple Product地区` 并使用该组 DNS policy。 |
| ipcidr MRS | Apple 与 Google、Microsoft、Telegram、Steam、TikTok、Twitter、Meta、Netflix、Spotify 服务 IP。 | IP 规则直接选择服务组；同服务的 domain provider 使用相同出口。IPCIDR provider 本身没有域名 DNS 查询。 |
| domain/classical | 固定文本域名列表、精确/后缀路由和 Emby 关键词等匹配。 | 可路由的 domain 与 classical provider 按路由谓词建立 DNS policy；保留集合有专用 policy，关键词规则使用 classical inline set。 |

## 依赖与优先级

- 只保留被路由规则或 DNS policy 实际引用的 provider，避免删除仅供 DNS 使用的集合。
- 通用 `cn` 域名集合不再用于国内 DNS 策略或 Fake-IP 过滤，仅在可选 QUIC 豁免规则引用时保留；`cn_ip` 继续末端直连兜底。
- DNS 白名单只参与 `nameserver-policy`，不增加连接直连规则。三个开关独立于普通服务组、极简模式和国内路由开关，关闭后不加载相应 provider；重叠集合及专项例外仍分别生效。
- 白名单 policy 排在通用服务集合之前，让 CDN 子集不被 Microsoft/Steam 全量集合覆盖；Steam 的服务器/用户内容后缀使用显式国外解析 policy。显式主机/后缀 policy 排在所有 rule-set policy 之前，使 Apple/Siri 与 Steam 排除项在内核中实际优先。
- 移除通用 `direct-nameserver` 及其独立缓存/解析路径；未知域名即使连接直连，也按统一 policy 和默认国外 DNS 解析。国内路由集合不再自动获得国内 DNS，移除的路由也不残留 DNS policy。
- 国内解析例外还包括固定 `apple_cn`、启用模型直连时的四个 Apple CDN 精确域名，以及无合格 Siri 候选时普通 Apple 默认直连的既有解析回退。节点域名及 DNS 服务器启动解析仍使用国内加密 DNS。
- 缓存和 Fake-IP 减少或延后部分查询，不保证消除真实解析；名单外的国内网站/CDN 可能因国外解析得到不同节点，需要在实际网络测量首次连接和下载表现。
- Apple 产品 IP 使用 `apple_ip` 并路由到 `Apple Product地区`。该规则排在 `cn_ip` 前面。
- 私网 IP 使用 `RULE-SET,private_ip,直连,no-resolve`。Google、Telegram、TikTok、Twitter、Facebook/Meta IP 使用对应代理服务组并加 `no-resolve`；服务组关闭或极简模式下保留这些 IP provider，出口改为 `默认代理`，位于通用 CN IP 兜底之前。
- Apple、Microsoft、Steam、Netflix、Spotify IP 规则均加 `no-resolve`，保留各自服务组及其可选出口；此参数不改变代理/直连选择。
- 末端 `RULE-SET,cn_ip,直连` 保留解析能力，不加 `no-resolve`，为未命中前置域名规则的连接提供国内 IP 直连兜底。后续解析不会回头重新匹配已经跳过的服务 IP 规则。
- `no-resolve` 避免为匹配这些 IP 集合而触发域名解析；仍可匹配连接已有的目标 IP。域名路由和 DNS policy 独立生效。
- AI 使用 `category-ai-!cn` 域名集合，没有独立 AI IP provider；不以共享云/CDN 整段 IP 代替 AI 服务分类。
- 专用 Apple 域名例外排在 Apple CN 与 QUIC 拒绝规则之前。
- 测速域名 `cp.cloudflare.com` 使用精确代理规则和对应的 `默认代理` 加密 DNS policy，优先于动态规则。
- provider 的 IP 与域名集合来自不同数据类别；DNS 侧按域名匹配的 provider 设置策略，不把 IP 地址集合错误地当作 DNS 域名规则。

后续新增、替换或扩容 provider 时，记录用途、格式和实际成员范围，保留客户端直接每日更新方式；不得将通用 `cdn`、整厂商或公共云集合整体加入国内 DNS。

更新某个 provider 时，同时核对路由引用、DNS policy 引用和规则顺序，并在测试中固定 DNS/出口映射，包括 `Other Apple Service` DNS 跟随 Siri 组的约定。
