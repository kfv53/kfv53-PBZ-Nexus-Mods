# Changelog — PBZDetailedWeaponDesc_Dynamic (Optional Mod-Compatible Edition)

## v1.3.1-Dynamic
- Fixed a bullet-name parser bug in both `weapon_data.js` and `live_reader.js` where `"B"` in `WEAPON_NAME_TOKENS` accidentally stripped the standalone Heavy 1 (`Y`) move (`重1 (Y)` / `Heavy 1 (Y)` / `강공격 1 (Y)`) and the `B_` prefix on Sprint Heavy / Draw Heavy / Dodge Heavy moves.

## v1.3.0-Dynamic
- Added full authentic **Korean (`ko`)** localization automatically following the game's active UI language (`GetCurrentCulture()`), aligned strictly with official *Phantom Blade Zero* Korean terminology extracted from `ko/Game.locres` — covering both the static fallback (`weapon_data.js`), the live memory reader (`live_reader.js`), and `PBZ Mods Menu` labels.

## v1.2.1-Dynamic
- Deferred appending bottom combo/variant move tables by 350ms (with weapon-switch generation guard) so polling-based third-party weapon UI mods (such as `PBZCrimsonVow` / True GuiTouBlade) can inject their custom descriptions after the native last entry without being overwritten.

## v1.2.0-Dynamic
- Initial optional release forked from `PBZDetailedWeaponDesc v1.2.0`.
- Added lazy on-demand runtime reader (`live_reader.js`) that reads live `BulletData.DamageData` and `UpLevelData.GEUIDataArray` directly from game memory when viewing a weapon, caching results per session and falling back seamlessly to static `weapon_data.js`.
- Added `Dynamic Live Read (Mod Compat)` and `Refresh Live Cache` toggles in `PBZ Mods Menu`.
