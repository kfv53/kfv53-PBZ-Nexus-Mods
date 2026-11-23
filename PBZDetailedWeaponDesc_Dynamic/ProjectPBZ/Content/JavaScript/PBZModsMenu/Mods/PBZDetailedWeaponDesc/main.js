"use strict";

// PBZDetailedWeaponDesc v1.2.0 (Dynamic Live-Read Edition — Optional Mod-Compatible Build)
// Lazy-reads live BulletData.DamageData and UpLevelData.GEUIDataArray directly from game memory
// when viewing a weapon, automatically reflecting changes from third-party weapon/rebalance mods.
// Falls back cleanly to static weapon_data.js whenever needed.

const UE = require("ue");
const puerts = require("puerts");
const cpp = require("cpp");

const DATA = require("./weapon_data");
const LIVE = require("./live_reader");

const STATIC_LOC_PATCHES = DATA.LOC_PATCHES || {};
const STATIC_EXTRA_MOVES = DATA.EXTRA_MOVES_BY_WEAPON || {};
const liveLocPatches = {};

const MOD_ID = "PBZDetailedWeaponDesc";
const VERSION = "1.2.1-Dynamic";
const SETTINGS_FILE = "PBZDetailedWeaponDesc.txt";
const LOG_FILE = "PBZDetailedWeaponDesc.log";
// Defer appending extra move tables briefly so polling-based weapon mods (e.g. PBZCrimsonVow)
// that check the last native entry in DynamicEntryBox can inject their custom sections first!
const APPEND_DEFER_MS = 350;

const defaults = {
    enabled: true,
    dynamicLiveRead: true,
    showUpgradeValues: true,
    showSkillMultipliers: true,
    showExtraMoveEntries: true,
    clearLiveCache: false,
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

function getCurrentLang() {
    try {
        let culture = "";
        if (UE.KismetInternationalizationLibrary && typeof UE.KismetInternationalizationLibrary.GetCurrentCulture === "function") {
            culture = String(UE.KismetInternationalizationLibrary.GetCurrentCulture() || "");
        } else if (UE.KismetInternationalizationLibrary && typeof UE.KismetInternationalizationLibrary.GetCurrentLanguage === "function") {
            culture = String(UE.KismetInternationalizationLibrary.GetCurrentLanguage() || "");
        }
        const c = culture.toLowerCase();
        if (c.includes("zh-hant") || c.includes("zh-tw") || c.includes("zh-hk") || c.includes("zh_tw")) return "zh-Hant";
        if (c.startsWith("zh")) return "zh-Hans";
        if (c.length > 0) return "en";
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
            if (k in defaults && k !== "clearLiveCache") {
                const lv = v.toLowerCase();
                config[k] = lv === "on" || lv === "true" || lv === "1" || lv === "yes";
            }
        }
        log(`Loaded settings: ${JSON.stringify(config)}`);
    } catch (e) {
        log(`loadSettings error: ${e}`);
    }
}

function installGetTextHook() {
    try {
        const UIHelper = require("Library/UIHelper").default;
        if (!UIHelper || typeof UIHelper.GetTextByID !== "function") return false;
        if (origGetTextByID) return true;
        origGetTextByID = UIHelper.GetTextByID;
        UIHelper.GetTextByID = function (str, dtvDefaultStyle) {
            const origText = origGetTextByID.call(this, str, dtvDefaultStyle);
            if (!config.enabled || !str) return origText;
            const key = String(str);
            const patch = (config.dynamicLiveRead && liveLocPatches[key]) ? liveLocPatches[key] : STATIC_LOC_PATCHES[key];
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
        log(`Hooked UIHelper.GetTextByID (dynamic=${config.dynamicLiveRead}, staticFallback=${Object.keys(STATIC_LOC_PATCHES).length}, lang=${getCurrentLang()})`);
        return true;
    } catch (e) {
        log(`installGetTextHook error: ${e}`);
        return false;
    }
}

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

    let entries = null;
    if (config.dynamicLiveRead) {
        try {
            entries = LIVE.getLiveWeaponData(equipKey, weaponID, isMain, backpackSubsystem, liveLocPatches, log);
        } catch (e) {
            log(`Live read error for ${equipKey}, falling back to static: ${e}`);
        }
    }
    if (!entries || entries.length === 0) {
        const pack = STATIC_EXTRA_MOVES[equipKey];
        entries = pack && Array.isArray(pack.entries) ? pack.entries : null;
    }
    if (!entries || entries.length === 0) return;

    for (const item of entries) {
        try {
            const entry = widget.DynamicEntryBox.BP_CreateEntryOfClass(widget.NormalTextClass);
            if (!entry) continue;
            const titleStr = pickLocalized(item.title);
            const descStr = pickLocalized(item.desc);
            entry.InitText(cpp.FText.FromString(titleStr), cpp.FText.FromString(descStr));
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
        // Cancel any pending deferred append from a previous weapon selection on this widget
        this.__pbzAppendGen = (this.__pbzAppendGen || 0) + 1;
        if (this.__pbzAppendTimer) {
            clearTimeout(this.__pbzAppendTimer);
            this.__pbzAppendTimer = null;
        }
        // Pre-warm live upgrade/skill patches BEFORE native refreshBasic calls GetTextByID
        if (config.enabled && config.dynamicLiveRead && weaponID && weaponID !== "None" && backpackSubsystem) {
            try {
                let equipKey = "";
                if (isMain) {
                    const d = backpackSubsystem.GetMainWeaponTableData(weaponID);
                    if (d && d.EquipDescription) equipKey = String(d.EquipDescription.Key || "");
                    if (d) void d.WeaponUpLevelDatas;
                } else {
                    const d = backpackSubsystem.GetShaqiWeaponTableData(weaponID);
                    if (d && d.EquipDescription) equipKey = String(d.EquipDescription.Key || "");
                    if (d) void d.ShaChiWeaponUpLevelData;
                }
                if (equipKey && equipKey !== "None") {
                    LIVE.getLiveWeaponData(equipKey, weaponID, isMain, backpackSubsystem, liveLocPatches, log);
                }
            } catch (e) {}
        }
        const res = orig.call(this, weaponID, isMain, splitTitleFromDesc, backpackSubsystem);
        // Defer appending bottom move tables so polling-based third-party weapon mods (e.g. PBZCrimsonVow)
        // see the native last entry first and inject their custom sections without being blocked.
        const gen = this.__pbzAppendGen;
        const self = this;
        this.__pbzAppendTimer = setTimeout(() => {
            self.__pbzAppendTimer = null;
            if (self.__pbzAppendGen !== gen) return;
            try {
                if (!UE.KismetSystemLibrary.IsValid(self)) return;
            } catch (e) {
                return;
            }
            try {
                if (!self.__pbzExtraAppending) {
                    self.__pbzExtraAppending = true;
                    try {
                        appendExtraMoveEntries(self, weaponID, isMain, backpackSubsystem);
                    } finally {
                        self.__pbzExtraAppending = false;
                    }
                }
            } catch (e) {
                log(`refreshBasic deferred append error (${tagName}): ${e}`);
            }
        }, APPEND_DEFER_MS);
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
            if (wrapRefreshBasicOnProto(mod.WeaponDetailListInterface.prototype, "WeaponDetailListInterface.prototype")) any = true;
        }
    } catch (e) {}
    try {
        const ucls = UE.Class.Load("/Game/PBZContent/UI/UINew/HUD/W_WeaponDetailList.W_WeaponDetailList_C");
        if (ucls) {
            const jsCls = puerts.blueprint.tojs(ucls);
            if (jsCls && jsCls.prototype && typeof jsCls.prototype.refreshBasic === "function") {
                if (wrapRefreshBasicOnProto(jsCls.prototype, "W_WeaponDetailList_C.prototype")) any = true;
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
        title: label("Detailed Weapon Descriptions (Dynamic)", "武器与影之武装详细倍率说明 (动态兼容版)", "武器與影之武裝詳細倍率說明 (動態相容版)"),
        description: label(
            "Dynamically reads live BulletData & upgrade values for compatibility with weapon rebalance mods (auto fallback to static table).",
            "按需实时读取游戏内存中的招式与升级数值，自动兼容其他武器修改 Mod（读取失败自动回退原版表）。",
            "按需即時讀取遊戲記憶體中的招式與升級數值，自動相容其他武器修改 Mod（讀取失敗自動回退原版表）。"
        ),
        version: VERSION,
        file: SETTINGS_FILE,
        settings: [
            { key: "enabled", type: "toggle", label: label("Enable Detailed Descriptions", "启用详细数值说明", "啟用詳細數值說明"), default: true },
            { key: "dynamicLiveRead", type: "toggle", label: label("Dynamic Live Read (Mod Compat)", "实时动态读取 (兼容其他武器Mod)", "即時動態讀取 (相容其他武器Mod)"), default: true },
            { key: "showUpgradeValues", type: "toggle", label: label("Show Exact Upgrade & Passive Values", "显示升级词条与异化/被动精确数值", "顯示升級詞條與異化/被動精確數值"), default: true },
            { key: "showSkillMultipliers", type: "toggle", label: label("Show Skill Multipliers", "在原有技能后追加精确倍率", "在原有技能後追加精確倍率"), default: true },
            { key: "showExtraMoveEntries", type: "toggle", label: label("Show Combo & Variant Move Tables", "底部新增基础连段与派生变招倍率", "底部新增基礎連段與派生變招倍率"), default: true },
            { key: "clearLiveCache", type: "toggle", label: label("Refresh Live Cache", "清除动态缓存并重读", "清除動態快取並重讀"), default: false },
        ],
        onChange: (key, value) => {
            if (key === "clearLiveCache" && value) {
                LIVE.clearCache();
                for (const k of Object.keys(liveLocPatches)) delete liveLocPatches[k];
                log("Live weapon cache cleared.");
                return;
            }
            if (key in config) {
                config[key] = !!value;
                log(`Setting changed: ${key} = ${config[key]}`);
            }
        },
    });
}

function stop() {
    if (patchRetryTimer) { clearInterval(patchRetryTimer); patchRetryTimer = null; }
    try {
        const UIHelper = require("Library/UIHelper").default;
        if (UIHelper && origGetTextByID) { UIHelper.GetTextByID = origGetTextByID; origGetTextByID = null; }
    } catch (e) {}
    for (const item of hookedPrototypes) {
        try { item.proto.refreshBasic = item.orig; } catch (e) {}
    }
    hookedPrototypes = [];
    LIVE.clearCache();
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
    if (hasBpHook || retryCount > 15) { clearInterval(patchRetryTimer); patchRetryTimer = null; return; }
    installRefreshBasicHooks();
}, 1000);

exports.ready = true;
