# Apple 路由范围与边界

Apple 规则按明确的产品入口和共享服务端点分组。它们只选择网络路由和 DNS 出口，不解密 HTTPS，也不改变 Apple 账号、设备或内容授权状态。精确规则由 `Script/mihomoScript.js` 生成。

## 策略组

| 策略组 | 路由范围 | 默认选择 |
| --- | --- | --- |
| `Siri Ai/Apple Intelligence` | Apple Intelligence、Siri、PCC、`gspe1-ssl.ls.apple.com` 地区检测端点，以及部分 Private Relay/iCloud 内容端点。 | 可选地区组排除香港、澳门、大陆及美国制裁/出口限制涉及地区，默认美国（有美国候选时）；无可用地区候选时拒绝连接。DNS 与路由跟随该组当前选择。 |
| `Apple Product地区` | News、TV/TV+、Fitness、Sports、Books、Apple IP 集合与 `apple-dns.net` / `apple-dns.com` 服务域名。 | 初始美国，可在客户端切换到其他可用候选或直连。 |
| `Other Apple Service` | Apple 动态域名集合、其他常规 Apple 规则，以及精确匹配的 `gateway.icloud.com`、`setup.icloud.com`。 | 连接默认直连；DNS 使用 `Siri Ai/Apple Intelligence` 当前选择的出口。 |
| `Apple海外媒体` | 少量共享购买和媒体接口。 | 选项默认关闭。 |
| `Apple模型下载直连` | 系统更新与 Apple 共用资源 CDN。 | 选项默认开启并由直连规则处理。 |

`AI`、`Google`、`TikTok`、`Meta` 与 Apple AI 组都只提供允许地区组，排除香港、澳门、大陆、俄罗斯、白俄罗斯、古巴、伊朗、朝鲜、克里米亚、顿涅茨克和卢甘斯克；默认选择美国（有美国候选时）。DNS policy 指向各自服务组，因此解析出口随该组当前选择变化；没有任何合格地区候选时，Apple AI 组拒绝连接，不回退到默认代理或直连。组名按完整地区名匹配，因此台湾仍是允许选项。

## 规则顺序与 DNS

1. DNS 53 接管规则先处理进入 TUN 的 DNS 流量。
2. Apple 精确域名和产品例外先于广告、Apple CN 规则及可选 QUIC 拒绝。
3. 服务域名规则按启用状态进入对应服务组。
4. `apple_ip` 进入 `Apple Product地区`；`private_ip` 直连；其他服务 IP 集合按对应服务组分流。
5. `cn_ip` 位于专用 IP 规则之后，只负责剩余匹配的直连兜底。

每条精确域名或后缀域名规则都有对应的 `nameserver-policy`。DNS policy 跟随对应的出口策略组。`Other Apple Service` 的连接按该组当前选择路由，默认直连；它的通用 `rule-set:apple`、`gateway.icloud.com` 和 `setup.icloud.com` DNS 查询跟随 `Siri Ai/Apple Intelligence` 当前选择。`.apple-dns.net` 与 `.apple-dns.com` 通过更具体的后缀规则进入 `Apple Product地区`，DNS policy 也跟随该组。IP-CIDR 集合本身没有查询域名；有对应域名 provider 的服务会使用相同目标组。

`cn` 域名集合参与 DNS 与 Fake-IP 过滤，不能用它替代一份完整的直连白名单。也不会把整个 Apple、Cloudflare 或 `17/8` 地址段强制代理。

如果订阅没有合格的 Siri 地区候选，Siri 组仍拒绝连接。当 `Other Apple Service` 保持默认直连时，通用 Apple 集合及 `gateway.icloud.com`、`setup.icloud.com` 改用国内加密直连 DNS，维持普通 Apple 服务的直连可用性；一旦出现合格候选，其 DNS 再跟随 Siri 组。关闭普通 Apple 默认直连时，不启用此解析回退。

## 共享端点与选择边界

- 国际 iCloud 内容规则按 `icloud-content.com` 后缀匹配；中国地区专用命名空间不匹配该规则。后缀只表示路由范围，不表示服务器实际所在地区。
- 共享 iCloud/Relay/Apple 媒体端点可能被多个产品使用。`gateway.icloud.com` 与 `setup.icloud.com` 按精确主机归入 `Other Apple Service`；网络层只看到域名、IP 与协议元数据，不能根据 HTTPS 路径保证区分每个应用。
- 国际照片、文件或备份流量可能与 Siri 共用路由组，造成额外代理流量。
- 产品可用性还受账号地区、设备资格、系统版本、SIM 和服务端策略影响。地区组按节点名称筛选候选，不证明公网出口所在地。
- 部分 Apple 服务需要客户端的 TUN/Network Extension 能力；普通系统代理不一定覆盖所有流量。
- QUIC 阻断默认关闭。启用后 Apple 精确规则先于 UDP/443 拒绝规则；规则顺序不能保证代理节点支持 UDP。

## 规则来源

- Apple 企业网络清单：Apple 服务端点与网络要求。
- AppleFlow：PCC、Apple Intelligence 与 Siri 相关公开规则清单。
- Domain List Community、Bett Rules 与 Apple 产品服务规则：产品分类和动态域名集合。
- SukkaW Surge 固定版本：大陆专用 Apple 域名 provider。

这些来源用来界定规则范围；规则并不代表完整的 Apple 后端清单。
