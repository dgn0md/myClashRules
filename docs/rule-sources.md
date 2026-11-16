# 动态规则源评估

本节记录各上游公开的数据格式及其在本项目中的用途。

| 候选                                                                            | 原始证据                                                                                                                                                                                 | 与需求的关系                                                                                                   | 选择                                        |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [Bett Rules](https://github.com/appshubcc/bett-rules)                           | [README](https://github.com/appshubcc/bett-rules/blob/master/README.md)：每日同步，CN DNS 校验、海外库去除国内子域、服务 IP 去除大陆地址、MRS 细分                                       | 与 MyClash 原算法、`path-in-bundle`、全量服务分类匹配；CN 域名做 DNS、优化 CN IP 做路由兜底                    | 默认延续；补充独立 Apple 端点和 TV 动态子集 |
| [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)         | [README](https://github.com/MetaCubeX/meta-rules-dat/blob/master/README.md)：MRS、多种 geodata，CN 源为 ChinaMax_Domain                                                                  | 维护活跃且适合 Mihomo；广义 CN 库不直接等价于安全直连清单，不能证明替换后更省流量                              | 作为对照；不盲目替换全部 provider           |
| [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)         | [README](https://github.com/Loyalsoldier/clash-rules/blob/master/README.md)：每日构建 direct/proxy/reject 等集合、公开数据来源                                                           | 集合清晰；整体 direct 库替换无法保留全部细分与 DNS/IP 协同设计                                                 | 不整体覆盖                                  |
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | [AppleNews](https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/AppleNews)、[AppleTV](https://github.com/blackmatrix7/ios_rule_script/tree/master/rule/Clash/AppleTV) | 覆盖小产品端点及其规则边界；部分规则含进程或共享地区接口，需要区分 DNS domain、路由 classical 与客户端条件 | 作为端点证据，不直接叠加全部分类            |
| [SukkaW/Surge](https://github.com/SukkaW/Surge) | [Apple China Special Domains 固定版本](https://github.com/SukkaW/Surge/blob/0afc9c2ee92aadbf79ce1c9caf03f724135073ea/Source/non_ip/apple_cn.conf)：大陆专用主机规则 | 用于缩窄 Apple CN 直连范围；不会根据实时解析 IP 判断服务器地区 | 作为 `apple_cn` 上游；固定版本 |
## 实际采用的路由算法

1. 53 端口已入内核的流量转内置 DNS。
2. Apple 专用域名/TV 动态规则先行，防止被 Apple 国内库或 QUIC 屏蔽覆盖。
3. 广告规则与上游的国内服务、游戏/下载 CDN 例外。
4. 启用的 AI、YouTube、Telegram、Apple 等服务域名规则。
5. 海外域名默认代理；Apple IP 先进入产品地区组，私网 IP 保持直连，其余服务 IP 按对应服务组分流，优化 CN IP 在后作为剩余流量的直连兜底。

所有精确域名和后缀路由都会生成相同出口的 `nameserver-policy`；动态 domain/classical 规则集也按路由目标组绑定 DNS。Emby 关键词规则使用 classical inline rule-set，让路由与 DNS 共用同一匹配。

`cn` 库用于 DNS 策略与 Fake-IP 过滤，**不是 `RULE-SET,cn,直连` 的全量白名单**。原作者关于“CN DNS + CN IP 兜底”的设计被保留。没有把未知流量改成默认直连来人为压低代理计数。

## 当前节流改变

- Apple 专用组收敛为 `Siri Ai/Apple Intelligence`、`Apple Product地区` 与 `Other Apple Service`。Apple AI/Siri 保留精确域名规则；Apple 产品域名与 `apple_ip` 共用地区组，默认选美国并可手动选直连，且 `apple_ip` 排在 `cn_ip → 直连` 前面。普通 Apple 域名规则仍在 `Other Apple Service`，默认直连；模型/系统资源下载继续由独立直连规则控制。
- Apple AI/News/TV 等只选专用端点，模型/共享资源下载默认直连。
- 高/低倍率、家宽、自建和链式组保持可选；Private Relay 与共享海外媒体默认不开启代理例外。
- 只保留路由或 DNS 实际引用的 provider；依赖扫描同时覆盖两者，防止删除只供 DNS 用的 `cn`、`douyin`、`fakeip_filter`。
- 动态资源每天刷新，缓存路径不混淆 domain / ipcidr；下载失败保持内核正常的缓存/失败行为，不切换到明文 DNS。
