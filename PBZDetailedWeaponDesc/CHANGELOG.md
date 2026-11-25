# Changelog — PBZDetailedWeaponDesc (Standard Edition)

## v1.4.0
- Added full authentic **Russian (`ru`)** localization aligned strictly with official *Phantom Blade Zero* Russian terminology (`ru/Game.locres`, e.g. `Фантомный коготь`, `Ша-Ци`, `Искра сознания`, `Эрозия Ауры Демона`), automatically following the game's UI language across all 100 upgrade/skill entries, 48 weapons, and `PBZ Mods Menu` labels.
- Added **Native Dynamic Button Icons (`<InputAction/>`)** for all combo sequences (`X` / `Y` → `LightAttack` / `HeavyAttack`), automatically adapting in real time to Xbox controllers, PlayStation controllers, PC Keyboard+Mouse, and **custom keybindings**! Includes a live `Use Native Button Icons` toggle in `PBZ Mods Menu` (default ON; turn OFF to revert to plain `X`/`Y` text).

## v1.3.1
- Fixed a bullet-name parser bug where `"B"` in `WEAPON_NAME_TOKENS` accidentally stripped the standalone Heavy 1 (`Y`) move (`重1 (Y)` / `Heavy 1 (Y)` / `강공격 1 (Y)`) as well as the `B_` prefix on Sprint Heavy / Draw Heavy / Dodge Heavy moves across weapons.

## v1.3.0
- Added full authentic **Korean (`ko`)** localization automatically following the game's active UI language (`GetCurrentCulture()`), aligned strictly with official *Phantom Blade Zero* Korean terminology extracted from `ko/Game.locres` (covering all 100 upgrade/passive/skill patches, all 48 weapons & Shadow Weapons move tables, and `PBZ Mods Menu` labels).

## v1.2.0
- Added all remaining engine-verified `UpLevelData.GEUIDataArray` (SetByCaller) upgrade values across main weapons and Shadow Weapons (bringing total exact upgrade/passive/skill patches to **100 entries**, including Iron Blade Bleed buildup, Shachi Hook status bonus, Snake Dual combo ramp, Brutal Axe charge DR, HuoLiuXing ATK reduction, MiaoShouFeiDao sweet-spot bonus, Lute sound blade bonus, summon durations, etc.).
- Achieved **0 leaked English code tokens** across all 48 weapons & Shadow Weapons in Simplified/Traditional Chinese move tables.

## v1.1.1
- Fixed `loadSettings()` boolean parsing to accept `PBZModsMenu`'s `On` / `Off` format (in addition to `true` / `1`), fixing settings resetting to `false` on subsequent launches.

## v1.1.0
- Added full automatic **i18n** (`zh-Hans` / `zh-Hant` / `en`) following the game's active UI language via `GetCurrentCulture()`.
- Merged dual-wield left/right hand hits (`_L01`/`_R01`) into unified move entries, filtered deprecated `OldTimeline`/`Test` assets, and unified all move names into clean localized terminology.
- Added deep `GEComponents` (`PreTakeModificationGameplayEffectComponent` & `WeaponBuffGameplayEffectComponent`) exact values for main weapons and Shadow Weapons.
- Updated Lv10/20/30 numeric milestones to show expected next-tier and max-tier values even when locked (`<Lv10`).

## v1.0.0
- Initial release: hooks `UIHelper.GetTextByID` and `WeaponDetailList.refreshBasic` using 100% native PBZ RichText tags and UMG widgets.
- Added Style-C parenthetical upgrade values, skill multipliers, and bottom native combo/variant/status multiplier tables for all 48 weapons & Shadow Weapons.
- Integrated live toggles in `PBZ Mods Menu`.
