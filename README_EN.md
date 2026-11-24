<div align="center">

# Phantom Blade Zero — Personal Nexus Mods (`kfv53-PBZ-Nexus-Mods`)

[简体中文](README.md) | **English**

</div>

Welcome to my personal **Phantom Blade Zero (PBZ)** open-source Nexus Mods repository.
This repository hosts and tracks all of my personal mods published on **Nexus Mods**. Every mod folder shares the **exact same name as its Nexus Mods release**, and all mods are pure native Puerts JavaScript extensions powered by **PBZ Mods Menu** (zero `.pak` conflicts, no vanilla files overwritten).

---

## Mod List

| Mod Name (Matches Nexus Mods) | Current Version | Description | Changelog |
| :--- | :---: | :--- | :---: |
| [**PBZDetailedWeaponDesc**](./PBZDetailedWeaponDesc) | `v1.3.0` | **Detailed Weapon & Shadow Weapon Descriptions (Standard)**: Expands all 48 weapons & Shadow Weapons with engine-verified move multipliers, combo variants, status buildup, and 100 exact upgrade/passive values (including locked preview tiers) using 100% native UI styles & auto EN/ZH/KO i18n. Zero stutter. | [CHANGELOG](./PBZDetailedWeaponDesc/CHANGELOG.md) |
| [**PBZDetailedWeaponDesc_Dynamic**](./PBZDetailedWeaponDesc_Dynamic) | `v1.3.0-Dynamic` | **Detailed Weapon & Shadow Weapon Descriptions (Dynamic Mod-Compat Optional)**: Nexus Mods Optional File replacing the main file. Lazily reads live `BulletData` & upgrade values for third-party weapon/rebalance mods, defers appending bottom move tables so custom weapon mod descriptions are never overwritten, and supports auto EN/ZH/KO i18n. | [CHANGELOG](./PBZDetailedWeaponDesc_Dynamic/CHANGELOG.md) |
| [**PBZEnemyStatusBars**](./PBZEnemyStatusBars) | `v1.3.4` | **Enemy & Boss Status Buildup & DoT Gauges**: Displays native 270° circular radial buildup gauges and active DoT countdown rings above enemy and Boss HP bars for all 7 status effects (Bleed, Poison, Ignite, Frost, Electrified, Water, Chaos) with full per-status toggles and sizing in Mods Menu. | [CHANGELOG](./PBZEnemyStatusBars/CHANGELOG.md) |
| [**PBZExtraAccessorySlots**](./PBZExtraAccessorySlots) | `v1.3.1` | **Extra Accessory Slots**: Appends 0–12 extra unlocked accessory slots after vanilla Slots 1–6 while keeping your natural vanilla unlock progression intact. Features 100% native 3-column grid layout & controller/keyboard navigation, real GAS GameplayEffect application, independent JSON persistence, and safe auto-unequip. | [CHANGELOG](./PBZExtraAccessorySlots/CHANGELOG.md) |

---

## Installation

1. Install the required framework **[PBZ Mods Menu]** from Nexus Mods first.
2. Open the desired mod folder in this repository and copy/merge its `ProjectPBZ` folder into your Phantom Blade Zero game root directory (e.g., `...\steamapps\common\PBZ\`).
3. Launch the game and configure options live inside **Mods Menu**.
   > **Note**: Choose **either** `PBZDetailedWeaponDesc` (Standard) **or** `PBZDetailedWeaponDesc_Dynamic` (Optional Mod-Compat) — do not install both simultaneously.

---

## Disclaimer & Personal Learning Notice

- All mods and scripts in this repository are created strictly for **personal learning and technical study** (exploring Unreal Engine 5, Puerts JS scripting, and Gameplay Ability System architecture). **Commercial use, resale, or paid redistribution is strictly prohibited.**
- All mods are single-player client-side extensions only. As with any third-party mod, backing up your save games before use is always recommended.
- *Phantom Blade Zero* and all associated names, assets, data, and trademarks belong to S-GAME.
