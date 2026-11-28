# Nexus Mods Publishing Kit — PBZWeatherControl v1.1.3

---

## 1. Basic Metadata

- **Mod Name**: `PBZ Weather and Lighting Control`
- **Category**: `Visuals and Graphics` (or `Gameplay` if `Visuals and Graphics` is unavailable)
- **Version**: `1.1.3`
- **Release Archive**: `PBZWeatherControl_v1.1.3.zip`
- **Requirements**: `PBZ Mods Menu` (Required — list in Requirements tab)

---

## 2. Short Description (Verified ≤ 240 UTF-8 bytes & ≤ 350 chars)

```text
Change weather, time of day, sunlight, fog, and ground dryness live in any map via PBZ Mods Menu. 支持任意地图实时切换晴天/大雪/沙尘暴等天气与时间光照，可无损恢复原版。
```

---

## 3. File Upload Fields (Each Verified ≤ 220 UTF-8 bytes)

- **File Name**: `PBZWeatherControl`
- **File Version**: `1.1.3`
- **File Description**:
```text
Real-time weather and lighting controller for any map via PBZ Mods Menu. 任意地图实时天气与光照控制。
```
- **File Upload Changelog**:
```text
v1.1.3: Fixed rain particles not reappearing when restoring Map Default after sunny/snowy presets; includes v1.1.x lighting, Wwise audio, and crash fixes.
```

---

## 4. Generative AI Disclosure (Nexus Mods Form)

- **Mod Content**: `AI Assisted`
- **Media**: `No` (All screenshots and the 6-panel cover banner are 100% real in-game captures with programmatic text labels)
- **Brief Note**:
```text
Feature design, in-game testing across maps, and all screenshots/cover media were created manually; AI assisted with Puerts JavaScript scripting and documentation.
```

---

## 5. Full Nexus Mods Description (BBCode — Paste in Source / BBCode Mode)

[size=4][b]Description[/b][/size]

Tired of Pangzhen always being overcast and rainy, or want to explore any chapter of [b]Phantom Blade Zero[/b] under bright sunshine, heavy snow, dramatic sunset, or a roaring sandstorm?

[b]PBZ Weather and Lighting Control[/b] hooks directly into the game's native [b]Ultra Dynamic Sky (UDS)[/b] and [b]Ultra Dynamic Weather (UDW)[/b] systems, letting you switch weather presets, time of day, sunlight, ambient sky light, fog density, color saturation, and sun direction [b]in real time on any map[/b] — directly from [b]PBZ Mods Menu[/b].

All settings start at [b]Map Default[/b] (zero changes until you adjust an option), and the mod automatically snapshots each map's original weather and lighting state on load so you can restore the vanilla atmosphere losslessly at any time.

[size=3][b]Main Features[/b][/size]
[list]
[*][b]Works on Any Map[/b]: Not limited to Pangzhen — automatically detects the active map's weather and sky actors on every map transition or save load.
[*][b]13 Built-In Weather Presets[/b]: Map Default, Clear Skies, Partly Cloudy, Cloudy, Overcast, Foggy, Light Rain, Rain, Thunderstorm, Light Snow, Snow, Blizzard, Dusty, and Sandstorm.
[*][b]Real Particles and Ground Coverage[/b]: Automatically activates native Niagara snow, dust, and rain particle systems and lifts per-map snow/dust/wetness caps so snow and sandstorms work even on rainy maps like Pangzhen.
[*][b]7 Time-of-Day Lighting Moods[/b]: Map Default, Dawn (05:48), Morning (08:00), Noon (12:00), Afternoon (15:30), Sunset (17:36), Dusk (19:00), and Night (22:30).
[*][b]Fine Lighting and Fog Sliders[/b]: Real-time multipliers for Sunlight Intensity, Sky / Ambient Light, Fog Density Scale (set to 0.0 for crystal-clear visibility), Color Saturation, and Sun Direction Offset (-180 to +180 degrees).
[*][b]Auto Dry Ground in Clear Weather[/b]: Automatically removes wet ground reflections and hides eaves rain-drip particles when switching to sunny or non-rainy presets.
[*][b]Lossless Map Default Restore[/b]: Snapshots each map's original Global Weather State, UDW, and UDS values — turn off the master toggle or select Map Default to immediately restore the original rain/snow/lighting.
[*][b]Auto Language Support[/b]: Automatically switches menu labels between English and Chinese (Simplified / Traditional) based on your game language.
[*][b]Pure Native JS Mod[/b]: Zero .pak conflicts, no vanilla files overwritten, and does not modify save files.
[/list]

[size=3][b]Mod Menu Settings (Defaults)[/b][/size]
[list]
[*][b]Enable Weather Control[/b]: On (master switch; turn Off to immediately restore the current map's original weather and lighting)
[*][b]Weather Preset[/b]: Map Default
[*][b]Time of Day / Lighting[/b]: Map Default
[*][b]Sunlight Intensity[/b]: 1.0 (range 0.0 to 4.0)
[*][b]Sky / Ambient Light[/b]: 1.0 (range 0.0 to 4.0)
[*][b]Fog Density Scale[/b]: 1.0 (range 0.0 to 2.0; 0.0 removes fog)
[*][b]Color Saturation[/b]: 1.0 (range 0.2 to 2.0)
[*][b]Dry Ground in Clear Weather[/b]: On
[*][b]Sun Direction Offset[/b]: 0 (range -180 to +180 degrees)
[/list]
[b]Tip[/b]: In PBZ Mods Menu, press [b]R[/b] (Restore Default) on any slider to snap it straight back to its vanilla default value (1.0 for multipliers, 0 for angle offset).

[size=3][b]Requirements[/b][/size]
[list]
[*][b]PBZ Mods Menu[/b] (Required)
[/list]

[size=3][b]Installation and Safe Uninstallation[/b][/size]
[list]
[*][b]Mod Manager (Recommended)[/b]: Install [b]PBZWeatherControl_v1.0.0.zip[/b] directly with Vortex or your preferred mod manager.
[*][b]Manual Install[/b]: Extract [b]PBZWeatherControl_v1.0.0.zip[/b] into your Phantom Blade Zero game root folder so that [b]ProjectPBZ/Content/JavaScript/PBZModsMenu/Mods/PBZWeatherControl/main.js[/b] is placed correctly.
[*][b]Uninstall[/b]: Delete the [b]PBZWeatherControl[/b] folder (and optional [b]PBZWeatherControl.txt[/b] in [b]ProjectPBZ/Content/Paks/~mods/[/b]). Save files are never touched and remain 100% safe.
[/list]

[size=3][b]Changelog[/b][/size]
[list]
[*][b]v1.1.3[/b]: Fixed sunset/time-of-day lighting and cloud updates on world terrain, silenced Wwise rain audio in clear weather, fixed ghost heavy rain persisting into snow/sandstorm, fixed leftover ground snow on Blizzard to Sandstorm transitions, hardened crash safety, and fixed rain particles not reappearing when restoring Map Default.
[*][b]v1.0.0[/b]: Initial release — 13 real-time weather presets, 7 time-of-day moods, full lighting/fog/angle sliders, snow/dust/rain Niagara particle activation, dry ground toggle, and lossless per-map original state restore.
[/list]

[line]

[size=4][b]中文说明[/b][/size]

受够了庞镇总是阴雨绵绵？或者想在晴空万里、漫天大雪、黄昏夕阳或狂风沙尘暴中探索《影之刃零》的任意章节？

[b]PBZ Weather and Lighting Control（全地图天气与光照控制）[/b] 直接接入游戏底层的 [b]Ultra Dynamic Sky (UDS)[/b] 与 [b]Ultra Dynamic Weather (UDW)[/b] 天气系统，支持在[b]任意当前地图[/b]通过 [b]PBZ Mods Menu[/b] 实时切换天气、时间段、光照强度、雾效浓度、饱和度与太阳方位角。

模组默认开启但所有选项均为[b]地图原版[/b]（不主动修改原版画面），每次进图都会自动记录该地图的原版快照，随时切回「地图原版」或关闭总开关即可立即无损恢复原版天气与光照。

[size=3][b]主要功能[/b][/size]
[list]
[*][b]全地图通用[/b]：不限于庞镇，切图或读档后自动识别当前地图的天气与天空系统并无缝生效。
[*][b]13 种实时天气预设[/b]：地图原版、晴空万里、晴间多云、多云、阴天、浓雾、小雨、中雨、雷暴雨、小雪、大雪、暴风雪、扬沙、沙尘暴。
[*][b]完整粒子与积雪/风沙效果[/b]：自动初始化并激活官方雪花/风沙/雨滴 Niagara 粒子系统，并解除庞镇等地图的积雪上限，让你在庞镇也能看到漫天飞雪与地面积雪。
[*][b]7 种时间段光照氛围[/b]：地图原版、黎明破晓 (05:48)、清晨阳光 (08:00)、正午烈日 (12:00)、午后暖阳 (15:30)、黄昏夕阳 (17:36)、暮色微光 (19:00)、深夜月光 (22:30)。
[*][b]精细光照与去雾微调[/b]：实时调节阳光强度倍率、环境天光倍率、雾效浓度倍率（调至 0.0 可彻底去雾）、色彩饱和度与太阳方位角偏移（-180° 至 +180°）。
[*][b]晴朗天气自动烘干地面[/b]：切换至晴天等无雨天气时，自动消除地面潮湿反光并隐藏房檐滴水粒子。
[*][b]一键无损恢复原版[/b]：自动备份当前地图的原版 Global Weather State、UDW 与 UDS 状态，关闭总开关或选回「地图原版」立刻恢复原版降雨与光照。
[*][b]多语言自动跟随[/b]：根据游戏语言自动切换中文或英文菜单。
[*][b]纯原生 JS 模组[/b]：无需打包 .pak、不覆盖游戏原文件、不修改存档，随时安全卸载。
[/list]

[size=3][b]前置需求与安装方法[/b][/size]
[list]
[*][b]前置要求[/b]：必须先安装 [b]PBZ Mods Menu[/b]。
[*][b]安装方法[/b]：使用 Mod 安装器直接安装 [b]PBZWeatherControl_v1.0.0.zip[/b]，或手动解压将 [b]ProjectPBZ[/b] 文件夹合并至游戏根目录。
[*][b]快捷键提示[/b]：在 Mods Menu 中选中任意倍率滑块按 [b]R[/b] 键即可快速恢复默认原版值（倍率 1.0 / 偏移 0）。
[/list]

[size=3][b]更新记录[/b][/size]
[list]
[*][b]v1.1.3[/b]：修复黄昏/时刻与云量变化未同步至地图实际光照的问题；修复切晴天后雨声仍持续的问题（联动静音 UDW 与 Wwise 雨声）；彻底修复大雨切暴风雪/沙尘暴时的幽灵大雨与地面积雪残留；加固崩溃安全性；修复切回「地图原版」时原版雨丝粒子未重新出现的问题。
[*][b]v1.0.0[/b]：正式首发，支持全地图 13 种天气预设、7 种时间段光照、完整光照/去雾/方位角滑块、飘雪/风沙粒子激活、晴天烘干地面及无损恢复原版。
[/list]
