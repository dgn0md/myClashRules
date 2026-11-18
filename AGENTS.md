# 项目维护约定

## 项目范围与产物

- 项目基于 AIsouler/MyClash `4861619be366c7bacabfed6d581bb8c450de1ca1` 全量版；上游约定见 `docs/upstream/AGENT.md`。
- 只维护 `Script/mihomoScript.js` 与 `Config/mihomoConfig.yaml` 两个全量产物，不增加精简版。`极简国内外分流模式` 是脚本选项。
- `Script/mihomoScript.js` 是规则、选项、节点处理和 DNS 行为的唯一来源；推送脚本或配置开关变更后，由 GitHub Actions 自动运行 `npm run build` 并提交更新后的 YAML，无需本地生成。
- YAML 的 `x-myClashRules` 扩展字段只供构建工具读取，Mihomo 内核不会执行。

## 必须保留的行为

- 保留上游地区、倍率、家宽分类，以及节点清理/补旗、零宽字符处理、去重、`dialer-proxy` 和节点 hosts 映射算法及其回归测试。
- 覆写或展开机场配置时，只处理节点信息。机场 DNS、`fake-ip-filter`、DNS policy、hosts 表、路由、策略组和其他非节点设置不得进入输出；这些设置由脚本生成。机场 DNS 只可用于节点解析安全检查和 hosts 改写条件判断；机场 hosts 只可用于改写节点 server。
- 严格加密 DNS 默认拒绝 system/DHCP、明文 UDP/TCP、跳过证书校验和不受支持的私有明文解析；不得静默回退。严格检查针对脚本生成的 DNS 配置，文档须区分机场输入与生成结果。
- 可路由的精确域名、后缀域名及动态 domain/classical 规则集，其 DNS policy 通常与路由目标组一致。Apple 例外：
  - `Other Apple Service` 连接默认直连；通用 `rule-set:apple`、`gateway.icloud.com` 和 `setup.icloud.com` 的 DNS policy 使用 `Siri Ai/Apple Intelligence` 当前选择。
  - `apple-dns.net` 和 `apple-dns.com` 路由到 `Apple Product地区`，DNS policy 使用该组。
  - `private`、`cn`、`douyin` 等保留集合和拒绝出口可用专用安全 policy。IP-CIDR provider 本身没有域名 DNS；对应服务域名规则集应使用同一出口。
- IP 规则顺序保留 `apple_ip`、`private_ip`、服务 IP、`cn_ip` 直连兜底的优先级，避免服务 IP 被通用 CN 集合先匹配。
- Apple 精确规则须先于广告、Apple CN 和可选 QUIC 拒绝规则。不得用整个 Apple、Cloudflare 或 `17/8` 网段代替精细端点分流。
- 策略组名称原样保留：`Siri Ai/Apple Intelligence`、`Apple Product地区`、`Other Apple Service`。
- 保留默认语义：`Other Apple Service` 默认直连；`Apple Product地区` 初始美国且可选直连；Siri 组优先选择美国，没有合格候选时拒绝连接。

## 文档、数据与验收

- 更新功能、默认值、组名或 DNS/路由行为时，检查 README、`docs/feature-matrix.md`、`docs/apple-routing.md` 和 `docs/rule-sources.md`。
- 区分静态 provider 与带 `--subscription` 的本地展开模式；不得声称静态 provider 能读取订阅中的私有 DNS、hosts 或动态节点名称。
- 不在功能文档混入个人观察、设备日志、真实出口地址或验证记录；不得新增或提交机场链接、密码、节点清单、缓存和运行日志。
- 图标沿用原 SVG URL，不修改 SVG；遵守 `docs/upstream/AGENT.md`，不补回 CDN 域名直连规则。
- GitHub Actions 的 `Verify full overrides` 在 runner 上生成 YAML 后运行 `npm test`、`npm run check` 和可获得的 Mihomo 原生配置校验；不要要求本地生成 YAML。单元测试或配置解析不能描述成用户网络抓包或 Apple 服务可用性实测；行为变化须有回归断言。
