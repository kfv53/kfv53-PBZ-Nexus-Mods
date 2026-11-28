"use strict";

/**
 * PBZFreeRevert — Conflict-Free Native Puerts JS Free Revert Mod for Phantom Blade Zero (1.03+)
 *
 * Replaces UE4SS Lua PBZNoReforgeCosts with zero native C++ hooks:
 * - Main Weapons & Shadow Weapons (影之武装): Free revert to Lv1 without consuming Reforge Talismans,
 *   no talisman warning popup on breakthrough/max-upgrade, native free-revert hold button label.
 * - Accessories & Medicines (饰品 & 药品): Adds native Revert key (T / Y / △) on the Upgrade screen
 *   with localized confirmation dialog, exact Dust & material refund, and safe worn-accessory re-equip.
 */

const UE = require("ue");
const puerts = require("puerts");
const TsHelper = require("Library/TsHelper").default;
const UIHelper = require("Library/UIHelper").default;

const MOD_ID = "PBZFreeRevert";
const VERSION = "1.0.0";
const SETTINGS_FILE = MOD_ID + ".txt";
const UPGRADE_WIDGET_BP = "/Game/PBZContent/UI/UINew/System/Upgrade/W_UpgradeActivatableWidget_V1.W_UpgradeActivatableWidget_V1_C";
const WEAPON_DESC_BP = "/Game/PBZContent/UI/UINew/HUD/W_UnifiedTextDescription_Weapon.W_UnifiedTextDescription_Weapon_C";
const REVERT_ACTION_ROW = "EnterUpgradeDowngrade";

const cfg = {
    enabled: true,
    freeWeaponRevert: true,
    freeShaChiRevert: true,
    accessoryRevert: true,
    medicineRevert: true,
    revertAllLevels: false,
};

const patchRecords = [];
let dialogOpen = false;
let initTimer = null;
let initialized = false;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const logBuffer = [];
let logPath = null;

function getLogPath() {
    if (logPath !== null) return logPath;
    try {
        const savedDir = String(UE.KismetSystemLibrary.GetProjectSavedDirectory() || "");
        if (savedDir) {
            logPath = savedDir.replace(/[\\/]+$/, "") + "/" + MOD_ID + ".log";
        }
    } catch (_) {}
    return logPath;
}

function log(msg) {
    const line = `[${new Date().toISOString()}] [${MOD_ID}] ${msg}`;
    logBuffer.push(line);
    if (logBuffer.length > 300) logBuffer.shift();
    try {
        const p = getLogPath();
        if (p) {
            UE.EasyCsv.SaveStringToFileWithFullPath(logBuffer.join("\r\n") + "\r\n", p);
        }
    } catch (_) {}
}

// ---------------------------------------------------------------------------
// Settings (PBZModsMenu saves On/Off; parse case-insensitively)
// ---------------------------------------------------------------------------

function parseBool(raw, fallback) {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    const s = String(raw || "").trim().toLowerCase();
    if (s === "on" || s === "true" || s === "1" || s === "yes") return true;
    if (s === "off" || s === "false" || s === "0" || s === "no") return false;
    return fallback;
}

function loadSettings() {
    try {
        const contentDir = String(UE.KismetSystemLibrary.GetProjectContentDirectory() || "");
        if (!contentDir) return;
        const absPath = contentDir.replace(/[\\/]+$/, "") + "/Paks/~mods/" + SETTINGS_FILE;
        if (!UE.BlueprintPathsLibrary.FileExists(absPath)) return;
        const out = puerts.$ref("");
        if (!UE.EasyCsv.LoadStringFromLocalFile(absPath, out)) return;
        const text = String(puerts.$unref(out) || "");
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#") || line.startsWith(";")) continue;
            const eq = line.indexOf("=");
            if (eq <= 0) continue;
            const key = line.slice(0, eq).trim();
            const val = line.slice(eq + 1).trim();
            if (Object.prototype.hasOwnProperty.call(cfg, key)) {
                cfg[key] = parseBool(val, cfg[key]);
            }
        }
    } catch (e) {
        log("loadSettings error: " + e);
    }
}

function registerMenu() {
    const label = (en, zhHans, zhHant) => ({
        en,
        "zh-Hans": zhHans,
        "zh-Hant": zhHant || zhHans,
    });
    const menu = globalThis.PBZModsMenu || (globalThis.PBZModsMenu = []);
    const idx = menu.findIndex((m) => m && m.id === MOD_ID);
    const entry = {
        id: MOD_ID,
        title: label("Free Revert (1.03+)", "免费回退重置 (1.03+)", "免費回退重置 (1.03+)"),
        description: label(
            "Free revert for weapons, Shadow Weapons, accessories & medicines (pure JS, zero UE4SS hook conflicts).",
            "主武器、影之武装免符回退，饰品与药品免费降级返还全部材料与残渣（纯 JS 实现，无 UE4SS 钩子冲突）。",
            "主武器、影之武裝免符回退，飾品與藥品免費降級返還全部材料與殘渣（純 JS 實作，無 UE4SS 鉤子衝突）。"
        ),
        version: VERSION,
        file: SETTINGS_FILE,
        settings: [
            {
                key: "enabled",
                type: "toggle",
                label: label("Enable Mod", "启用模组", "啟用模組"),
                default: true,
                help: label("Master switch for all free revert features.", "总开关，关闭后恢复游戏原版逻辑。"),
            },
            {
                key: "freeWeaponRevert",
                type: "toggle",
                label: label("Free Main Weapon Revert", "主武器免费回退", "主武器免費回退"),
                default: true,
                help: label("Revert main weapons without consuming Reforge Talismans or showing breakthrough warnings.", "主武器回退不消耗重铸符，突破升级也不再弹符箓警告。"),
            },
            {
                key: "freeShaChiRevert",
                type: "toggle",
                label: label("Free Shadow Weapon Revert", "影之武装免费回退", "影之武裝免費回退"),
                default: true,
                help: label("Revert Shadow Weapons without consuming Shadow Reforge Talismans or showing breakthrough warnings.", "影之武装回退不消耗重铸符，突破升级也不再弹符箓警告。"),
            },
            {
                key: "accessoryRevert",
                type: "toggle",
                label: label("Accessory Free Revert", "饰品免费回退", "飾品免費回退"),
                default: true,
                help: label("Press Revert (T / Y) on the Accessories tab to downgrade and refund 100% Dust & materials.", "在饰品强化页按回退键（T / Y）可降级并全额返还残渣与材料。"),
            },
            {
                key: "medicineRevert",
                type: "toggle",
                label: label("Medicine Free Revert", "药品免费回退", "藥品免費回退"),
                default: true,
                help: label("Press Revert (T / Y) on the Medicines tab to downgrade and refund 100% Dust & materials.", "在药品强化页按回退键（T / Y）可降级并全额返还残渣与材料。"),
            },
            {
                key: "revertAllLevels",
                type: "toggle",
                label: label("Revert All Levels at Once (Acc/Med)", "饰品/药品一键退回初始等级", "飾品/藥品一鍵退回初始等級"),
                default: false,
                help: label("Off: downgrade 1 level per revert. On: reset all the way to base level in one click.", "关：每次回退降 1 级；开：一键全部退回初始等级并返还全部消耗。"),
            },
        ],
        onChange: (key, value) => {
            if (Object.prototype.hasOwnProperty.call(cfg, key)) {
                cfg[key] = parseBool(value, cfg[key]);
                log(`Setting changed: ${key} = ${cfg[key]}`);
            }
        },
    };
    if (idx >= 0) menu[idx] = entry;
    else menu.push(entry);
}

// ---------------------------------------------------------------------------
// Localization & Formatting Helpers
// ---------------------------------------------------------------------------

function getLang() {
    try {
        const c = String(UE.KismetInternationalizationLibrary.GetCurrentCulture() || "").toLowerCase();
        if (c.startsWith("zh-hant") || c.startsWith("zh-tw") || c.startsWith("zh-hk")) return "zh-Hant";
        if (c.startsWith("zh")) return "zh-Hans";
    } catch (_) {}
    return "en";
}

function formatNumber(n) {
    return Math.floor(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function resolveLocText(flowLoc, fallback) {
    try {
        if (!flowLoc) return fallback;
        if (flowLoc.Key) {
            const key = String(flowLoc.Key);
            if (key) {
                const txt = UE.PBZBlueprintFunctionLibrary.MakeTextByKey(key);
                if (txt) {
                    const s = String(UE.KismetTextLibrary.Conv_TextToString(txt) || "");
                    if (s && s !== key) return s;
                }
            }
        }
        if (flowLoc.ValueCache) {
            const cached = String(flowLoc.ValueCache);
            if (cached) return cached;
        }
    } catch (_) {}
    return fallback;
}

function getItemDisplayName(kind, id) {
    try {
        if (kind === "accessory") {
            const d = UE.PBZBackPackSubsystem.GetAccessoryData(id);
            if (d) return resolveLocText(d.AccessoryName, String(id));
        } else if (kind === "medicine") {
            const d = UE.PBZBackPackSubsystem.GetMedicineData(id);
            if (d) return resolveLocText(d.Name, String(id));
        } else {
            const d = UE.PBZBackPackSubsystem.GetPropData(id);
            if (d) return resolveLocText(d.ItemName, String(id));
        }
    } catch (_) {}
    return String(id);
}

function formatLevel(kind, level, lang) {
    if (kind === "accessory") {
        if (level <= 0) {
            if (lang === "zh-Hans") return "初始(+0)";
            if (lang === "zh-Hant") return "初始(+0)";
            return "base (+0)";
        }
        return "+" + level;
    }
    if (lang === "zh-Hans" || lang === "zh-Hant") return `Lv.${level}`;
    return `Lv.${level}`;
}

// ---------------------------------------------------------------------------
// TMap / Cost Helpers
// ---------------------------------------------------------------------------

function readMaterialMap(mapObj, target) {
    if (!mapObj) return;
    try {
        if (typeof mapObj.GetMaxIndex === "function" && typeof mapObj.GetKey === "function") {
            const maxIdx = mapObj.GetMaxIndex();
            for (let i = 0; i < maxIdx; i++) {
                if (typeof mapObj.IsValidIndex === "function" && !mapObj.IsValidIndex(i)) continue;
                const k = mapObj.GetKey(i);
                const v = Number(mapObj.Get(k)) || 0;
                if (k && v > 0) {
                    const ks = String(k);
                    target[ks] = (target[ks] || 0) + v;
                }
            }
            return;
        }
        for (const [k, v] of mapObj) {
            const n = Number(v) || 0;
            if (k && n > 0) {
                const ks = String(k);
                target[ks] = (target[ks] || 0) + n;
            }
        }
    } catch (e) {
        log("readMaterialMap error: " + e);
    }
}

function calcAccessoryMedicineRefund(kind, id, fromLevel, toLevel) {
    let totalDust = 0;
    const totalItems = {};
    try {
        if (kind === "accessory") {
            // Accessory level data is 1-based (0->1 uses level=1, 1->2 uses level=2)
            for (let lv = toLevel + 1; lv <= fromLevel; lv++) {
                const d = UE.PBZBackPackSubsystem.GetAccessoryLevelData(id, lv);
                if (!d || typeof d.NeedDust !== "number") return null;
                totalDust += d.NeedDust;
                readMaterialMap(d.NeedItems, totalItems);
            }
            return { dust: totalDust, items: totalItems };
        } else {
            // MedicineLevelData is a 0-based TArray (0->1 uses index 0, 1->2 uses index 1)
            const md = UE.PBZBackPackSubsystem.GetMedicineData(id);
            const arr = md && md.MedicineLevelData;
            if (!arr) return null;
            for (let lv = toLevel + 1; lv <= fromLevel; lv++) {
                const idx = lv - 1;
                if (typeof arr.IsValidIndex === "function" && !arr.IsValidIndex(idx)) return null;
                const d = arr.Get(idx);
                if (!d || typeof d.ConsumeDust !== "number") return null;
                totalDust += d.ConsumeDust;
                readMaterialMap(d.ConsumeMaterials, totalItems);
            }
            return { dust: totalDust, items: totalItems };
        }
    } catch (e) {
        log(`calcAccessoryMedicineRefund(${kind}, ${id}, ${fromLevel}->${toLevel}) error: ${e}`);
        return null;
    }
}

function findEquippedAccessorySlot(backpack, accessoryId) {
    try {
        const arr = backpack.AssemblyAccessory;
        if (!arr || typeof arr.Num !== "function") return -1;
        const count = arr.Num();
        const want = String(accessoryId);
        for (let i = 0; i < count; i++) {
            if (String(arr.Get(i)) === want) return i;
        }
    } catch (_) {}
    return -1;
}

// ---------------------------------------------------------------------------
// Accessory / Medicine Revert Execution
// ---------------------------------------------------------------------------

function refreshAfterAccMedRevert(widget, kind, itemId, newLevel, backpack) {
    try {
        if (widget.UIGameplayLogicComponent) {
            widget.UIGameplayLogicComponent.ReCheckItemUpgradeState(backpack);
        }
        if (typeof widget.refreshTabRedDots === "function") {
            widget.refreshTabRedDots();
        }
        const group = widget.W_SystemPanel && widget.W_SystemPanel.ButtonGroup;
        const btn = group ? group.GetSelectedButtonBase() : null;
        if (btn) {
            try {
                if (kind === "accessory") {
                    if (typeof btn.InitAccessory === "function") {
                        btn.InitAccessory(itemId, newLevel, true, true, widget.UIGameplayLogicComponent, false);
                    } else {
                        btn.AccessoryLevel = newLevel;
                    }
                    widget.OnSelectedAccessoryButton(btn, true);
                } else {
                    if (typeof btn.InitMedicine === "function") {
                        btn.InitMedicine(itemId, newLevel, true, true, widget.UIGameplayLogicComponent);
                    } else {
                        btn.MedicineLevel = newLevel;
                    }
                    widget.OnSelectedMedicineButton(btn, true);
                }
            } catch (e) {
                log("refresh slot/panel error: " + e);
            }
        }
    } catch (e) {
        log("refreshAfterAccMedRevert error: " + e);
    }
}

function applyAccessoryOrMedicineRevert(widget, kind, itemId, fromLevel, toLevel, refund) {
    const backpack = TsHelper.getWorldSubsystem(widget, UE.PBZBackPackSubsystem.StaticClass());
    if (!backpack) {
        log("applyRevert aborted: no PBZBackPackSubsystem");
        return;
    }
    const map = kind === "accessory" ? backpack.Accessories : backpack.MedicineInfos;
    const info = map ? map.Get(itemId) : null;
    if (!info || info.CurrentLevel !== fromLevel) {
        log(`applyRevert aborted: ${itemId} level changed (${info ? info.CurrentLevel : "null"} !== ${fromLevel})`);
        return;
    }

    let wornSlot = -1;
    if (kind === "accessory") {
        wornSlot = findEquippedAccessorySlot(backpack, itemId);
        if (wornSlot >= 0) {
            try {
                backpack.TakeOffAccessory(wornSlot);
            } catch (e) {
                log("TakeOffAccessory error: " + e);
            }
        }
    }

    info.CurrentLevel = toLevel;

    if (kind === "accessory" && wornSlot >= 0) {
        try {
            backpack.AssembleAccessory(itemId, wornSlot);
        } catch (e) {
            log("AssembleAccessory error: " + e);
        }
    }

    for (const matId of Object.keys(refund.items)) {
        const count = refund.items[matId];
        if (count > 0) {
            backpack.AddPropsToBackPack(count, matId, false);
            try {
                if (backpack.UpdateProps && typeof backpack.UpdateProps.Broadcast === "function") {
                    backpack.UpdateProps.Broadcast(matId, true, count);
                }
            } catch (_) {}
        }
    }

    if (refund.dust > 0) {
        TsHelper.changeDust(widget, refund.dust, true);
    }

    log(`Reverted ${kind} ${itemId} from ${fromLevel} -> ${toLevel}, refunded dust=${refund.dust}, items=${JSON.stringify(refund.items)}, wornSlot=${wornSlot}`);
    refreshAfterAccMedRevert(widget, kind, itemId, toLevel, backpack);
}

function triggerAccessoryOrMedicineRevert(widget, kind) {
    if (!cfg.enabled) return;
    if (kind === "accessory" && !cfg.accessoryRevert) return;
    if (kind === "medicine" && !cfg.medicineRevert) return;
    if (dialogOpen) return;

    const tab = String(widget.FirstTab ? widget.FirstTab.GetActiveTab() : "").toLowerCase();
    if (tab !== kind) return;

    const group = widget.W_SystemPanel && widget.W_SystemPanel.ButtonGroup;
    const btn = group ? group.GetSelectedButtonBase() : null;
    if (!btn) return;
    const itemId = widget.getItemFromButton(btn);
    if (!itemId) return;

    const backpack = TsHelper.getWorldSubsystem(widget, UE.PBZBackPackSubsystem.StaticClass());
    if (!backpack) return;
    const map = kind === "accessory" ? backpack.Accessories : backpack.MedicineInfos;
    const info = map ? map.Get(itemId) : null;
    if (!info) return;

    const fromLevel = Number(info.CurrentLevel) || 0;
    if (fromLevel <= 0) return;

    const toLevel = cfg.revertAllLevels ? 0 : fromLevel - 1;
    const refund = calcAccessoryMedicineRefund(kind, itemId, fromLevel, toLevel);
    if (!refund) {
        log(`Could not compute refund for ${kind} ${itemId} (${fromLevel}->${toLevel})`);
        return;
    }

    const lang = getLang();
    const displayName = getItemDisplayName(kind, itemId);
    const fromStr = formatLevel(kind, fromLevel, lang);
    const toStr = formatLevel(kind, toLevel, lang);

    const titleStr = lang === "zh-Hans"
        ? "免费回退重置"
        : (lang === "zh-Hant" ? "免費回退重置" : "Free Revert");

    const lines = [];
    if (lang === "zh-Hans") {
        lines.push(`确定将「${displayName}」从 ${fromStr} 回退至 ${toStr}？`);
        lines.push("");
        lines.push("将全额返还：");
        if (refund.dust > 0) lines.push(`• ${formatNumber(refund.dust)} 残渣`);
        for (const matId of Object.keys(refund.items)) {
            lines.push(`• ${refund.items[matId]} × ${getItemDisplayName("item", matId)}`);
        }
    } else if (lang === "zh-Hant") {
        lines.push(`確定將「${displayName}」從 ${fromStr} 回退至 ${toStr}？`);
        lines.push("");
        lines.push("將全額返還：");
        if (refund.dust > 0) lines.push(`• ${formatNumber(refund.dust)} 殘渣`);
        for (const matId of Object.keys(refund.items)) {
            lines.push(`• ${refund.items[matId]} × ${getItemDisplayName("item", matId)}`);
        }
    } else {
        lines.push(`Revert ${displayName} from ${fromStr} to ${toStr}?`);
        lines.push("");
        lines.push("You will receive:");
        if (refund.dust > 0) lines.push(`• ${formatNumber(refund.dust)} Remnant Dust`);
        for (const matId of Object.keys(refund.items)) {
            lines.push(`• ${refund.items[matId]} x ${getItemDisplayName("item", matId)}`);
        }
    }

    try {
        const titleText = UE.KismetTextLibrary.Conv_StringToText(titleStr);
        const bodyText = UE.KismetTextLibrary.Conv_StringToText(lines.join("\n"));
        const async = UE.AsyncAction_ShowConfirmation.ShowConfirmationYesNo(widget, titleText, bodyText);
        if (!async) {
            log("ShowConfirmationYesNo returned null");
            return;
        }
        dialogOpen = true;
        async.OnResult.Add((result) => {
            dialogOpen = false;
            if (result === UE.ECommonMessagingResult.Confirmed) {
                applyAccessoryOrMedicineRevert(widget, kind, itemId, fromLevel, toLevel, refund);
            }
        });
        async.Activate();
    } catch (e) {
        dialogOpen = false;
        log("ShowConfirmationYesNo error: " + e);
    }
}

function syncAccMedRevertKey(widget, kind, currentLevel) {
    const enabledForKind = cfg.enabled && (kind === "accessory" ? cfg.accessoryRevert : cfg.medicineRevert);
    const shouldBind = enabledForKind && currentLevel > 0;
    try {
        widget.RemoveKey(REVERT_ACTION_ROW);
        widget.bIsDowngradeKeyBound = false;
        if (shouldBind) {
            widget.BindKey(
                UIHelper.MakePBZInputDataTableHandle(REVERT_ACTION_ROW),
                true,
                puerts.toDelegate(widget, () => {
                    triggerAccessoryOrMedicineRevert(widget, kind);
                }),
                UE.EInputEvent.IE_Pressed
            );
            widget.bIsDowngradeKeyBound = true;
        }
    } catch (e) {
        log(`syncAccMedRevertKey(${kind}) error: ${e}`);
    }
}

// ---------------------------------------------------------------------------
// Prototype Patching
// ---------------------------------------------------------------------------

function patchMethod(proto, methodName, wrapperFactory) {
    if (!proto || typeof proto[methodName] !== "function") return false;
    const orig = proto[methodName];
    if (orig.__pbzFreeRevertPatched) return true;
    const wrapped = wrapperFactory(orig);
    wrapped.__pbzFreeRevertPatched = true;
    proto[methodName] = wrapped;
    patchRecords.push({ proto, methodName, orig });
    return true;
}

function getTargetPrototypes(modulePath, exportName, bpPath) {
    const protos = [];
    try {
        const mod = require(modulePath);
        if (mod && mod[exportName] && mod[exportName].prototype) {
            protos.push(mod[exportName].prototype);
        }
    } catch (e) {
        log(`require(${modulePath}) error: ${e}`);
    }
    try {
        const cls = UE.Class.Load(bpPath);
        if (cls) {
            const jsCls = puerts.blueprint.tojs(cls);
            if (jsCls && jsCls.prototype && protos.indexOf(jsCls.prototype) < 0) {
                protos.push(jsCls.prototype);
            }
        }
    } catch (e) {
        log(`Class.Load(${bpPath}) error: ${e}`);
    }
    return protos;
}

function isWeaponFree(isMain) {
    if (!cfg.enabled) return false;
    return isMain ? cfg.freeWeaponRevert : cfg.freeShaChiRevert;
}

function installHooks() {
    let count = 0;

    // 1. UpgradeSystemWidget_V1
    const upgradeProtos = getTargetPrototypes(
        "UI/Widget/UpgradeSystemWidget_V1",
        "UpgradeSystemWidgetMixin_V1_Interface",
        UPGRADE_WIDGET_BP
    );
    for (const proto of upgradeProtos) {
        if (patchMethod(proto, "canCurrentItemDowngrade", (orig) => function () {
            try {
                if (cfg.enabled) {
                    const tab = String(this.FirstTab ? this.FirstTab.GetActiveTab() : "").toLowerCase();
                    const isMain = tab === "weapon";
                    if ((isMain && cfg.freeWeaponRevert) || (tab === "shachiweapon" && cfg.freeShaChiRevert)) {
                        if (!this.W_SystemPanel || !this.W_SystemPanel.ButtonGroup) return false;
                        const btn = this.W_SystemPanel.ButtonGroup.GetSelectedButtonBase();
                        if (!btn) return false;
                        const item = this.getItemFromButton(btn);
                        if (!item) return false;
                        const bp = TsHelper.getWorldSubsystem(this, UE.PBZBackPackSubsystem.StaticClass());
                        if (!bp) return false;
                        return bp.GetWeaponLevel(item, isMain) > 1;
                    }
                }
            } catch (e) {
                log("canCurrentItemDowngrade error: " + e);
            }
            return orig.apply(this, arguments);
        })) count++;

        if (patchMethod(proto, "isBreakthroughUpgrade", (orig) => function (item, isMain, backpackSubsystem) {
            if (isWeaponFree(!!isMain)) return false;
            return orig.apply(this, arguments);
        })) count++;

        if (patchMethod(proto, "showBreakthroughConfirm", (orig) => function (item, isMain) {
            if (isWeaponFree(!!isMain)) return false;
            return orig.apply(this, arguments);
        })) count++;

        if (patchMethod(proto, "executeDowngrade", (orig) => function (weaponId, isMain, backpackSubsystem) {
            try {
                if (isWeaponFree(!!isMain)) {
                    if (typeof this.isTutorialFreeStep === "function" && this.isTutorialFreeStep()) {
                        return orig.apply(this, arguments);
                    }
                    const curLevel = backpackSubsystem.GetWeaponLevel(weaponId, isMain);
                    if (curLevel <= 1) return false;

                    const matRef = puerts.$ref();
                    const dustRef = puerts.$ref();
                    backpackSubsystem.ResetWeaponToLevel(weaponId, isMain, 1, matRef, dustRef);
                    const mats = puerts.$unref(matRef);
                    const dust = puerts.$unref(dustRef);
                    if (mats) {
                        for (const [matID, num] of mats) {
                            backpackSubsystem.AddPropsToBackPack(num, matID, false);
                            try {
                                backpackSubsystem.UpdateProps.Broadcast(matID, true, num);
                            } catch (_) {}
                        }
                    }
                    if (dust > 0) {
                        TsHelper.changeDust(this, dust, true);
                    }
                    this.UIGameplayLogicComponent.ReCheckItemUpgradeState(backpackSubsystem);
                    this.refreshTabRedDots();
                    log(`Free weapon revert: ${weaponId} (isMain=${isMain}) Lv.${curLevel} -> Lv.1, dust=${dust}`);
                    return true;
                }
            } catch (e) {
                log("executeDowngrade error (falling back to stock): " + e);
            }
            return orig.apply(this, arguments);
        })) count++;

        if (patchMethod(proto, "OnSelectedAccessoryButton", (orig) => function (Button, bIsSelected) {
            const res = orig.apply(this, arguments);
            try {
                const item = this.getItemFromButton(Button);
                const bp = TsHelper.getWorldSubsystem(this, UE.PBZBackPackSubsystem.StaticClass());
                const info = bp && bp.Accessories ? bp.Accessories.Get(item) : null;
                syncAccMedRevertKey(this, "accessory", info ? (Number(info.CurrentLevel) || 0) : 0);
            } catch (e) {
                log("OnSelectedAccessoryButton hook error: " + e);
            }
            return res;
        })) count++;

        if (patchMethod(proto, "OnSelectedMedicineButton", (orig) => function (Button, bIsSelected) {
            const res = orig.apply(this, arguments);
            try {
                const item = this.getItemFromButton(Button);
                const bp = TsHelper.getWorldSubsystem(this, UE.PBZBackPackSubsystem.StaticClass());
                const info = bp && bp.MedicineInfos ? bp.MedicineInfos.Get(item) : null;
                syncAccMedRevertKey(this, "medicine", info ? (Number(info.CurrentLevel) || 0) : 0);
            } catch (e) {
                log("OnSelectedMedicineButton hook error: " + e);
            }
            return res;
        })) count++;
    }

    // 2. UnifiedTextDesc_Weapon (make native UI display free-revert button with fuCost = 0)
    const descProtos = getTargetPrototypes(
        "UI/Widget/Foundation/UnifiedTextDesc_Weapon",
        "pbzUnifiedTextDescWeaponInterface",
        WEAPON_DESC_BP
    );
    for (const proto of descProtos) {
        if (patchMethod(proto, "initMainWeapon_Downgrade", (orig) => function () {
            const args = Array.prototype.slice.call(arguments);
            if (cfg.enabled && cfg.freeWeaponRevert && args.length > 5) {
                args[5] = 0; // fuCost = 0
            }
            return orig.apply(this, args);
        })) count++;

        if (patchMethod(proto, "initShaChiWeapon_Downgrade", (orig) => function () {
            const args = Array.prototype.slice.call(arguments);
            if (cfg.enabled && cfg.freeShaChiRevert && args.length > 5) {
                args[5] = 0; // fuCost = 0
            }
            return orig.apply(this, args);
        })) count++;

        if (patchMethod(proto, "configureDowngradeHoldButton", (orig) => function () {
            const args = Array.prototype.slice.call(arguments);
            if (cfg.enabled && args.length > 3) {
                const tipKey = String(args[3] || "");
                const isMain = tipKey === "UI_Upgrade_39";
                const isShaChi = tipKey === "UI_Upgrade_40";
                if ((isMain && cfg.freeWeaponRevert) || (isShaChi && cfg.freeShaChiRevert)) {
                    args[1] = 0; // fuCost = 0 -> triggers native UI_Upgrade_48 free-revert label
                }
            }
            return orig.apply(this, args);
        })) count++;
    }

    log(`Installed ${count} prototype hook(s) across ${upgradeProtos.length} UpgradeSystemWidget_V1 and ${descProtos.length} UnifiedTextDesc_Weapon prototype(s).`);
    return count > 0;
}

function unpatchAll() {
    while (patchRecords.length > 0) {
        const rec = patchRecords.pop();
        try {
            rec.proto[rec.methodName] = rec.orig;
        } catch (_) {}
    }
}

function stop() {
    if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
    }
    unpatchAll();
    dialogOpen = false;
    initialized = false;
    exports.ready = false;
    log("Stopped and unpatched cleanly.");
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

exports.stop = stop;
exports.ready = false;

loadSettings();
registerMenu();
log(`=== ${MOD_ID} ${VERSION} starting (enabled=${cfg.enabled}, weapon=${cfg.freeWeaponRevert}, shachi=${cfg.freeShaChiRevert}, acc=${cfg.accessoryRevert}, med=${cfg.medicineRevert}, allLevels=${cfg.revertAllLevels}) ===`);

if (installHooks()) {
    initialized = true;
    exports.ready = true;
} else {
    // Fallback retry once after startup mixins finish
    initTimer = setTimeout(() => {
        initTimer = null;
        if (!initialized) {
            installHooks();
            initialized = true;
            exports.ready = true;
        }
    }, 2000);
    exports.ready = true;
}
