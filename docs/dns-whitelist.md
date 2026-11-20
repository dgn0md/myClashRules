# 国内 DNS 白名单维护原则

本页是本仓库国内 DNS 查询范围、动态更新和后续维护的统一约定，与根目录 [AGENTS.md](../AGENTS.md) 一同遵守。修改规则源、DNS 生成逻辑、路由或相关开关前，先核对本页。行为由 `Script/mihomoScript.js` 实现，不能仅修改文档或生成 YAML 来改变默认值。

模块组织、来源选择和统一路由开关同时遵守 [开发原则](development-principles.md)；这些约定不替代本页独立的 DNS 授权边界。

## 基本边界

- 连接出口和 DNS 解析器分别决定。域名允许直连、命中国内 IP、属于国内服务或进入某个服务组，都不自动授权向国内公共 DNS 查询。
- 国内业务域名解析仅由启用的 DNS 白名单和下文列出的专项例外授权。其他业务查询使用国外加密 DNS；有专属服务 policy 的，保留对应服务组出口。服务组可以选择直连，因此“国外 DNS”不等同于“一定经代理”。
- 不配置通用 `direct-nameserver`，直连拨号与普通查询共用 `nameserver-policy` 和默认 `nameserver`。不得因域名未命中、连接直连或国外 DNS 失败而自动改用国内 DNS。
- 通用 `cn`、`geolocation-cn`、`douyin`、`.cn` 后缀和整家厂商/公共云集合不能自动成为国内 DNS 白名单。`cn` 不参与通用 DNS policy 或 Fake-IP 过滤，仅在可选 QUIC 规则引用时保留；`cn_ip` 继续承担连接直连兜底。
- 阿里、百度、B站、字节、中国移动/电信/联通、华为云、京东、网易、腾讯、小米国内服务路由模块只决定连接出口；有同源 `@!cn` 时排除对应海外子集。模块开关不改变 DNS 白名单、Fake-IP 过滤或解析器，不为整个厂商集合生成国内 DNS policy。
- `no-resolve` 只限制相应 IP 规则主动触发解析，不指定 DNS 上游，也不代替白名单。缓存和 Fake-IP 可减少或延后查询，不消除真实解析，也不扩大国内 DNS 授权范围。
- 严格加密 DNS 默认开启，生成配置不接受 system/DHCP、明文 UDP/TCP 或跳过证书校验；不添加明文或国内 DNS 的隐式故障回退。机场非节点 DNS 设置不得进入输出。

## 默认组合与开关

三个开关均默认开启，并独立于服务组开关、极简模式和 `国内服务优先直连`。关闭一个开关时，移除其 DNS provider 和 policy；不应移除其他白名单、改变连接路由或清除必要的 Apple 例外。同一域名仍可能被其他启用的白名单或专项例外覆盖，关闭单个集合不等于禁止它的一切国内解析。

| 开关 | DNS provider | 使用范围与维护限制 |
| --- | --- | --- |
| `国内CDN解析` | `dns_domestic_cdn` | Sukka `domestic_cdn`，国内服务资源/CDN 小集合；不替换为通用 `cdn` 或 `domestic` 全量集合。 |
| `微软下载解析` | `dns_microsoft_cdn` | Sukka `microsoft_cdn`，Microsoft 下载与静态资源；不扩大为整个 Microsoft、Azure 或登录/账号服务。 |
| `Steam下载解析` | `dns_steam_cn` | MetaCubeX `steam@cn` 动态成品，保留国内下载、更新与中国站条目；`steamserver.net`、`steamusercontent.com` 根域及子域明确使用国外 DNS。不能将成品描述为未经合并的纯 v2fly `@cn` 集合。 |

具体下载地址、格式和上游来源见 [规则来源说明](rule-sources.md)。这些 provider 只决定 DNS，不增加连接直连规则。不得为其下载域名或图标 CDN 补充直连规则。

## 动态更新保持现有方式

- 客户端使用 HTTP rule provider 直接拉取上游，`interval: 86400`；上游成员随更新变化，不在 CI 筛选、合并或重新发布一份仓库白名单。
- GitHub Actions 生成脚本/YAML 的 Raw/CDN 产物，以及下载公开规则进行验收，与客户端更新规则成员是两件事；不得混称为同一种更新机制。
- 更改脚本开关或静态 YAML 的构建选项仍需重新生成配置。不能声称 Mihomo 会执行 `x-myClashRules` 中的开关。
- 保留仅供 DNS 使用的 provider；关闭开关后不残留引用。不得为了清理路由依赖而删除仍被 DNS policy 引用的集合。
- 动态更新意味着信任上游成员范围。更换源或主动扩大白名单时，应说明用途、查询披露范围与已有例外的重叠，并同步回归和文档；不能以“国内可用”或“规则名含 CDN”替代成员审查。

## DNS 匹配优先级

1. 显式主机/后缀 policy 位于动态 rule-set policy 之前，保护 Apple/Siri 精确例外和 Steam 排除项。不能仅依赖域名更具体来假定优先级。
2. DNS 白名单的 rule-set policy 位于通用 Microsoft、Steam 等服务集合之前，使获准的 CDN 子集实际生效。
3. 其余域名使用各自服务 policy 或默认国外 DNS。移除的路由不得残留自动生成的 DNS policy。

路由规则顺序与 DNS policy 顺序分别检查，不能只验证其中一项。不能因下载优化把 Apple AI、Siri 或有地区要求的服务切到不对应的解析出口。

## 保留的专项例外

| 场景 | 解析约定 |
| --- | --- |
| 固定版本 `apple_cn` | 其直连路由启用时保留国内加密 DNS，不改成整份动态 `apple_cdn`。 |
| `Apple下载直连` 开启 | `gdmf.apple.com`、`mesu.apple.com`、`updates.cdn-apple.com`、`assets.cdn-apple.com` 四个精确域名保留国内加密 DNS。 |
| 无合格 Siri 地区候选，且普通 Apple 默认直连 | `rule-set:apple`、`gateway.icloud.com`、`setup.icloud.com` 保留国内加密解析回退；有合格候选时恢复跟随 Siri 组，关闭普通 Apple 默认直连时不启用此回退。 |
| 节点域名与 DoH 服务器启动解析 | 继续使用独立的国内加密 DNS，避免代理自依赖；不把这些专用解析器作为普通业务查询的通用兜底。 |
| 私有域名与拒绝出口 | 保留本地 hosts/专用 RCODE 安全处理；严格模式不为 LAN 名称查询系统或公共 DNS。 |

Apple 组名、地区约束和连接默认值继续遵守 [Apple 路由说明](apple-routing.md)。以上例外不是扩大其他业务查询范围的依据。

## 后续变更验收

- 改动前核对当前源文件、开关和上游实际成员；改动后同步本页、根目录维护约定、README、功能目录、规则来源、Apple 路由及测试说明。
- 配置回归覆盖静态 provider/展开订阅、极简模式、三个开关分别关闭与组合关闭、相关服务组关闭、国内路由关闭和 Apple 无合格地区候选场景。
- 原生回归保留实际 domain/classical 集合与生产匹配顺序，用隔离上游计数验证 A/AAAA、名单外域名、集合重叠、Steam 排除项及真实直连拨号没有额外查询未授权解析器。
- 行为变更通过项目测试、生成一致性与可用的 Mihomo 原生校验；只改文档时检查本地链接、原则一致性及差异格式，无需声称重新完成网络测试。
- 冷缓存首次连接、热缓存和国内 CDN 下载表现须在实际网络另行测量。DoH 仍向接收查询的服务商披露域名，保留的启动解析与 Apple 例外仍可能向国内解析器查询；不得据此声称“零 DNS 泄漏”或“延迟一定降低”。

验收方法与历史记录见 [验证说明](validation.md)，自动检查入口见 [测试说明](../Test/README.md)。
