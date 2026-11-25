<div align="center">

# 影之刃零 · 个人 Nexus Mods 仓库 (`kfv53-PBZ-Nexus-Mods`)

**简体中文** | [English](README_EN.md)

</div>

欢迎来到我的 **《影之刃零》（Phantom Blade Zero）个人 Nexus Mods 开源仓库**。
本仓库用于集中管理与维护我个人发布在 **Nexus Mods** 上的全部《影之刃零》模组，所有模组文件夹名称与 **Nexus Mods 页面同名**，均为基于 **PBZ Mods Menu** 的纯原生 Puerts JavaScript 模组（零 `.pak` 冲突、不覆盖游戏原文件）。

---

## 模组一览

| 模组名称（与 N 网同名） | 当前版本 | 功能简介 | 更新记录 |
| :--- | :---: | :--- | :---: |
| [**PBZDetailedWeaponDesc**](./PBZDetailedWeaponDesc) | `v1.3.1` | **武器与影之武装详细倍率扩展（标准版）**：以 100% 游戏原生字体与富文本配色，为全 48 把武器与影之武装补全引擎实读的招式倍率、派生变招、异常积累倍率及 100 条升级/异化精确数值（含未解锁预览），支持简/繁/英/韩四语自动跟随，切换武器 0 卡顿。 | [CHANGELOG](./PBZDetailedWeaponDesc/CHANGELOG.md) |
| [**PBZDetailedWeaponDesc_Dynamic**](./PBZDetailedWeaponDesc_Dynamic) | `v1.3.1-Dynamic` | **武器与影之武装详细倍率扩展（动态兼容可选版）**：N 网 Optional File，替代主文件使用。专为安装第三方武器/平衡修改 Mod 的玩家设计：按需实时读取内存中的 `BulletData` 与升级数值，并延迟追加底部出招表，避免覆盖其他武器 Mod 的自定义词条，同样支持简/繁/英/韩四语自动跟随。 | [CHANGELOG](./PBZDetailedWeaponDesc_Dynamic/CHANGELOG.md) |
| [**PBZEnemyStatusBars**](./PBZEnemyStatusBars) | `v1.3.4` | **敌人与 Boss 异常状态积累与倒计时指示环**：在普通敌人和 Boss 血条上方以游戏原生 270° 圆形进度环与图标实时展示 7 种异常状态（流血、中毒、燃烧、冰冻、感电、潮湿、混沌）的积累进度与 DoT 剩余时间，支持 Mod 菜单逐项自定义开关与尺寸。 | [CHANGELOG](./PBZEnemyStatusBars/CHANGELOG.md) |
| [**PBZExtraAccessorySlots**](./PBZExtraAccessorySlots) | `v1.3.1` | **额外饰品栏扩展**：在保留原版 1~6 号饰品栏自然解锁进度的前提下，在后续追加 0~12 个额外解锁饰品栏；完整支持原生 3 列网格排版、手柄/键鼠导航、真实 GAS 词条效果与精炼等级、独立 JSON 持久化及安全自动卸下。 | [CHANGELOG](./PBZExtraAccessorySlots/CHANGELOG.md) |

---

## 安装方法

1. 请先确保已安装前置框架 **[PBZ Mods Menu]**（Nexus Mods 上获取）。
2. 进入本仓库对应的模组目录，将其中的 `ProjectPBZ` 文件夹复制合并至《影之刃零》游戏根目录（如 `...\steamapps\common\PBZ\`）。
3. 启动游戏后，即可在游戏内 **Mods Menu** 中实时开关与调整各项配置。
   > **注意**：`PBZDetailedWeaponDesc`（标准版）与 `PBZDetailedWeaponDesc_Dynamic`（动态兼容版）请**二选一安装**，切勿同时启用。

---

## 免责声明 / 个人学习用途说明

- 本仓库中的所有模组与脚本代码均系**个人学习与技术交流用途**（用于学习 Unreal Engine 5 / Puerts / Gameplay Ability System 机制），**严禁用于任何商业用途或倒卖**。
- 所有模组均为纯单机客户端本地扩展，不涉及任何联机作弊或破坏游戏平衡的商业分发；但使用任何第三方模组前，仍建议自行备份游戏存档。
- 《影之刃零》（Phantom Blade Zero）及其所有游戏名称、美术资源、数据与商标均归灵游坊（S-GAME）所有。
