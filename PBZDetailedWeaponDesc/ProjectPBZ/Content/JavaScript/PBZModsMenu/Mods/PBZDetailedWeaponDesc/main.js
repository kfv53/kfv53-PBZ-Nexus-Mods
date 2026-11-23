"use strict";

// PBZDetailedWeaponDesc v1.1.0
// Enhances Phantom Blade Zero weapon & shadow weapon (影之武装) descriptions with exact engine-verified
// multipliers, upgrade percentages (including locked preview tiers), erosion/burst mechanics, and
// clean localized combo/variant move tables.
// - Full i18n: automatically follows the game's active language (zh-Hans / zh-Hant / en)
// - 100% native RichText styles (<WeaponDes_Num_Green>, <WeaponDes_Main_Green>, <Character_Yellow_Decorator2>)
// - 100% native UMG widgets (W_WeaponNormalText / W_WeaponAdvancdText / W_WeaponAdvancdNumricValueText)

const UE = require("ue");
const puerts = require("puerts");
const cpp = require("cpp");

const DATA = require("./weapon_data");
const LOC_PATCHES = DATA.LOC_PATCHES || {};
const EXTRA_MOVES_BY_WEAPON = DATA.EXTRA_MOVES_BY_WEAPON || {};

const MOD_ID = "PBZDetailedWeaponDesc";
const VERSION = "1.2.0";
const SETTINGS_FILE = "PBZDetailedWeaponDesc.txt";
const LOG_FILE = "PBZDetailedWeaponDesc.log";

const defaults = {
    enabled: true,
    showUpgradeValues: true,
    showSkillMultipliers: true,
    showExtraMoveEntries: true,
};

const config = { ...defaults };

const logLines = [];
let origGetTextByID = null;
let hookedPrototypes = [];
let patchRetryTimer = null;

function getSavedDir() {
    try { return String(UE.KismetSystemLibrary.GetProjectSavedDirectory()); }
    catch (e) { return "C:/Users/baige/AppData/Local/ProjectPBZ/Saved/"; }
}

function getSettingsPath() {
    try { return String(UE.KismetSystemLibrary.GetProjectContentDirectory()) + "Paks/~mods/" + SETTINGS_FILE; }
    catch (e) { return ""; }
}

function log(msg) {
    const line = `[${new Date().toISOString()}] [${MOD_ID}] ${msg}`;
    logLines.push(line);
    if (logLines.length > 500) logLines.splice(0, 100);
    console.warn(line);
    try { UE.EasyCsv.SaveStringToFileWithFullPath(logLines.join("\n") + "\n", getSavedDir() + LOG_FILE); }
    catch (e) {}
}

// Automatically detect the game's current UI language (zh-Hans / zh-Hant / en)
function getCurrentLang() {
    try {
        let culture = "";
        if (UE.KismetInternationalizationLibrary && typeof UE.KismetInternationalizationLibrary.GetCurrentCulture === "function") {
            culture = String(UE.KismetInternationalizationLibrary.GetCurrentCulture() || "");
        } else if (UE.KismetInternationalizationLibrary && typeof UE.KismetInternationalizationLibrary.GetCurrentLanguage === "function") {
            culture = String(UE.KismetInternationalizationLibrary.GetCurrentLanguage() || "");
        }
        const c = culture.toLowerCase();
        if (c.includes("zh-hant") || c.includes("zh-tw") || c.includes("zh-hk") || c.includes("zh_tw")) {
            return "zh-Hant";
        }
        if (c.startsWith("zh")) {
            return "zh-Hans";
        }
        if (c.length > 0) {
            return "en";
        }
    } catch (e) {}
    return "zh-Hans";
}

function pickLocalized(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    const lang = getCurrentLang();
    return obj[lang] || obj["zh-Hans"] || obj["en"] || "";
}

function loadSettings() {
    try {
        const p = getSettingsPath();
        if (!p || !UE.BlueprintPathsLibrary.FileExists(p)) return;
        const out = puerts.$ref("");
        if (!UE.EasyCsv.LoadStringFromLocalFile(p, out)) return;
        const txt = String(puerts.$unref(out));
        for (const rawLine of txt.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#") || line.startsWith(";")) continue;
            const eq = line.indexOf("=");
            if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            const v = line.slice(eq + 1).trim();
            if (k in defaults) {
                const lv = v.toLowerCase();
                config[k] = lv === "on" || lv === "true" || lv === "1" || lv === "yes";
            }
        }
        log(`Loaded settings: ${JSON.stringify(config)}`);
    } catch (e) {
        log(`loadSettings error: ${e}`);
    }
}

// --- Hook 1: UIHelper.GetTextByID ---
function installGetTextHook() {
    try {
        const UIHelper = require("Library/UIHelper").default;
        if (!UIHelper || typeof UIHelper.GetTextByID !== "function") {
            log("UIHelper.GetTextByID not found");
            return false;
        }
        if (origGetTextByID) return true;
        origGetTextByID = UIHelper.GetTextByID;
        UIHelper.GetTextByID = function (str, dtvDefaultStyle) {
            const origText = origGetTextByID.call(this, str, dtvDefaultStyle);
            if (!config.enabled || !str) return origText;
            const patch = LOC_PATCHES[String(str)];
            if (!patch || !patch.append) return origText;
            if (patch.kind === "upgrade" && !config.showUpgradeValues) return origText;
            if (patch.kind === "skill" && !config.showSkillMultipliers) return origText;
            try {
                const appendStr = pickLocalized(patch.append);
                if (!appendStr) return origText;
                const raw = String(UE.KismetTextLibrary.Conv_TextToString(origText));
                if (!raw || raw.includes(appendStr)) return origText;
                return cpp.FText.FromString(raw + appendStr);
            } catch (e) {
                return origText;
            }
        };
        log(`Hooked UIHelper.GetTextByID (${Object.keys(LOC_PATCHES).length} i18n loc patches active, lang=${getCurrentLang()})`);
        return true;
    } catch (e) {
        log(`installGetTextHook error: ${e}`);
        return false;
    }
}

// --- Hook 2: WeaponDetailList.refreshBasic ---
function appendExtraMoveEntries(widget, weaponID, isMain, backpackSubsystem) {
    if (!config.enabled || !config.showExtraMoveEntries) return;
    if (!widget || !widget.DynamicEntryBox || !widget.NormalTextClass) return;
    if (!weaponID || weaponID === "None" || !backpackSubsystem) return;

    let equipKey = "";
    try {
        if (isMain) {
            const d = backpackSubsystem.GetMainWeaponTableData(weaponID);
            if (d && d.EquipDescription) equipKey = String(d.EquipDescription.Key || "");
            if (d) void d.WeaponUpLevelDatas;
        } else {
            const d = backpackSubsystem.GetShaqiWeaponTableData(weaponID);
            if (d && d.EquipDescription) equipKey = String(d.EquipDescription.Key || "");
            if (d) void d.ShaChiWeaponUpLevelData;
        }
    } catch (e) {
        return;
    }

    if (!equipKey || equipKey === "None") return;
    const weaponPack = EXTRA_MOVES_BY_WEAPON[equipKey];
    if (!weaponPack || !Array.isArray(weaponPack.entries) || weaponPack.entries.length === 0) return;

    for (const item of weaponPack.entries) {
        try {
            const entry = widget.DynamicEntryBox.BP_CreateEntryOfClass(widget.NormalTextClass);
            if (!entry) continue;
            const titleStr = pickLocalized(item.title);
            const descStr = pickLocalized(item.desc);
            const titleText = cpp.FText.FromString(titleStr);
            const descText = cpp.FText.FromString(descStr);
            entry.InitText(titleText, descText);
            if (entry.TitleText) {
                entry.TitleText.SetVisibility(
                    titleStr ? UE.ESlateVisibility.SelfHitTestInvisible : UE.ESlateVisibility.Collapsed
                );
            }
        } catch (e) {
            log(`Error creating extra entry for ${equipKey}: ${e}`);
        }
    }
}

function wrapRefreshBasicOnProto(proto, tagName) {
    if (!proto || typeof proto.refreshBasic !== "function") return false;
    if (proto.refreshBasic.__pbzDetailedWrapped) return true;
    const orig = proto.refreshBasic;
    const wrapped = function (weaponID, isMain, splitTitleFromDesc, backpackSubsystem) {
        const res = orig.call(this, weaponID, isMain, splitTitleFromDesc, backpackSubsystem);
        try {
            if (!this.__pbzExtraAppending) {
                this.__pbzExtraAppending = true;
                try {
                    appendExtraMoveEntries(this, weaponID, isMain, backpackSubsystem);
                } finally {
                    this.__pbzExtraAppending = false;
                }
            }
        } catch (e) {
            log(`refreshBasic hook error (${tagName}): ${e}`);
        }
        return res;
    };
    wrapped.__pbzDetailedWrapped = true;
    proto.refreshBasic = wrapped;
    hookedPrototypes.push({ proto, orig, tagName });
    log(`Hooked refreshBasic on ${tagName}`);
    return true;
}

function installRefreshBasicHooks() {
    let any = false;
    try {
        const mod = require("UI/Widget/Foundation/WeaponDetailList");
        if (mod && mod.WeaponDetailListInterface && mod.WeaponDetailListInterface.prototype) {
            if (wrapRefreshBasicOnProto(mod.WeaponDetailListInterface.prototype, "WeaponDetailListInterface.prototype")) {
                any = true;
            }
        }
    } catch (e) {}

    try {
        const ucls = UE.Class.Load("/Game/PBZContent/UI/UINew/HUD/W_WeaponDetailList.W_WeaponDetailList_C");
        if (ucls) {
            const jsCls = puerts.blueprint.tojs(ucls);
            if (jsCls && jsCls.prototype && typeof jsCls.prototype.refreshBasic === "function") {
                if (wrapRefreshBasicOnProto(jsCls.prototype, "W_WeaponDetailList_C.prototype")) {
                    any = true;
                }
            }
        }
    } catch (e) {}

    return any;
}

function registerMenu() {
    const label = (en, zh, zht) => ({ en, "zh-Hans": zh, "zh-Hant": zht || zh });
    const menu = globalThis.PBZModsMenu || (globalThis.PBZModsMenu = []);
    menu.push({
        id: MOD_ID,
        title: label("Detailed Weapon Descriptions", "武器与影之武装详细倍率说明", "武器與影之武裝詳細倍率說明"),
        description: label(
            "Shows exact move multipliers, combo variants, status buildup, and upgrade percentages using native UI styles.",
            "以原生字体/配色展示武器与影之武装的精确招式倍率、派生变招、异常倍率与升级百分比。",
            "以原生字體/配色展示武器與影之武裝的精確招式倍率、派生變招、異常倍率與升級百分比。"
        ),
        version: VERSION,
        file: SETTINGS_FILE,
        settings: [
            {
                key: "enabled",
                type: "toggle",
                label: label("Enable Detailed Descriptions", "启用详细数值说明", "啟用詳細數值說明"),
                default: true,
                help: "Master toggle for all enhanced weapon & shadow weapon descriptions",
            },
            {
                key: "showUpgradeValues",
                type: "toggle",
                label: label("Show Exact Upgrade & Passive Values", "显示升级词条与异化/被动精确数值", "顯示升級詞條與異化/被動精確數值"),
                default: true,
                help: "Appends exact percentages & burst multipliers in parentheses (including locked preview tiers)",
            },
            {
                key: "showSkillMultipliers",
                type: "toggle",
                label: label("Show Skill Multipliers", "在原有技能后追加精确倍率", "在原有技能後追加精確倍率"),
                default: true,
                help: "Appends hit count, damage & shachi multipliers to existing weapon skills",
            },
            {
                key: "showExtraMoveEntries",
                type: "toggle",
                label: label("Show Combo & Variant Move Tables", "底部新增基础连段与派生变招倍率", "底部新增基礎連段與派生變招倍率"),
                default: true,
                help: "Adds native entries at the bottom listing all combo variants, dash/draw moves & status multipliers",
            },
        ],
        onChange: (key, value) => {
            if (key in config) {
                config[key] = !!value;
                log(`Setting changed: ${key} = ${config[key]}`);
            }
        },
    });
}

function stop() {
    if (patchRetryTimer) {
        clearInterval(patchRetryTimer);
        patchRetryTimer = null;
    }
    try {
        const UIHelper = require("Library/UIHelper").default;
        if (UIHelper && origGetTextByID) {
            UIHelper.GetTextByID = origGetTextByID;
            origGetTextByID = null;
        }
    } catch (e) {}
    for (const item of hookedPrototypes) {
        try {
            item.proto.refreshBasic = item.orig;
        } catch (e) {}
    }
    hookedPrototypes = [];
    exports.ready = false;
    log(`Stopped ${MOD_ID}`);
}

exports.stop = stop;
exports.ready = false;

log(`=== ${MOD_ID} v${VERSION} starting ===`);
loadSettings();
registerMenu();
installGetTextHook();
installRefreshBasicHooks();

let retryCount = 0;
patchRetryTimer = setInterval(() => {
    retryCount++;
    const hasBpHook = hookedPrototypes.some((h) => h.tagName === "W_WeaponDetailList_C.prototype");
    if (hasBpHook || retryCount > 15) {
        clearInterval(patchRetryTimer);
        patchRetryTimer = null;
        return;
    }
    installRefreshBasicHooks();
}, 1000);

exports.ready = true;
