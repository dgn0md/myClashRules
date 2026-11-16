# Apple 路由范围与边界

Apple 规则按明确的产品入口和共享服务端点分组。它们只选择网络路由和 DNS 出口，不解密 HTTPS，也不改变 Apple 账号、设备或内容授权状态。精确规则由 `Script/mihomoScript.js` 生成。

## 策略组

| 策略组 | 路由范围 | 默认选择 |
| --- | --- | --- |
| `Siri Ai/Apple Intelligence` | Apple Intelligence、Siri、PCC，以及与这些功能共用的部分 iCloud 和 Private Relay 端点。 | 固定使用 `美国` 选择器；没有符合筛选条件的美国候选时拒绝连接。 |
| `Apple Product地区` | News、TV/TV+、Fitness、Sports、Books、地区检测、Apple IP 集合。 | 初始美国，可在客户端切换到其他可用候选或直连。 |
| `Other Apple Service` | Apple 动态域名集合与其他常规 Apple 规则。 | 默认直连。 |
| `Apple海外媒体` | 少量共享购买和媒体接口。 | 选项默认关闭。 |
| `Apple模型下载直连` | 系统更新与 Apple 共用资源 CDN。 | 选项默认开启并由直连规则处理。 |

`AI` 组也锁定到美国选择器；Apple AI 组与通用 AI 组没有美国节点候选时不会回退到默认代理或直连。

## 规则顺序与 DNS

1. DNS 53 接管规则先处理进入 TUN 的 DNS 流量。
2. Apple 精确域名和产品例外先于广告、Apple CN 规则及可选 QUIC 拒绝。
3. 服务域名规则按启用状态进入对应服务组。
4. `apple_ip` 进入 `Apple Product地区`；`private_ip` 直连；其他服务 IP 集合按对应服务组分流。
5. `cn_ip` 位于专用 IP 规则之后，只负责剩余匹配的直连兜底。

每条精确域名或后缀域名规则都有对应的 `nameserver-policy`。动态 domain/classical provider 的 policy 也与路由目标组使用同一出口。IP-CIDR 集合本身没有查询域名；有对应域名 provider 的服务会使用相同目标组。

`cn` 域名集合参与 DNS 与 Fake-IP 过滤，不能用它替代一份完整的直连白名单。也不会把整个 Apple、Cloudflare 或 `17/8` 地址段强制代理。

## 共享端点与选择边界

- 国际 iCloud 内容规则按 `icloud-content.com` 后缀匹配；中国地区专用命名空间不匹配该规则。后缀只表示路由范围，不表示服务器实际所在地区。
- 共享 iCloud/Relay/Apple 媒体端点可能被多个产品使用。网络层只看到域名、IP 与协议元数据，不能根据 HTTPS 路径保证区分每个应用。
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
