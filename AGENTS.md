# 项目维护约定

## 项目范围与产物

- 基于 AIsouler/MyClash `4861619be366c7bacabfed6d581bb8c450de1ca1` 全量版；上游维护约定保存在 `docs/upstream/AGENT.md`。
- 对外只维护 `Script/mihomoScript.js` 与 `Config/mihomoConfig.yaml` 两个全量产物，不增加精简版。`极简国内外分流模式` 是脚本选项，不是单独发布文件。
- `Script/mihomoScript.js` 是规则、选项、节点处理与 DNS 行为的唯一来源。使用 `npm run build` 更新静态 YAML，不手工制造两份不一致的规则。
- YAML 的 `x-myClashRules` 扩展字段只供构建工具读取，Mihomo 内核不会执行它们。文档与提交说明不得声称静态扩展开关无需重新生成即可生效。

## 必须保留的行为

- 保留上游地区、倍率、家宽、节点名称清理/补旗、零宽字符处理、去重、`dialer-proxy` 与节点 hosts 映射算法及其回归测试。
- 覆写/展开机场配置时只继承和处理节点信息。机场 DNS、`fake-ip-filter`、`nameserver-policy`、`proxy-server-nameserver-policy`、hosts 表、路由、策略组与其他非节点设置不得进入输出；这些字段由脚本完全生成。机场 DNS 只可用于节点解析安全检查和 hosts 改写条件判断，机场 hosts 只可用于改写节点 `server`，二者均不得复制到结果配置。
- 严格加密 DNS 默认拒绝 system/DHCP、明文 UDP/TCP DNS、跳过证书校验及不受支持的私有明文解析；不能静默回退。
- 可路由的精确域名、后缀域名和动态 domain/classical 规则集，其 DNS policy 通常与路由目标组一致。Apple 特例：`Other Apple Service` 的连接出口仍由该组选择（默认直连），但通用 `rule-set:apple`、`gateway.icloud.com` 与 `setup.icloud.com` 的 DNS policy 固定使用 `美国` 组；`apple-dns.net` 和 `apple-dns.com` 后缀则路由到 `Apple Product地区`，DNS policy 使用该产品组。`private`、`cn`、`douyin` 等保留集合与拒绝出口可使用专用安全 policy。IP-CIDR provider 本身没有域名 DNS；其服务域名规则集应使用同一出口。
- IP 规则顺序应保留 `apple_ip`、`private_ip`、服务 IP 与 `cn_ip` 直连兜底的优先级关系，避免专用服务流量先被通用 CN IP 集合接走。
- Apple 精确规则应先于广告、Apple CN 规则与可选 QUIC 拒绝规则。禁止用整个 Apple、Cloudflare 或 `17/8` 代理替代精细端点分流。
- 用户指定的策略组名称须原样保留：`Siri Ai/Apple Intelligence`、`Apple Product地区`、`Other Apple Service`。不要翻译或擅自改写大小写、空格或地区名。
- 保留 `Other Apple Service` 默认直连、`Apple Product地区` 初始美国且可切换直连、`Siri Ai/Apple Intelligence` 使用美区选择器并在缺少候选时拒绝的语义。

## 配置和文档

- 改变脚本规则或选项后运行 `npm run build`，生成的 YAML 必须与脚本一致。
- 更新功能、默认值、组名或 DNS/路由行为时，同步检查 README 与 `docs/feature-matrix.md`、`docs/apple-routing.md`、`docs/rule-sources.md` 等说明。
- 严格区分静态 provider 配置与带 `--subscription` 的展开生成模式；不要声称静态 provider 可以读取订阅内容中的私有 DNS、hosts 或动态节点名称。
- 不在功能文档里混入个别用户的观察、设备日志、真实出口地址或验证记录；不新增或提交用户的机场链接、密码、节点清单、缓存与运行日志。
- 图标沿用原始 URL，不修改 SVG；遵守 `docs/upstream/AGENT.md` 的兼容性与命名约定，不补回 CDN 域名直连规则。

## 验收

- 运行 `npm test`、`npm run check` 和可获得的 Mihomo 原生配置校验。
- 配置解析/单元测试不能表述为用户运营商网络抓包或 Apple 服务可用性实测。
- 不提交只有文档描述而没有回归断言的行为变化。
