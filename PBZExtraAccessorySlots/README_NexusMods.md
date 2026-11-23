# Extra Accessory Slots (PBZExtraAccessorySlots) — Nexus Mods Publishing Copy

## 1. Short Description (Bilingual — 168 chars / 232 UTF-8 bytes, safe under 250-byte limit)

```text
Add 0-12 extra unlocked accessory slots after vanilla slots 1-6 while keeping vanilla unlock progress. Live Mods Menu config. | 在原版6格后追加0-12个额外饰品栏，保留原版解锁进度，支持Mod菜单实时调整。
```

---

## 2. Main Description (Pure Nexus Mods BBCode — Paste in Source / BBCode Mode)

```bbcode
[size=5][b]Extra Accessory Slots (PBZExtraAccessorySlots)[/b][/size]
[b]English Description First | 下方附完整中文说明[/b]

[quote][b]Add 0–12 extra unlocked accessory slots to Phantom Blade Zero — without breaking your vanilla progression.[/b][/quote]

[size=4][b]Description[/b][/size]
Unlike mods that force-unlock all 6 base slots, [b]Extra Accessory Slots[/b] preserves the natural unlock state of your 6 vanilla slots and cleanly appends extra unlocked slots starting from Slot 7.

[b]Example:[/b] If you have naturally unlocked [b]3 of 6[/b] vanilla slots and set [b]Extra accessory slots = 1[/b] in Mods Menu, your equipment screen will display:
[list]
[*][b]Slots 1–3:[/b] Unlocked (vanilla)
[*][b]Slots 4–6:[/b] Locked (vanilla progression untouched)
[*][b]Slot 7:[/b] Unlocked (extra slot ready to equip)
[/list]

[line]
[size=4][b]Main Features[/b][/size]
[list]
[*][b]Progression-Friendly Additive Slots (0–12):[/b] Appends extra unlocked slots after Slot 6 without modifying vanilla slot unlock tags.
[*][b]100% Native UI Integration:[/b] Extends the Character Equipment screen's 3-column UniformGridPanel with matching slot size, spacing, selection visuals, and full mouse + keyboard/gamepad 2D navigation.
[*][b]Full Gameplay Effect Support:[/b] Applies real accessory GameplayEffects (including refinement levels and NG+/high-cycle bonuses) directly to your character, and automatically restores them across save reloads, map transitions, and respawns.
[*][b]Safe Auto-Unequip:[/b] Lowering the extra slot count or turning the mod OFF automatically unequips overflow accessories back into your inventory and cleanly removes their active effects.
[*][b]Save-Safe Loadout Persistence:[/b] Extra-slot equipment is stored in an independent JSON file in your Saved folder so vanilla save files are never corrupted.
[*][b]Optional Same-Type Uncap:[/b] Includes an optional toggle to lift the vanilla 3-accessories-per-category limit.
[*][b]Zero .pak Conflicts:[/b] Pure native script mod loaded via [b]PBZ Mods Menu[/b] — no stock files overwritten.
[/list]

[line]
[size=4][b]Mods Menu Settings and Defaults[/b][/size]
Open [b]Mods Menu[/b] in-game and select [b]Extra Accessory Slots[/b] to adjust everything live (changes apply immediately):
[list]
[*][b]Enable mod[/b] — [color=#6aa84f][b]Default: ON[/b][/color]
Master switch. Turning this [b]OFF[/b] safely unequips all extra-slot accessories back to your inventory and removes their active effects.
[*][b]Extra accessory slots[/b] — [color=#6aa84f][b]Default: 1[/b][/color] [i](Range: 0–12, Step: 1)[/i]
Number of extra unlocked slots appended after vanilla Slots 1–6. Decreasing this number automatically unequips overflow slots.
[*][b]Uncap same-type accessory limit[/b] — [color=#e06666][b]Default: OFF[/b][/color]
When [b]ON[/b], removes the vanilla restriction limiting you to at most 3 equipped accessories of the same category.
[/list]

[line]
[size=4][b]Requirements[/b][/size]
[list]
[*][b]PBZ Mods Menu[/b] [i](Required)[/i] — Native script loader and in-game configuration menu for Phantom Blade Zero.
[/list]

[line]
[size=4][b]Installation and Safe Uninstallation[/b][/size]
[b]Installation:[/b]
[list=1]
[*]Install [b]PBZ Mods Menu[/b] first and confirm it loads in-game.
[*]Extract this archive into your Phantom Blade Zero root directory (e.g. [b]...\SteamLibrary\steamapps\common\PBZ\[/b]).
[*]Verify the script is located at: [b]...\PBZ\ProjectPBZ\Content\JavaScript\PBZModsMenu\Mods\PBZExtraAccessorySlots\main.js[/b]
[*]Launch the game, open [b]Mods Menu -> Extra Accessory Slots[/b], and set your desired number of extra slots (0–12).
[/list]

[b]Safe Uninstallation (Save-Safe):[/b]
[list=1]
[*]In-game, open [b]Mods Menu -> Extra Accessory Slots[/b] and set [b]Extra accessory slots[/b] to [b]0[/b] (or turn [b]Enable mod[/b] to [b]OFF[/b]) so all extra-slot accessories are safely unequipped back to your inventory.
[*]Exit the game and delete the [b]PBZExtraAccessorySlots[/b] folder from [b]...\PBZ\ProjectPBZ\Content\JavaScript\PBZModsMenu\Mods\[/b].
[/list]

[line]
[size=5][b]额外饰品栏位（中文说明）[/b][/size]

[quote][b]为《影之刃零》在原版 6 个饰品栏位之后追加 0–12 个额外已解锁栏位——完全保留原版解锁进度，不破坏流程体验。[/b][/quote]

[size=4][b]模组简介[/b][/size]
与直接强行解锁全部原版槽位的 Mod 不同，本模组[b]不会改动原版 1–6 格的真实解锁状态[/b]，而是从第 7 格起干净地追加额外已解锁栏位。

[b]效果示例：[/b]假如你当前存档只解锁了前 [b]3[/b] 个原版饰品栏，在 Mods Menu 中将[b]额外饰品栏位数量[/b]设为 [b]1[/b]，装备界面会展示为：
[list]
[*][b]第 1–3 格：[/b]已解锁（原版进度）
[*][b]第 4–6 格：[/b]未解锁（保留锁图标，不提前解锁）
[*][b]第 7 格：[/b]已解锁（新增的额外栏位，可直接穿戴并生效）
[/list]

[line]
[size=4][b]主要功能[/b][/size]
[list]
[*][b]保留原版进度的追加式栏位（0–12 格）：[/b]从第 7 格起自由追加已解锁栏位，不修改原版槽位解锁标签。
[*][b]原生 3 列网格无缝融合：[/b]直接挂载到装备界面的原生 3 列 UniformGridPanel，图标尺寸、横纵间距、悬停选中效果与键鼠/手柄上下左右方向键导航均与原版一致。
[*][b]战斗与属性效果完整生效：[/b]自动应用饰品的真实 GameplayEffect（含精炼等级与高周目额外加成），并支持读档、切图、重生后自动恢复与重新挂载。
[*][b]调小栏位自动安全卸下：[/b]在菜单里调小额外栏位数量或关闭模组开关时，自动将超出范围的饰品安全卸下回背包并清除对应效果，不卡属性、不丢物品。
[*][b]存档安全独立持久化：[/b]额外栏位装备记录保存在 Saved 目录下的独立 JSON 中，不破坏原版存档结构。
[*][b]可选解除同类饰品上限：[/b]内置独立开关，可按需解除原版同类饰品最多装 3 个的限制（默认关闭）。
[*][b]零 .pak 冲突：[/b]基于 [b]PBZ Mods Menu[/b] 的纯脚本 Mod，不覆盖任何原版游戏文件。
[/list]

[line]
[size=4][b]Mods Menu 设置项与默认值[/b][/size]
游戏内打开 [b]Mods Menu -> 额外饰品栏位[/b] 即可实时调节（改动立即生效）：
[list]
[*][b]启用本模组（Enable mod）[/b] — [color=#6aa84f][b]默认：开启（ON）[/b][/color]
总开关。关闭时会自动把所有额外栏位的饰品安全卸下回背包并移除生效属性。
[*][b]额外饰品栏位数量（Extra accessory slots）[/b] — [color=#6aa84f][b]默认：1[/b][/color] [i]（范围：0–12，步进：1）[/i]
在原版 1–6 格之后追加的已解锁栏位数量。调小数值时会自动安全卸下多余槽位的饰品。
[*][b]解除同类饰品最多 3 个限制（Uncap same-type accessory limit）[/b] — [color=#e06666][b]默认：关闭（OFF）[/b][/color]
开启后可同时装备超过 3 个同一类别的饰品。
[/list]

[line]
[size=4][b]前置要求[/b][/size]
[list]
[*][b]PBZ Mods Menu[/b] [i]（必装）[/i] — 《影之刃零》原生 JS 模组加载器与游戏内配置菜单。
[/list]

[line]
[size=4][b]安装与安全卸载[/b][/size]
[b]安装步骤：[/b]
[list=1]
[*]先安装前置模组 [b]PBZ Mods Menu[/b] 并确认能在游戏内正常打开。
[*]将压缩包直接解压到《影之刃零》游戏根目录（例如 [b]...\SteamLibrary\steamapps\common\PBZ\[/b]）。
[*]确认脚本路径为：[b]...\PBZ\ProjectPBZ\Content\JavaScript\PBZModsMenu\Mods\PBZExtraAccessorySlots\main.js[/b]
[*]启动游戏，打开 [b]Mods Menu -> 额外饰品栏位[/b] 即可自由调整额外栏位数量（0–12）。
[/list]

[b]安全卸载（不坏档）：[/b]
[list=1]
[*]卸载前先在游戏内打开 [b]Mods Menu -> 额外饰品栏位[/b]，将[b]额外饰品栏位数量[/b]调为 [b]0[/b]（或关闭[b]启用本模组[/b]），让额外槽位里的饰品自动安全卸回背包。
[*]退出游戏，删除 [b]...\PBZ\ProjectPBZ\Content\JavaScript\PBZModsMenu\Mods\PBZExtraAccessorySlots[/b] 文件夹即可。
[/list]
```
