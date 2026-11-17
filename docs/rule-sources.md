# 动态规则来源与路由方式

本页说明规则数据由哪里来、如何参与路由和 DNS。活动配置仍以 `Script/mihomoScript.js` 为准，静态 YAML 通过 `npm run build` 生成。

## 上游来源

| 来源 | 本项目用途 | 更新与限制 |
| --- | --- | --- |
| [Bett Rules](https://github.com/appshubcc/bett-rules) | 常规服务、国内服务、CN IP、服务 IP、AI 与 TV+ 的 MRS rule provider。 | HTTP provider 按 Mihomo 配置定期更新，当前间隔为 86400 秒；源内容变化会改变成员。 |
| [SukkaW Surge](https://github.com/SukkaW/Surge) | [`apple_cn` 固定版本规则](https://github.com/SukkaW/Surge/blob/0afc9c2ee92aadbf79ce1c9caf03f724135073ea/Source/non_ip/apple_cn.conf)：大陆专用 Apple classical 文本规则。 | 固定提交使规则内容可复现；它只表达规则列表，不判断解析 IP 的地理位置。 |
| [Apple 企业网络清单](https://support.apple.com/en-us/101555) | 约束 PCC、Apple Intelligence、Siri、Relay 与资源端点的精确范围。 | 精确例外由脚本维护，不将整个 Apple 或 CDN 加入代理。 |
| [OpenAI API 支持国家/地区](https://developers.openai.com/api/docs/supported-countries)、[BIS 俄罗斯/白俄罗斯出口管制](https://www.bis.gov/licensing/country-guidance/russia-belarus)、[OFAC 地域制裁说明](https://ofac.treasury.gov/faqs/updated/2026-10-26) | 为 `AI`、`Google`、`TikTok`、`Meta` 与 `Siri Ai/Apple Intelligence` 的地区选择排除受限制地区组提供参考。 | OpenAI 页面列出支持地且未单列不支持地；BIS/OFAC 规则范围各异，不代表一张统一的 AI 服务禁用清单。按完整地区组名排除，当前节点地区定义中额外生效的是俄罗斯。 |
| [AppleFlow](https://github.com/Kianuni/AppleFlow) | [PCC 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Apple-PCC.yaml)、[Siri 清单](https://github.com/Kianuni/AppleFlow/blob/eb017c28c3a77ac1b36d0fa7c0aa7a190ffd532f/rules/clash/Siri-Direct.yaml)。 | 按固定版本整理端点；不复制整份第三方 AI 主机列表作为第二套活动规则。 |
| [Domain List Community](https://github.com/v2fly/domain-list-community) 与产品规则源 | Apple 产品分类和其他服务的分类参考。 | 服务专用域名不等于产品所有共享后端。 |

## Provider 类别

| Provider 类型 | 典型用途 | 路由与 DNS |
| --- | --- | --- |
| domain MRS | Apple、Google、Microsoft、Telegram、Steam、视频、AI 等服务域名。 | DNS policy 跟随路由目标对应的出口组；`apple` 的连接目标是 `Other Apple Service`，DNS 使用 `Siri Ai/Apple Intelligence` 当前出口；更具体的 `.apple-dns.net` / `.apple-dns.com` 进入 `Apple Product地区` 并使用该组 DNS policy。 |
| ipcidr MRS | Apple 与 Google、Microsoft、Telegram、Steam、TikTok、Twitter、Meta、Netflix、Spotify 服务 IP。 | IP 规则直接选择服务组；同服务的 domain provider 使用相同出口。IPCIDR provider 本身没有域名 DNS 查询。 |
| domain/classical | 固定文本域名列表、精确/后缀路由和 Emby 关键词等匹配。 | 可路由的 domain 与 classical provider 按路由谓词建立 DNS policy；保留集合有专用 policy，关键词规则使用 classical inline set。 |

## 依赖与优先级

- 只保留被路由规则或 DNS policy 实际引用的 provider，避免删除仅供 DNS 使用的集合。
- `cn` 域名集合用于国内 DNS 策略与 Fake-IP 过滤；`cn_ip` 是末端直连兜底。二者用途不同。
- Apple 产品 IP 使用 `apple_ip` 并路由到 `Apple Product地区`。该规则排在 `cn_ip` 前面。
- 私网 IP 直连规则和服务 IP 规则位于通用 CN IP 兜底之前。
- 专用 Apple 域名例外排在 Apple CN 与 QUIC 拒绝规则之前。
- provider 的 IP 与域名集合来自不同数据类别；DNS 侧按域名匹配的 provider 设置策略，不把 IP 地址集合错误地当作 DNS 域名规则。

更新某个 provider 时，同时核对路由引用、DNS policy 引用和规则顺序，并在测试中固定 DNS/出口映射，包括 `Other Apple Service` DNS 跟随 Siri 组的约定。
