# PBZExtraAccessorySlots — 更新记录与模组内容整理

- **模组名称**：Extra Accessory Slots（额外饰品栏位）
- **Mod ID**：`PBZExtraAccessorySlots`
- **当前正式版本**：`v1.3.1`
- **适用游戏**：《影之刃零》（Phantom Blade Zero）
- **前置依赖**：`PBZ Mods Menu`（原生 JS 模组加载器与游戏内配置菜单）
- **工作区源码路径**：`E:\PBZ Mod WorkSpace\PBZExtraAccessorySlots\ProjectPBZ\Content\JavaScript\PBZModsMenu\Mods\PBZExtraAccessorySlots\main.js`
- **发布介绍文档**：`E:\PBZ Mod WorkSpace\PBZExtraAccessorySlots\README_NexusMods.md`

---

## 一、模组核心内容总览

### 1. 核心特性
- **保留原版 1–6 格解锁进度 + 第 7 格起追加已解锁栏位**：不修改原版 `AccessorySlotTags` 解锁标签。例如原版只解锁了 3 格且设置额外栏位为 `1`，界面显示为：前 3 格解锁、4–6 格保持未解锁锁图标、第 7 格已解锁。
- **原生 3 列网格无缝融合**：直接挂载到 `WB_Character_V4` 原版饰品区的 3 列 `UniformGridPanel`（复用 `95×95 SizeBox` 与 `W_ButtonBase_Accessory`），自动继承原版间距、选中动画，并接入 `ButtonGroup` 与完整 2D 键鼠/手柄焦点导航。
- **战斗与属性效果真实生效**：读取 `UE.PBZBackPackSubsystem.GetAccessoryEffectiveGEData(accId, level)` 中的 `SoftClassPtr` 与 `GELevel`，通过 `MakeOutgoingSpec` + `AssignTagSetByCallerMagnitude` + `BP_ApplyGameplayEffectSpecToSelf` 将饰品效果（含精炼等级与高周目加成）实时挂载到玩家 `AbilitySystemComponent`。
- **调小栏位 / 关闭开关自动安全卸下**：当额外栏位数量减少或总开关关闭时，自动对溢出槽位执行卸下并清除对应 `ActiveGameplayEffectHandle`，避免卡槽或属性残留。
- **独立持久化与切图/重生重挂**：额外栏位配装独立保存于 `AppData\Local\ProjectPBZ\Saved\PBZExtraAccessorySlots_loadout.json`，读档、切图或角色 `ASC` 重建时自动恢复并重新应用效果，不污染原版存档。
- **零 `.pak` 冲突**：纯脚本 Mod，不覆盖任何游戏原版文件。

### 2. Mods Menu 设置项与默认值
配置文件路径：`ProjectPBZ\Content\Paks\~mods\PBZExtraAccessorySlots.txt`

| 配置项 | 键名 | 类型 / 范围 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| 启用本模组 | `enabled` | Toggle (`On`/`Off`) | **On** | 总开关；关闭时自动安全卸下全部额外栏位饰品 |
| 额外饰品栏位数量 | `extraSlots` | Number (`0`–`12`, step `1`) | **1** | 原版 6 格之后追加的已解锁栏位数量；调小时自动卸下多余槽位 |
| 解除同类饰品最多 3 个限制 | `uncapSameType` | Toggle (`On`/`Off`) | **Off** | 开启后允许装备超过 3 个同一类别的饰品 |

---

## 二、版本更新记录（Changelog）

### `v1.3.1`（当前发布版 — 2026-11-22）
- **[修复]** 修正 `GetAccessoryEffectiveGEData` 返回结构体的字段读取：由 `GESoftClass` 更正为游戏真实字段 **`SoftClassPtr`** 与 **`GELevel`**，解决额外栏位装备饰品（如杀气 +25%、概率不耗暗源等）属性与被动未挂上角色 `ASC` 的问题。
- **[优化]** 增强软类加载失败时的诊断日志输出，记录原型键名以便快速定位特殊饰品。

### `v1.3.0`（2026-11-22）
- **[新增]** 完整接入 GAS `MakeOutgoingSpec` + `AssignTagSetByCallerMagnitude`（支持 `AddAttributes` SetByCaller 数值表）+ `BP_ApplyGameplayEffectSpecToSelf` 管线，并兼容 `AbilityDataGEData` 子效果。
- **[修复]** 修复 `getBackPackSubsystem` 上下文问题：`PBZBackPackSubsystem` 为 `WorldSubsystem`，改为优先使用 `Widget` / `PlayerPawn` / `PlayerController` 作为 `WorldContextObject`，解决读档初期无法自动恢复额外栏位的问题。
- **[优化]** 增强 `resolveSoftClass`，依次尝试 `Get()`、`LoadSynchronous()`、`LoadClassAsset_Blocking()` 与 `UE.Class.Load(Conv_SoftClassReferenceToString())`；每次穿/卸强制落盘日志。

### `v1.2.0`（2026-11-22）
- **[新增]** 引入直接 GAS GameplayEffect 挂载与句柄追踪机制（`appliedExtraHandles`），在 `OnEquipmentAccessory` 未生效时直接向玩家 `AbilitySystemComponent` 应用效果，并在卸下时通过 `RemoveActiveGameplayEffect` 精准移除。
- **[新增]** 增加 `reapplyAllExtraSlotEffects`：监测玩家 `ASC` 变化（切图、读档、重生），自动重新应用额外栏位饰品效果。

### `v1.1.0`（2026-11-22）
- **[修复]** 修复新增栏位间距与原版不一致的问题：动态探测原版 3 列 `UniformGridPanel` + `95×95 SizeBox` 布局（并将每行列数从 6 修正为 3），直接追加到同一 `UniformGridPanel` 第 3 行起，实现与原版 100% 一致的横纵间距与对齐。
- **[修复]** 针对 C++ `AssembleAccessory` 硬编码拒绝 `index >= 6` 的限制，改为直接写入 `AssemblyAccessory[index]` 并广播 `EquipAccessoryDelegate` / `TakeOffAccessoryDelegate`，同步接管 `WB_Character_V4.RemoveItem` 支持按卸下键移除额外槽位饰品。
- **[新增]** 增加额外栏位独立 JSON 持久化（`PBZExtraAccessorySlots_loadout.json`），防止原版存档截断第 7 格起的装备；增加 `ActiveGEs` 数量变化日志监测。

### `v1.0.0`（2026-11-22）
- **[首个功能版]** 实现 `WB_Character_V4` 原型注入（`InitAccessory`、`getAccessoryIndexFromButton`、`ReplaceAccessory`、`initButtonDelegate`、`unbindButtonDelegate`）。
- **[新增]** 在原版 1–6 格之后动态生成 `0–12` 个已解锁 `W_ButtonBase_Accessory` 按钮，保留原版 1–6 格解锁状态；接入 `ButtonGroup` 与 2D 网格方向键导航。
- **[新增]** 接入 `PBZModsMenu` 实时设置项（总开关、0–12 额外栏位数量、同类饰品 3 个上限开关），支持调小栏位时自动安全卸下回背包。

### `v0.1.0-probe` / `v0.1.1-probe`（开发探测阶段 — 2026-11-22）
- 纯只读运行期探测版本，验证 `PBZModsMenu` 注册回调、修正 `GetAllWidgetsOfClass` 参数顺序，并抓取 `PBZBackPackSubsystem`、`WB_Character_V4`、`W_ButtonBase_Accessory`、`W_UnifiedTextDescription` 等核心接口与源码。

---

## 三、Nexus Mods Changelog（可直接粘贴）

```text
v1.3.1
- Fixed accessory GameplayEffect soft-class resolution by reading SoftClassPtr and GELevel from GetAccessoryEffectiveGEData, ensuring all equipped extra-slot accessories apply their full stats and passive effects immediately.
- Fixed WorldSubsystem context lookup so saved extra-slot loadouts restore reliably on save load, map transitions, and respawns.
- Matched vanilla 3-column UniformGridPanel layout, 95x95 slot sizing, exact spacing, and full mouse + keyboard/gamepad 2D navigation.
- Added safe auto-unequip when lowering Extra accessory slots or disabling the mod, plus optional same-type 3-accessory limit bypass (default OFF).
```
