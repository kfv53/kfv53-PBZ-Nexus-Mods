# Changelog — PBZWeatherControl（全地图天气与光照控制）

## v1.1.3
- **修复切回「地图原版」时原版大雨粒子不重新出现的问题**：恢复原版天气时改为调用完整的 `ensureNiagaraParticleActive()`（重新启用 `Rain System Spawning`、Tick、`Activate(true)` 与共享粒子参数），确保从晴天/雪天切回地图原版后，空中雨丝与雨滴粒子立刻恢复。

## v1.1.2
- **崩溃稳定性加固**：移除 `v1.1.0` 中在菜单暂停态下可能触发 UE5 原生崩溃的高危调用（`Hard Reset Cache()`、未注册光源组件的 `MarkRenderStateDirty()` / 多重 `RecaptureSky()`、`AkGameplayStatics.PostEventAtLocation()` 与 `DeactivateImmediate()`），改为仅对已激活主 `SkyLightComponent` 安全重捕，并采用纯 `Deactivate()` + `SetRTPCValue()` 方案。

## v1.1.1
- **彻底修复大雨→暴风雪/沙尘暴时「大雨残留并同时下雪」的幽灵粒子 Bug**：不再在组件已存在时重复调用 `Make Rain/Snow/Dust Component`（避免在 UDW 上动态叠加出关不掉的孤儿 `NiagaraComponent`），并新增全组件扫描清理 `deactivateAllMatchingNiagara()`，切换天气时一网打尽所有残留的雨/雪/沙尘粒子组件。
- **彻底修复暴风雪→沙尘暴时地面积雪残留的问题**：每次切换天气预设前先调用 `Clear All Material Parameters to Zero Coverage()` 并显式归零非当前天气的 `Max Material Snow Coverage`、`Shared Material Parameter Snowy` 与 `Dynamic Snow/Dust`，再写入新天气的材质层。

## v1.1.0
- **修复黄昏/时刻与云量变化不同步到场景光照的问题**：切换时间段或云层预设（晴天/晴间多云/多云/阴天）时，强制重置并重建 UDS 的太阳/天光/云层/雾效缓存（`Hard Reset Cache`、`Cache Sun and Moon Orientation`、`Cache Properties`、`ForceUpdateCache`），主动触发 `SkyLight.RecaptureSky()` 与主光源渲染状态刷新，并按 UDS `0..3` 区间同步 `Cloud Coverage`，让夕阳金光与云量变化真正照亮并影响整张地图。
- **修复切晴天后雨声依然持续的问题**：同步关闭 UDW 降雨音效（`Enable Rain Sounds`、`Rain Volume`、`RainAudio`）并直接通过 Wwise（`AkGameplayStatics`）将 `Rain` / `Rain_Playing` / `Amb_Weather_Volume` RTPC 归零、切换 `Weather_Rain` 状态为 `None` 并触发 `SFX_AMB_Weathe_Rain_Loop_Stop`；切回雨天或地图原版时自动恢复雨声。
- **修复大雨卡死无法调整、只能读档的问题**：将 `Change Weather` 改为 `0.0s` 瞬时切换并清除过渡状态机残留，非雨天时彻底禁用 `Enable Rain Particles` 并立即停止 `Rain_Particles`；同时新增 1.5 秒「防漂移守护（Drift Guard）」，当关卡天气触发器或体积覆盖试图把天气强行拉回大雨时自动重新压回玩家设定。

## v1.0.0
- 正式发布：基于游戏底层 `Ultra Dynamic Sky (UDS)` 与 `Ultra Dynamic Weather (UDW)` 实现全地图实时天气与光照控制系统，原生兼容 `PBZ Mods Menu`（自动跟随简/繁中文与英文）。
- **13 种实时天气预设**：地图原版、晴空万里、晴间多云、多云、阴天、浓雾、小雨、中雨、雷暴雨、小雪、大雪、暴风雪、扬沙、沙尘暴；自动开启并初始化对应 Niagara 飘雪/风沙/雨滴粒子与地面材质积雪/积沙上限。
- **7 种时间段 / 光照氛围预设**：地图原版、黎明破晓、清晨阳光、正午烈日、午后暖阳、黄昏夕阳、暮色微光、深夜月光。
- **精细光照与环境微调**：阳光强度倍率、环境天光倍率、雾效浓度倍率、色彩饱和度、太阳方位角偏移，以及晴朗天气自动烘干地面并隐藏房檐滴水粒子。
- **安全无损还原**：进图自动保存当前地图原版 `Global Weather State`、UDW 与 UDS 完整快照；默认模组开启但所有参数保持地图原版（零侵入），随时切回「地图原版」或关闭总开关即可立即无损恢复。
