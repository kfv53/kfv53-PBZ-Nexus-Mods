# Changelog — PBZDetailedWeaponDesc_Dynamic (Optional Mod-Compatible Edition)

## v1.2.1-Dynamic
- Deferred appending bottom combo/variant move tables by 350ms (with weapon-switch generation guard) so polling-based third-party weapon UI mods (such as `PBZCrimsonVow` / True GuiTouBlade) can inject their custom descriptions after the native last entry without being overwritten.

## v1.2.0-Dynamic
- Initial optional release forked from `PBZDetailedWeaponDesc v1.2.0`.
- Added lazy on-demand runtime reader (`live_reader.js`) that reads live `BulletData.DamageData` and `UpLevelData.GEUIDataArray` directly from game memory when viewing a weapon, caching results per session and falling back seamlessly to static `weapon_data.js`.
- Added `Dynamic Live Read (Mod Compat)` and `Refresh Live Cache` toggles in `PBZ Mods Menu`.
