"use strict";

// PBZExtraAccessorySlots v1.3.0
// Adds 0-12 extra unlocked accessory slots AFTER the 6 vanilla slots without modifying vanilla unlock progress.
// - Matches vanilla 3-column UniformGridPanel layout & exact spacing
// - Resolves GESoftClass + SetByCaller AddAttributes from GetAccessoryEffectiveGEData & applies via
//   MakeOutgoingSpec + AssignTagSetByCallerMagnitude + BP_ApplyGameplayEffectSpecToSelf
// - Fixes WorldContextObject for PBZBackPackSubsystem so save-reload restoration works immediately in-world
// - Auto safely unequips overflow slots (and removes their active GEs/GAs) when reducing extraSlots or disabling the mod
// - Optional toggle to uncap same-type 3-accessory limit (default Off)

const UE = require("ue");
const puerts = require("puerts");

const MOD_ID = "PBZExtraAccessorySlots";
const VERSION = "1.3.1";
const VANILLA_SLOTS = 6;
const MAX_EXTRA_SLOTS = 12;
const SLOTS_PER_ROW = 3;
const SETTINGS_FILE = "PBZExtraAccessorySlots.txt";
const LOG_FILE = "PBZExtraAccessorySlots.log";
const LOADOUT_FILE = "PBZExtraAccessorySlots_loadout.json";

const defaults = {
    enabled: true,
    extraSlots: 1,
    uncapSameType: false,
};

const config = { ...defaults };

let stopped = false;
let pollTimer = undefined;
let settingsTimer = undefined;
let settingsPath = "";
let settingsCreated = false;
let logPath = "";
let loadoutPath = "";
const logLines = [];
let flushedCount = 0;

let v4ProtoPatched = false;
let origMethods = null;
const activeV4Widgets = new Set();
let lastRestoredBp = null;
let lastAppliedAsc = null;
let geStructLogged = false;
let accDataLogged = false;

// Track manually applied GAS handles per extra slot index: Map<slotIndex, { accId, asc, geHandles: [], gaHandles: [] }>
const appliedExtraHandles = new Map();

// ============================================================================
// Utilities
// ============================================================================

function isAlive(obj) {
    if (!obj) return false;
    try {
        return UE.KismetSystemLibrary.IsValid(obj);
    } catch (_) {
        return false;
    }
}

function getTsHelper() {
    try {
        const m = require("Library/TsHelper");
        return m && m.default ? m.default : m;
    } catch (_) {
        return null;
    }
}

function getUIHelper() {
    try {
        const m = require("Library/UIHelper");
        return m && m.default ? m.default : m;
    } catch (_) {
        return null;
    }
}

function getGameInstance() {
    try {
        const gi = puerts.argv && puerts.argv.getByName ? puerts.argv.getByName("GameInstance") : null;
        return isAlive(gi) ? gi : null;
    } catch (_) {
        return null;
    }
}

function getPlayerPawn() {
    try {
        const gi = getGameInstance();
        if (!gi || !UE.GameplayStatics) return null;
        const pawn = UE.GameplayStatics.GetPlayerPawn(gi, 0);
        return isAlive(pawn) ? pawn : null;
    } catch (_) {
        return null;
    }
}

function getPlayerController() {
    try {
        const gi = getGameInstance();
        if (!gi || !UE.GameplayStatics) return null;
        const pc = UE.GameplayStatics.GetPlayerController(gi, 0);
        return isAlive(pc) ? pc : null;
    } catch (_) {
        return null;
    }
}

function getBackPackSubsystem(ctx) {
    if (!UE.PBZBackPackSubsystem) return null;
    const sc = UE.PBZBackPackSubsystem.StaticClass();
    const TH = getTsHelper();
    // WorldSubsystem needs a valid WorldContextObject (Widget, Pawn, or PlayerController before GameInstance)
    const candidates = [];
    if (isAlive(ctx)) candidates.push(ctx);
    const pawn = getPlayerPawn();
    if (isAlive(pawn)) candidates.push(pawn);
    const pc = getPlayerController();
    if (isAlive(pc)) candidates.push(pc);
    const gi = getGameInstance();
    if (isAlive(gi)) candidates.push(gi);

    for (const target of candidates) {
        try {
            if (TH && typeof TH.getWorldSubsystem === "function") {
                const bp = TH.getWorldSubsystem(target, sc);
                if (isAlive(bp)) return bp;
            }
        } catch (_) {}
        try {
            const bp = UE.SubsystemBlueprintLibrary.GetWorldSubsystem(target, sc);
            if (isAlive(bp)) return bp;
        } catch (_) {}
    }
    return null;
}

function getPlayerASC() {
    try {
        const pawn = getPlayerPawn();
        if (!isAlive(pawn) || !UE.AbilitySystemBlueprintLibrary) return null;
        const asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(pawn);
        return isAlive(asc) ? asc : null;
    } catch (_) {
        return null;
    }
}

function getPlayerActiveGECount(asc) {
    try {
        const target = isAlive(asc) ? asc : getPlayerASC();
        if (!isAlive(target) || !target.ActiveGameplayEffects || !target.ActiveGameplayEffects.GameplayEffects_Internal) return -1;
        return target.ActiveGameplayEffects.GameplayEffects_Internal.Num();
    } catch (_) {
        return -1;
    }
}

function getSavedFilePath(filename) {
    try {
        const savedDir = UE.KismetSystemLibrary.GetProjectSavedDirectory();
        return UE.KismetSystemLibrary.ConvertToAbsolutePath(
            savedDir.replace(/[\\/]*$/, "/") + filename
        );
    } catch (_) {
        return "";
    }
}

function log(msg) {
    const line = "[" + new Date().toISOString() + "] " + String(msg);
    logLines.push(line);
    if (logLines.length > 500) logLines.shift();
    try { console.log("[" + MOD_ID + "] " + msg); } catch (_) {}
}

function flushLog() {
    if (logLines.length === flushedCount) return;
    if (!logPath) logPath = getSavedFilePath(LOG_FILE);
    if (!logPath) return;
    try {
        UE.EasyCsv.SaveStringToFileWithFullPath(logLines.join("\r\n") + "\r\n", logPath);
        flushedCount = logLines.length;
    } catch (_) {}
}

function isEmptyItemId(id) {
    if (id === null || id === undefined) return true;
    const s = String(id).trim();
    return s === "" || s.toLowerCase() === "none";
}

function effectiveExtraSlots() {
    if (!config.enabled) return 0;
    const n = Math.floor(Number(config.extraSlots) || 0);
    return Math.max(0, Math.min(MAX_EXTRA_SLOTS, n));
}

function effectiveTotalSlots() {
    return VANILLA_SLOTS + effectiveExtraSlots();
}

// ============================================================================
// Direct GAS GameplayEffect / SetByCaller Application for Extra Slots
// ============================================================================

function resolveSoftClass(softOrClass) {
    if (!softOrClass) return null;
    try {
        // Already a UClass
        if (isAlive(softOrClass) && (softOrClass instanceof UE.Class || typeof softOrClass.GetSuperStruct === "function")) {
            return softOrClass;
        }
        // TSoftClassPtr.Get()
        if (typeof softOrClass.Get === "function") {
            const loaded = softOrClass.Get();
            if (isAlive(loaded)) return loaded;
        }
        // TSoftClassPtr.LoadSynchronous()
        if (typeof softOrClass.LoadSynchronous === "function") {
            const loaded = softOrClass.LoadSynchronous();
            if (isAlive(loaded)) return loaded;
        }
        // KismetSystemLibrary.LoadClassAsset_Blocking
        if (UE.KismetSystemLibrary && typeof UE.KismetSystemLibrary.LoadClassAsset_Blocking === "function") {
            try {
                const loaded = UE.KismetSystemLibrary.LoadClassAsset_Blocking(softOrClass);
                if (isAlive(loaded)) return loaded;
            } catch (_) {}
        }
        // Convert SoftClassReference to asset path string -> UE.Class.Load(path)
        let pathStr = "";
        if (typeof softOrClass === "string") {
            pathStr = softOrClass;
        } else if (UE.KismetSystemLibrary && typeof UE.KismetSystemLibrary.Conv_SoftClassReferenceToString === "function") {
            try { pathStr = String(UE.KismetSystemLibrary.Conv_SoftClassReferenceToString(softOrClass)); } catch (_) {}
        }
        if (!pathStr && UE.KismetSystemLibrary && typeof UE.KismetSystemLibrary.Conv_SoftObjectReferenceToString === "function") {
            try { pathStr = String(UE.KismetSystemLibrary.Conv_SoftObjectReferenceToString(softOrClass)); } catch (_) {}
        }
        if (!pathStr && softOrClass.AssetPathName !== undefined) {
            pathStr = String(softOrClass.AssetPathName);
        }
        if (pathStr && pathStr !== "None" && pathStr !== "") {
            const cls = UE.Class.Load(pathStr);
            if (isAlive(cls)) return cls;
        }
    } catch (e) {
        log("resolveSoftClass err: " + String(e));
    }
    return null;
}

function logStructPreview(label, obj) {
    if (!obj || typeof obj !== "object") return;
    const parts = [];
    try {
        for (const k in obj) {
            try {
                const v = obj[k];
                let s = String(v);
                if (isAlive(v)) s = UE.KismetSystemLibrary.GetPathName(v);
                else if (v && typeof v.Num === "function") s = "Container(Num=" + v.Num() + ")";
                parts.push(k + "=" + s.slice(0, 100));
            } catch (_) {
                parts.push(k + "=?");
            }
        }
    } catch (_) {}
    log(label + ": " + parts.join(" | "));
}

function applySingleGEEntry(asc, entry, effectLevel, accId, index) {
    if (!entry || typeof entry !== "object") return null;

    if (!geStructLogged) {
        geStructLogged = true;
        logStructPreview("GEData entry fields (" + accId + ")", entry);
    }

    const soft = entry.SoftClassPtr !== undefined ? entry.SoftClassPtr
        : (entry.GESoftClass !== undefined ? entry.GESoftClass : (entry.GEClass || entry.GameplayEffectClass));
    const geLevel = (typeof entry.GELevel === "number" && entry.GELevel > 0) ? entry.GELevel : effectLevel;
    const geCls = resolveSoftClass(soft);
    if (!isAlive(geCls)) {
        let softInfo = String(soft);
        try {
            if (soft && typeof soft === "object") {
                softInfo += " keys=" + Object.getOwnPropertyNames(Object.getPrototypeOf(soft)).slice(0, 15).join(",");
            }
        } catch (_) {}
        log("Could not resolve SoftClassPtr for " + accId + " (" + softInfo + ")");
        return null;
    }

    const clsPath = UE.KismetSystemLibrary.GetPathName(geCls);

    // Collect SetByCaller magnitudes from entry.AddAttributes (TMap<FGameplayTag, float>) if present
    const setByCallerPairs = [];
    try {
        const attrs = entry.AddAttributes;
        if (attrs && typeof attrs.Num === "function" && typeof attrs.GetKey === "function") {
            const cnt = attrs.Num();
            for (let i = 0; i < cnt; i++) {
                const tag = attrs.GetKey(i);
                const val = attrs.Get(tag);
                setByCallerPairs.push([tag, Number(val)]);
            }
        }
    } catch (e) {
        log("Read AddAttributes err: " + String(e));
    }

    // Prefer MakeOutgoingSpec + AssignTagSetByCallerMagnitude + BP_ApplyGameplayEffectSpecToSelf
    try {
        if (typeof asc.MakeOutgoingSpec === "function" && typeof asc.BP_ApplyGameplayEffectSpecToSelf === "function") {
            const ctx = asc.MakeEffectContext();
            let spec = asc.MakeOutgoingSpec(geCls, geLevel, ctx);
            for (const [tag, val] of setByCallerPairs) {
                try {
                    spec = UE.AbilitySystemBlueprintLibrary.AssignTagSetByCallerMagnitude(spec, tag, val);
                } catch (e) {
                    log("AssignTagSetByCallerMagnitude(" + (tag && tag.TagName ? tag.TagName : tag) + "=" + val + ") err: " + String(e));
                }
            }
            const handle = asc.BP_ApplyGameplayEffectSpecToSelf(spec);
            const attrLog = setByCallerPairs.map(([t, v]) => (t && t.TagName ? t.TagName : String(t)) + "=" + v).join(", ");
            log("Applied GE spec " + clsPath + " (lv=" + geLevel + ", attrs=[" + attrLog + "]) for slot #" + index + " (" + accId + ")");
            return handle;
        }
    } catch (e) {
        log("BP_ApplyGameplayEffectSpecToSelf err: " + String(e));
    }

    // Fallback: BP_ApplyGameplayEffectToSelf
    try {
        const ctx = asc.MakeEffectContext();
        const handle = asc.BP_ApplyGameplayEffectToSelf(geCls, geLevel, ctx);
        log("Applied GE (fallback) " + clsPath + " (lv=" + geLevel + ") for slot #" + index + " (" + accId + ")");
        return handle;
    } catch (e) {
        log("BP_ApplyGameplayEffectToSelf fallback err: " + String(e));
    }
    return null;
}

function clearAppliedExtraSlotEffects(index) {
    const rec = appliedExtraHandles.get(index);
    if (!rec) return;
    appliedExtraHandles.delete(index);

    const asc = isAlive(rec.asc) ? rec.asc : getPlayerASC();
    if (!isAlive(asc)) return;

    for (const h of rec.geHandles) {
        try {
            asc.RemoveActiveGameplayEffect(h, -1);
        } catch (_) {
            try { asc.RemoveActiveGameplayEffect(h); } catch (_) {}
        }
    }
    for (const ah of rec.gaHandles) {
        try {
            if (typeof asc.ClearAbility === "function") asc.ClearAbility(ah);
        } catch (_) {}
    }
}

function applyAccessoryEffectsDirectly(bp, accId, index) {
    clearAppliedExtraSlotEffects(index);
    const asc = getPlayerASC();
    if (!isAlive(asc) || !isAlive(bp)) {
        log("applyAccessoryEffectsDirectly skipped: asc=" + isAlive(asc) + " bp=" + isAlive(bp));
        return 0;
    }

    let currentLevel = 0;
    try {
        const info = bp.Accessories ? bp.Accessories.Get(accId) : undefined;
        if (info !== undefined && info !== null && typeof info.CurrentLevel === "number") {
            currentLevel = info.CurrentLevel;
        }
    } catch (_) {}

    const geHandles = [];
    const gaHandles = [];
    const geEntries = [];

    // 1. Try UE.PBZBackPackSubsystem.GetAccessoryEffectiveGEData(accId, currentLevel)
    try {
        if (typeof UE.PBZBackPackSubsystem.GetAccessoryEffectiveGEData === "function") {
            const geList = UE.PBZBackPackSubsystem.GetAccessoryEffectiveGEData(accId, currentLevel);
            if (geList) {
                if (typeof geList.Num === "function" && typeof geList.Get === "function") {
                    for (let i = 0; i < geList.Num(); i++) geEntries.push(geList.Get(i));
                } else if (Array.isArray(geList) || typeof geList[Symbol.iterator] === "function") {
                    for (const item of geList) geEntries.push(item);
                }
            }
        }
    } catch (e) {
        log("GetAccessoryEffectiveGEData(" + accId + ", " + currentLevel + ") err: " + String(e));
    }

    // 2. Also inspect GetAccessoryData(accId) if geEntries is empty or for diagnostic logging
    try {
        const accData = UE.PBZBackPackSubsystem.GetAccessoryData(accId);
        if (accData && !accDataLogged) {
            accDataLogged = true;
            logStructPreview("GetAccessoryData(" + accId + ")", accData);
        }
        if (geEntries.length === 0 && accData && accData.AccessoryLevelDatas && typeof accData.AccessoryLevelDatas.Num === "function") {
            const lvIdx = Math.max(0, Math.min(currentLevel, accData.AccessoryLevelDatas.Num() - 1));
            const lvData = accData.AccessoryLevelDatas.Get(lvIdx);
            if (lvData && lvData.GEData) {
                if (typeof lvData.GEData.Num === "function") {
                    for (let i = 0; i < lvData.GEData.Num(); i++) geEntries.push(lvData.GEData.Get(i));
                } else {
                    geEntries.push(lvData.GEData);
                }
            }
        }
    } catch (e) {
        log("GetAccessoryData fallback err: " + String(e));
    }

    log("applyAccessoryEffectsDirectly(" + accId + ", lv=" + currentLevel + ", slot=#" + index + "): found " + geEntries.length + " GEData entry(ies)");

    for (const entry of geEntries) {
        const handle = applySingleGEEntry(asc, entry, currentLevel + 1, accId, index);
        if (handle) geHandles.push(handle);
        // Also check nested AbilityDataGEData if present
        if (entry && entry.AbilityDataGEData && typeof entry.AbilityDataGEData === "object") {
            const sub = entry.AbilityDataGEData;
            if (typeof sub.Num === "function" && typeof sub.Get === "function") {
                for (let j = 0; j < sub.Num(); j++) {
                    const sh = applySingleGEEntry(asc, sub.Get(j), currentLevel + 1, accId + ":AbilityGE", index);
                    if (sh) geHandles.push(sh);
                }
            } else if (sub.GESoftClass) {
                const sh = applySingleGEEntry(asc, sub, currentLevel + 1, accId + ":AbilityGE", index);
                if (sh) geHandles.push(sh);
            }
        }
    }

    if (geHandles.length > 0 || gaHandles.length > 0) {
        appliedExtraHandles.set(index, { accId, asc, geHandles, gaHandles });
        lastAppliedAsc = asc;
    }
    return geHandles.length;
}

function reapplyAllExtraSlotEffects(bp) {
    const asc = getPlayerASC();
    if (!isAlive(asc) || !isAlive(bp) || !bp.AssemblyAccessory) return;
    if (asc === lastAppliedAsc) return;

    const total = effectiveTotalSlots();
    const arr = bp.AssemblyAccessory;
    let reapplied = 0;
    for (let i = VANILLA_SLOTS; i < Math.min(arr.Num(), total); i++) {
        const id = String(arr.Get(i));
        if (!isEmptyItemId(id)) {
            const n = applyAccessoryEffectsDirectly(bp, id, i);
            if (n > 0) reapplied++;
        }
    }
    lastAppliedAsc = asc;
    if (reapplied > 0) {
        log("Re-applied extra-slot GameplayEffects for " + reapplied + " accessory(ies) on new Player ASC.");
        flushLog();
    }
}

// ============================================================================
// Extra-Slot Loadout Persistence
// ============================================================================

function saveExtraLoadout(bp) {
    if (!isAlive(bp) || !bp.AssemblyAccessory) return;
    if (!loadoutPath) loadoutPath = getSavedFilePath(LOADOUT_FILE);
    if (!loadoutPath) return;
    try {
        const arr = bp.AssemblyAccessory;
        const map = {};
        const limit = Math.min(arr.Num(), VANILLA_SLOTS + MAX_EXTRA_SLOTS);
        for (let i = VANILLA_SLOTS; i < limit; i++) {
            const id = String(arr.Get(i));
            if (!isEmptyItemId(id)) map[String(i)] = id;
        }
        UE.EasyCsv.SaveStringToFileWithFullPath(JSON.stringify(map, null, 2) + "\r\n", loadoutPath);
    } catch (e) {
        log("saveExtraLoadout error: " + String(e));
    }
}

function readExtraLoadout() {
    if (!loadoutPath) loadoutPath = getSavedFilePath(LOADOUT_FILE);
    if (!loadoutPath || !UE.BlueprintPathsLibrary || !UE.BlueprintPathsLibrary.FileExists(loadoutPath)) return {};
    try {
        const out = puerts.$ref("");
        if (!UE.EasyCsv.LoadStringFromLocalFile(loadoutPath, out)) return {};
        const raw = String(puerts.$unref(out)).trim();
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
        return {};
    }
}

function restoreExtraLoadoutIfNeeded(bp) {
    if (!isAlive(bp) || bp === lastRestoredBp) return;
    const desiredExtra = effectiveExtraSlots();
    if (desiredExtra <= 0) {
        lastRestoredBp = bp;
        return;
    }
    if (!bp.Accessories || bp.Accessories.Num() === 0) return;
    if (!isAlive(getPlayerASC())) return;

    lastRestoredBp = bp;
    const saved = readExtraLoadout();
    const keys = Object.keys(saved);
    if (keys.length === 0) return;

    const total = effectiveTotalSlots();
    ensureAssemblyCapacity(bp, total);
    let restored = 0;
    for (const k of keys) {
        const idx = parseInt(k, 10);
        const accId = saved[k];
        if (!Number.isFinite(idx) || idx < VANILLA_SLOTS || idx >= total || isEmptyItemId(accId)) continue;
        const owned = bp.Accessories.Get(accId);
        if (owned === undefined || owned === null) continue;
        const alreadyAt = bp.AssemblyAccessory.FindIndex(accId);
        if (alreadyAt >= 0 && alreadyAt < VANILLA_SLOTS) continue;
        if (equipIntoExtraSlot(bp, accId, idx, true)) {
            restored++;
        }
    }
    if (restored > 0) {
        log("Restored " + restored + " extra-slot accessory(ies) from saved loadout.");
    }
    flushLog();
}

// ============================================================================
// Backend Equip / Unequip for Extra Slots (index >= 6)
// ============================================================================

function ensureAssemblyCapacity(bp, targetTotal) {
    if (!isAlive(bp) || !bp.AssemblyAccessory) return false;
    try {
        const arr = bp.AssemblyAccessory;
        while (arr.Num() < targetTotal) {
            arr.Add("None");
        }
        return arr.Num() >= targetTotal;
    } catch (e) {
        log("ensureAssemblyCapacity error: " + String(e));
        return false;
    }
}

function takeOffExtraSlot(bp, index, silentSave) {
    if (!isAlive(bp) || !bp.AssemblyAccessory) return false;
    const arr = bp.AssemblyAccessory;
    if (!arr.IsValidIndex(index)) return false;

    const oldId = String(arr.Get(index));
    if (isEmptyItemId(oldId)) {
        clearAppliedExtraSlotEffects(index);
        return true;
    }

    const geBefore = getPlayerActiveGECount();

    clearAppliedExtraSlotEffects(index);

    try {
        bp.TakeOffAccessory(index);
    } catch (e) {
        log("Native TakeOffAccessory(" + index + ") threw: " + String(e));
    }

    if (arr.IsValidIndex(index) && String(arr.Get(index)) === oldId) {
        try {
            arr.Set(index, "None");
            if (bp.TakeOffAccessoryDelegate && typeof bp.TakeOffAccessoryDelegate.Broadcast === "function") {
                bp.TakeOffAccessoryDelegate.Broadcast(oldId);
            }
        } catch (e) {
            log("Manual takeOffExtraSlot(" + index + ", " + oldId + ") error: " + String(e));
            return false;
        }
    }

    const geAfter = getPlayerActiveGECount();
    log("Unequipped extra slot #" + index + " (" + oldId + ") | ActiveGEs: " + geBefore + " -> " + geAfter);
    if (!silentSave) saveExtraLoadout(bp);
    flushLog();
    return true;
}

function equipIntoExtraSlot(bp, newAccessory, index, silentSave) {
    if (!isAlive(bp) || !bp.AssemblyAccessory || isEmptyItemId(newAccessory)) return false;
    ensureAssemblyCapacity(bp, index + 1);
    const arr = bp.AssemblyAccessory;

    if (arr.IsValidIndex(index)) {
        const prev = String(arr.Get(index));
        if (!isEmptyItemId(prev)) {
            if (prev === String(newAccessory) && appliedExtraHandles.has(index)) return true;
            takeOffExtraSlot(bp, index, true);
        }
    }

    const geBefore = getPlayerActiveGECount();

    try {
        arr.Set(index, newAccessory);
    } catch (e) {
        log("AssemblyAccessory.Set(" + index + ", " + newAccessory + ") error: " + String(e));
        return false;
    }

    // Apply GameplayEffects directly via GetAccessoryEffectiveGEData + SetByCaller AddAttributes
    const appliedCount = applyAccessoryEffectsDirectly(bp, newAccessory, index);

    try {
        if (bp.EquipAccessoryDelegate && typeof bp.EquipAccessoryDelegate.Broadcast === "function") {
            bp.EquipAccessoryDelegate.Broadcast(newAccessory);
        }
    } catch (_) {}

    const landed = arr.IsValidIndex(index) && String(arr.Get(index)) === String(newAccessory);
    const geAfter = getPlayerActiveGECount();
    log("Equipped extra slot #" + index + " -> " + newAccessory + " | landed=" + landed + " | appliedGEs=" + appliedCount + " | ActiveGEs: " + geBefore + " -> " + geAfter);
    if (landed && !silentSave) saveExtraLoadout(bp);
    flushLog();
    return landed;
}

function unequipOverflowSlots(bp, newTotal) {
    if (!isAlive(bp) || !bp.AssemblyAccessory) return 0;
    let removed = 0;
    try {
        const arr = bp.AssemblyAccessory;
        const count = arr.Num();
        for (let i = count - 1; i >= newTotal; i--) {
            if (!arr.IsValidIndex(i)) continue;
            const id = String(arr.Get(i));
            if (!isEmptyItemId(id)) {
                log("Auto-unequipping overflow extra slot #" + i + " (" + id + ")");
                if (takeOffExtraSlot(bp, i, true)) removed++;
            } else {
                clearAppliedExtraSlotEffects(i);
            }
        }
        if (removed > 0) saveExtraLoadout(bp);
    } catch (e) {
        log("unequipOverflowSlots error: " + String(e));
    }
    return removed;
}

// ============================================================================
// UI Layout: Inspect exact vanilla 3-col accessory layout & clone its spacing
// ============================================================================

function cloneMargin(m) {
    const out = new UE.Margin();
    if (m) {
        out.Left = m.Left || 0;
        out.Top = m.Top || 0;
        out.Right = m.Right || 0;
        out.Bottom = m.Bottom || 0;
    }
    return out;
}

function inspectVanillaLayout(v4) {
    if (!isAlive(v4) || !isAlive(v4.Accessory0) || !isAlive(v4.Accessory1) || !isAlive(v4.Accessory3)) return null;

    const acc0 = v4.Accessory0;
    const acc1 = v4.Accessory1;
    const acc2 = v4.Accessory2;
    const acc3 = v4.Accessory3;

    const p0 = acc0.GetParent();
    const p1 = acc1.GetParent();
    const p3 = acc3.GetParent();
    if (!isAlive(p0) || !isAlive(p1) || !isAlive(p3)) return null;

    let item0 = acc0, item1 = acc1, item2 = acc2, item3 = acc3;
    let wrappedInSizeBox = false;
    let slotWidth = 0, slotHeight = 0;
    let row0Panel = p0;
    let row1Panel = p3;

    if (p0 !== p1 && isAlive(p0.GetParent()) && p0.GetParent() === p1.GetParent()) {
        item0 = p0;
        item1 = p1;
        item2 = isAlive(acc2) ? acc2.GetParent() : null;
        item3 = p3;
        row0Panel = p0.GetParent();
        row1Panel = p3.GetParent();
        if (p0 instanceof UE.SizeBox) {
            wrappedInSizeBox = true;
            slotWidth = p0.WidthOverride || 0;
            slotHeight = p0.HeightOverride || 0;
        }
    }

    const isUniformGrid = row0Panel instanceof UE.UniformGridPanel;
    const isGridPanel = row0Panel instanceof UE.GridPanel;
    const isWrapBox = row0Panel instanceof UE.WrapBox;

    let hSpacerWidth = 0;
    let colPaddings = [null, null, null];
    try {
        if (item0 && item0.Slot && item0.Slot.Padding) colPaddings[0] = cloneMargin(item0.Slot.Padding);
        if (item1 && item1.Slot && item1.Slot.Padding) colPaddings[1] = cloneMargin(item1.Slot.Padding);
        if (item2 && item2.Slot && item2.Slot.Padding) colPaddings[2] = cloneMargin(item2.Slot.Padding);
    } catch (_) {}

    if (!isUniformGrid && !isGridPanel && typeof row0Panel.GetChildrenCount === "function") {
        try {
            const cnt = row0Panel.GetChildrenCount();
            for (let i = 0; i < cnt; i++) {
                const ch = row0Panel.GetChildAt(i);
                if (ch instanceof UE.Spacer && ch.Size && ch.Size.X > 0) {
                    hSpacerWidth = ch.Size.X;
                    break;
                }
            }
        } catch (_) {}
    }

    let vBox = null;
    let row1WrapperInVBox = null;
    let vSpacerHeight = 0;
    let rowPadding = null;

    if (row0Panel !== row1Panel && isAlive(row0Panel.GetParent()) && row0Panel.GetParent() === row1Panel.GetParent() && (row0Panel.GetParent() instanceof UE.VerticalBox)) {
        vBox = row0Panel.GetParent();
        row1WrapperInVBox = row1Panel;
    } else {
        let walk = row0Panel.GetParent();
        for (let d = 0; d < 6 && isAlive(walk); d++) {
            if (walk instanceof UE.VerticalBox) {
                vBox = walk;
                break;
            }
            walk = walk.GetParent();
        }
    }

    if (isAlive(vBox)) {
        try {
            if (isAlive(row1WrapperInVBox) && row1WrapperInVBox.Slot && row1WrapperInVBox.Slot.Padding) {
                rowPadding = cloneMargin(row1WrapperInVBox.Slot.Padding);
            }
            if (row0Panel !== row1Panel && typeof vBox.GetChildrenCount === "function") {
                const idx0 = vBox.GetChildIndex(row0Panel);
                const idx1 = vBox.GetChildIndex(row1Panel);
                if (idx0 >= 0 && idx1 > idx0 + 1) {
                    for (let k = idx0 + 1; k < idx1; k++) {
                        const between = vBox.GetChildAt(k);
                        if (between instanceof UE.Spacer && between.Size && between.Size.Y > 0) {
                            vSpacerHeight = between.Size.Y;
                            break;
                        }
                    }
                }
            }
        } catch (_) {}
    }

    return {
        row0Panel,
        row1Panel,
        vBox,
        isUniformGrid,
        isGridPanel,
        isWrapBox,
        wrappedInSizeBox,
        slotWidth,
        slotHeight,
        hSpacerWidth,
        vSpacerHeight,
        colPaddings,
        rowPadding,
        buttonClass: acc0.GetClass(),
    };
}

function getVanillaButtons(v4) {
    return [v4.Accessory0, v4.Accessory1, v4.Accessory2, v4.Accessory3, v4.Accessory4, v4.Accessory5];
}

function getExtraButtons(v4) {
    return Array.isArray(v4.__pbzExtraAccButtons) ? v4.__pbzExtraAccButtons : [];
}

function clearExtraSlotDelegates(v4) {
    for (const btn of getExtraButtons(v4)) {
        if (!isAlive(btn)) continue;
        try { btn.OnSelectedChangedBase.Clear(); } catch (_) {}
        try { btn.OnButtonBaseClicked.Clear(); } catch (_) {}
    }
}

function bindExtraSlotDelegates(v4) {
    for (const btn of getExtraButtons(v4)) {
        if (!isAlive(btn)) continue;
        try {
            btn.OnSelectedChangedBase.Clear();
            btn.OnSelectedChangedBase.Add((Button, bIsSelected) => {
                v4.OnSelectedAccessory(Button, bIsSelected);
            });
            btn.OnButtonBaseClicked.Clear();
            btn.OnButtonBaseClicked.Add((Button) => {
                v4.ClickAccessory(Button);
            });
        } catch (e) {
            log("bindExtraSlotDelegates error: " + String(e));
        }
    }
}

function wireGridNavigation(v4) {
    const vanilla = getVanillaButtons(v4);
    const extras = getExtraButtons(v4);
    const visibleExtras = extras.filter(b => isAlive(b) && b.GetVisibility() !== UE.ESlateVisibility.Collapsed);

    const rows = [
        vanilla.slice(0, 3),
        vanilla.slice(3, 6),
    ];
    for (let i = 0; i < visibleExtras.length; i += SLOTS_PER_ROW) {
        rows.push(visibleExtras.slice(i, i + SLOTS_PER_ROW));
    }

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
            const btn = row[c];
            if (!isAlive(btn)) continue;
            try {
                if (r === 1) {
                    if (rows.length > 2) {
                        const downTarget = rows[2][Math.min(c, rows[2].length - 1)];
                        if (isAlive(downTarget)) btn.SetNavigationRuleExplicit(UE.EUINavigation.Down, downTarget);
                    } else {
                        btn.SetNavigationRuleBase(UE.EUINavigation.Down, UE.EUINavigationRule.Escape);
                    }
                    continue;
                }
                const upRow = rows[r - 1];
                const upTarget = upRow[Math.min(c, upRow.length - 1)];
                if (isAlive(upTarget)) btn.SetNavigationRuleExplicit(UE.EUINavigation.Up, upTarget);

                if (r + 1 < rows.length) {
                    const downRow = rows[r + 1];
                    const downTarget = downRow[Math.min(c, downRow.length - 1)];
                    if (isAlive(downTarget)) btn.SetNavigationRuleExplicit(UE.EUINavigation.Down, downTarget);
                } else {
                    btn.SetNavigationRuleBase(UE.EUINavigation.Down, UE.EUINavigationRule.Stop);
                }

                if (c > 0 && isAlive(row[c - 1])) {
                    btn.SetNavigationRuleExplicit(UE.EUINavigation.Left, row[c - 1]);
                } else {
                    btn.SetNavigationRuleBase(UE.EUINavigation.Left, UE.EUINavigationRule.Stop);
                }

                if (c + 1 < row.length && isAlive(row[c + 1])) {
                    btn.SetNavigationRuleExplicit(UE.EUINavigation.Right, row[c + 1]);
                } else {
                    btn.SetNavigationRuleBase(UE.EUINavigation.Right, UE.EUINavigationRule.Stop);
                }
            } catch (_) {}
        }
    }
}

function ensureExtraSlotWidgets(v4) {
    if (!isAlive(v4)) return;
    const desiredExtra = effectiveExtraSlots();

    if (!Array.isArray(v4.__pbzExtraAccButtons)) {
        v4.__pbzExtraAccButtons = [];
        v4.__pbzExtraAccWrappers = [];
        v4.__pbzExtraAccSpacers = [];
        v4.__pbzExtraAccRows = [];
        v4.__pbzExtraAccRowSpacers = [];
    }

    const host = inspectVanillaLayout(v4);
    if (!host) return;

    if (v4.__pbzExtraAccButtons.length < desiredExtra) {
        const pc = UE.GameplayStatics.GetPlayerController(v4, 0);
        const owner = isAlive(pc) ? pc : v4;

        while (v4.__pbzExtraAccButtons.length < desiredExtra) {
            const extraIdx = v4.__pbzExtraAccButtons.length;
            const slotIndex = VANILLA_SLOTS + extraIdx;
            const rowIdx = Math.floor(extraIdx / SLOTS_PER_ROW);
            const colIdx = extraIdx % SLOTS_PER_ROW;

            const btn = UE.WidgetBlueprintLibrary.Create(v4, host.buttonClass, owner);
            if (!isAlive(btn)) break;
            btn.__pbzAccessorySlotIndex = slotIndex;

            let visualChild = btn;
            if (host.wrappedInSizeBox) {
                const sb = UE.NewObject(UE.SizeBox.StaticClass(), v4);
                if (isAlive(sb)) {
                    if (host.slotWidth > 0) sb.SetWidthOverride(host.slotWidth);
                    if (host.slotHeight > 0) sb.SetHeightOverride(host.slotHeight);
                    sb.AddChild(btn);
                    visualChild = sb;
                }
            }

            let preSpacer = null;

            if (host.isUniformGrid) {
                host.row0Panel.AddChildToUniformGrid(visualChild, 2 + rowIdx, colIdx);
            } else if (host.isGridPanel) {
                host.row0Panel.AddChildToGrid(visualChild, 2 + rowIdx, colIdx);
            } else if (host.isWrapBox) {
                host.row0Panel.AddChildToWrapBox(visualChild);
            } else if (isAlive(host.vBox)) {
                let hBox = v4.__pbzExtraAccRows[rowIdx];
                if (!isAlive(hBox)) {
                    if (host.vSpacerHeight > 0) {
                        const vSp = UE.NewObject(UE.Spacer.StaticClass(), v4);
                        vSp.SetSize(new UE.Vector2D(1, host.vSpacerHeight));
                        host.vBox.AddChildToVerticalBox(vSp);
                        v4.__pbzExtraAccRowSpacers[rowIdx] = vSp;
                    }
                    hBox = UE.NewObject(UE.HorizontalBox.StaticClass(), v4);
                    const vSlot = host.vBox.AddChildToVerticalBox(hBox);
                    if (vSlot && typeof vSlot.SetPadding === "function") {
                        if (host.rowPadding) {
                            vSlot.SetPadding(cloneMargin(host.rowPadding));
                        } else if (host.vSpacerHeight === 0) {
                            const pad = new UE.Margin();
                            pad.Top = 24;
                            vSlot.SetPadding(pad);
                        }
                    }
                    v4.__pbzExtraAccRows[rowIdx] = hBox;
                }

                if (colIdx > 0 && host.hSpacerWidth > 0) {
                    preSpacer = UE.NewObject(UE.Spacer.StaticClass(), v4);
                    preSpacer.SetSize(new UE.Vector2D(host.hSpacerWidth, 1));
                    hBox.AddChildToHorizontalBox(preSpacer);
                }

                const hSlot = hBox.AddChildToHorizontalBox(visualChild);
                if (hSlot && typeof hSlot.SetPadding === "function") {
                    const colPad = host.colPaddings[colIdx];
                    if (colPad) {
                        hSlot.SetPadding(cloneMargin(colPad));
                    } else if (colIdx > 0 && host.hSpacerWidth === 0) {
                        const pad = new UE.Margin();
                        pad.Left = 32;
                        hSlot.SetPadding(pad);
                    }
                }
            }

            try {
                if (v4.ButtonGroup && typeof v4.ButtonGroup.AddWidget === "function") {
                    v4.ButtonGroup.AddWidget(btn);
                }
            } catch (_) {}

            try {
                btn.OnSelectedChangedBase.Add((Button, bIsSelected) => {
                    v4.OnSelectedAccessory(Button, bIsSelected);
                });
                btn.OnButtonBaseClicked.Add((Button) => {
                    v4.ClickAccessory(Button);
                });
            } catch (_) {}

            v4.__pbzExtraAccButtons.push(btn);
            v4.__pbzExtraAccWrappers.push(visualChild);
            v4.__pbzExtraAccSpacers.push(preSpacer);
        }
    }

    for (let i = 0; i < v4.__pbzExtraAccButtons.length; i++) {
        const active = i < desiredExtra;
        const btn = v4.__pbzExtraAccButtons[i];
        const wrap = v4.__pbzExtraAccWrappers[i];
        const sp = v4.__pbzExtraAccSpacers[i];
        const vis = active ? UE.ESlateVisibility.Visible : UE.ESlateVisibility.Collapsed;
        try {
            if (isAlive(btn)) btn.SetVisibility(vis);
            if (isAlive(wrap) && wrap !== btn) wrap.SetVisibility(vis);
            if (isAlive(sp)) sp.SetVisibility(active ? UE.ESlateVisibility.SelfHitTestInvisible : UE.ESlateVisibility.Collapsed);
        } catch (_) {}
    }

    for (let r = 0; r < v4.__pbzExtraAccRows.length; r++) {
        const hBox = v4.__pbzExtraAccRows[r];
        const vSp = v4.__pbzExtraAccRowSpacers[r];
        const rowVisible = r * SLOTS_PER_ROW < desiredExtra;
        const vis = rowVisible ? UE.ESlateVisibility.SelfHitTestInvisible : UE.ESlateVisibility.Collapsed;
        try {
            if (isAlive(hBox)) hBox.SetVisibility(vis);
            if (isAlive(vSp)) vSp.SetVisibility(vis);
        } catch (_) {}
    }

    wireGridNavigation(v4);
}

function initExtraAccessorySlots(v4, bp) {
    if (!isAlive(v4) || !isAlive(bp)) return;
    ensureExtraSlotWidgets(v4);

    const desiredExtra = effectiveExtraSlots();
    if (desiredExtra > 0) {
        ensureAssemblyCapacity(bp, VANILLA_SLOTS + desiredExtra);
    }

    const equipAccessories = bp.AssemblyAccessory;
    const accessoryInfos = bp.Accessories;
    const extras = getExtraButtons(v4);

    for (let i = 0; i < desiredExtra && i < extras.length; i++) {
        const btn = extras[i];
        if (!isAlive(btn)) continue;
        const slotIndex = VANILLA_SLOTS + i;
        let accID = "None";
        let accLevel = 0;
        if (equipAccessories && equipAccessories.IsValidIndex(slotIndex)) {
            const raw = equipAccessories.Get(slotIndex);
            if (!isEmptyItemId(raw)) accID = raw;
        }
        if (accessoryInfos && !isEmptyItemId(accID)) {
            const info = accessoryInfos.Get(accID);
            if (info !== undefined && info !== null) accLevel = info.CurrentLevel;
        }
        try {
            btn.InitAccessory(accID, accLevel, false, false, v4.UIGameplayLogicComponent, false);
        } catch (e) {
            log("Extra slot #" + slotIndex + " InitAccessory error: " + String(e));
        }
    }
}

// ============================================================================
// Prototype Patching on WB_Character_V4
// ============================================================================

function patchCharacterV4Prototype(v4Instance) {
    if (v4ProtoPatched) return true;
    const proto = Object.getPrototypeOf(v4Instance);
    if (!proto || typeof proto.InitAccessory !== "function" || typeof proto.getAccessoryIndexFromButton !== "function") {
        return false;
    }

    origMethods = {
        getAccessoryIndexFromButton: proto.getAccessoryIndexFromButton,
        InitAccessory: proto.InitAccessory,
        ReplaceAccessory: proto.ReplaceAccessory,
        RemoveItem: proto.RemoveItem,
        initButtonDelegate: proto.initButtonDelegate,
        unbindButtonDelegate: proto.unbindButtonDelegate,
    };

    proto.getAccessoryIndexFromButton = function (button) {
        if (button && typeof button.__pbzAccessorySlotIndex === "number") {
            return button.__pbzAccessorySlotIndex;
        }
        const extras = getExtraButtons(this);
        for (let i = 0; i < extras.length; i++) {
            if (button === extras[i]) return VANILLA_SLOTS + i;
        }
        return origMethods.getAccessoryIndexFromButton.call(this, button);
    };

    proto.InitAccessory = function (backpackSubsystem) {
        activeV4Widgets.add(this);
        const ret = origMethods.InitAccessory.call(this, backpackSubsystem);
        try {
            initExtraAccessorySlots(this, backpackSubsystem);
        } catch (e) {
            log("Patched InitAccessory error: " + String(e));
        }
        flushLog();
        return ret;
    };

    proto.ReplaceAccessory = function () {
        if (!this.IsSecondStep()) return;
        const Button = this.W_SystemPanel_V1 && this.W_SystemPanel_V1.ButtonGroup
            ? this.W_SystemPanel_V1.ButtonGroup.GetSelectedButtonBase()
            : null;
        if (!Button) return;
        if (this.isLoadoutLockedByStory()) {
            this.pushTips("UI_Character_72");
            return;
        }
        const isEquip = this.isButtonEquipItem(Button);
        if (isEquip) {
            this.pushTips("UI_Character_36");
            return;
        }

        const newAccessory = this.getItemFromButton(Button);
        const backPackSubsystem = getBackPackSubsystem(this);
        if (!isAlive(backPackSubsystem)) return;

        const accessoryButton = this.ButtonGroup.GetSelectedButtonBase();
        const index = this.getAccessoryIndexFromButton(accessoryButton);
        if (index < 0) return;

        if (!config.uncapSameType) {
            const UIHelper = getUIHelper();
            const newAccData = UE.PBZBackPackSubsystem.GetAccessoryData(newAccessory);
            if (newAccData && UIHelper && typeof UIHelper.getEquippedAccessoryCountByType === "function") {
                const sameTypeCount = UIHelper.getEquippedAccessoryCountByType(backPackSubsystem, newAccData.AccessoryType, index);
                if (sameTypeCount >= 3) {
                    this.pushTips("UI_Character_65");
                    return;
                }
            }
        }

        if (index >= VANILLA_SLOTS) {
            const ok = equipIntoExtraSlot(backPackSubsystem, newAccessory, index, false);
            if (ok) {
                this.playAccessoryEquipPresentation();
            }
            this.InitAccessory(backPackSubsystem);
            flushLog();
            this.navigateBack();
            return;
        }

        // Vanilla slot (0..5)
        backPackSubsystem.AssembleAccessory(newAccessory, index);
        const equippedAccessory = backPackSubsystem.AssemblyAccessory.IsValidIndex(index)
            ? backPackSubsystem.AssemblyAccessory.Get(index).toString()
            : "";
        if (equippedAccessory == newAccessory) {
            this.playAccessoryEquipPresentation();
        }
        this.navigateBack();
    };

    proto.RemoveItem = function () {
        if (!this.IsSecondStep() && this.ButtonGroup) {
            const selected = this.ButtonGroup.GetSelectedButtonBase();
            const idx = this.getAccessoryIndexFromButton(selected);
            if (idx >= VANILLA_SLOTS) {
                const UIHelper = getUIHelper();
                if (UIHelper && UIHelper.isInCombat(this)) {
                    this.pushTips("UI_Character_67");
                    return;
                }
                if (this.isLoadoutLockedByStory()) {
                    this.pushTips("UI_Character_72");
                    return;
                }
                const bp = getBackPackSubsystem(this);
                if (isAlive(bp) && bp.AssemblyAccessory && bp.AssemblyAccessory.IsValidIndex(idx)) {
                    const item = String(bp.AssemblyAccessory.Get(idx));
                    if (!isEmptyItemId(item)) {
                        if (takeOffExtraSlot(bp, idx, false)) {
                            this.playRemoveItemSound();
                            this.InitAccessory(bp);
                            this.OnSelectedAccessory(selected, true);
                        }
                        flushLog();
                    }
                }
                return;
            }
        }
        return origMethods.RemoveItem.call(this);
    };

    proto.initButtonDelegate = function () {
        const ret = origMethods.initButtonDelegate.call(this);
        try { bindExtraSlotDelegates(this); } catch (_) {}
        return ret;
    };

    proto.unbindButtonDelegate = function () {
        try { clearExtraSlotDelegates(this); } catch (_) {}
        return origMethods.unbindButtonDelegate.call(this);
    };

    v4ProtoPatched = true;
    log("Patched WB_Character_V4 prototype successfully.");
    return true;
}

function unpatchCharacterV4Prototype() {
    if (!v4ProtoPatched || !origMethods) return;
    for (const v4 of activeV4Widgets) {
        if (!isAlive(v4)) continue;
        const proto = Object.getPrototypeOf(v4);
        if (proto) {
            proto.getAccessoryIndexFromButton = origMethods.getAccessoryIndexFromButton;
            proto.InitAccessory = origMethods.InitAccessory;
            proto.ReplaceAccessory = origMethods.ReplaceAccessory;
            proto.RemoveItem = origMethods.RemoveItem;
            proto.initButtonDelegate = origMethods.initButtonDelegate;
            proto.unbindButtonDelegate = origMethods.unbindButtonDelegate;
            break;
        }
    }
    v4ProtoPatched = false;
    origMethods = null;
}

function refreshAllActiveV4() {
    const bp = getBackPackSubsystem(getGameInstance());
    for (const v4 of Array.from(activeV4Widgets)) {
        if (!isAlive(v4)) {
            activeV4Widgets.delete(v4);
            continue;
        }
        try {
            if (isAlive(bp)) {
                v4.InitAccessory(bp);
            } else {
                ensureExtraSlotWidgets(v4);
            }
        } catch (e) {
            log("refreshAllActiveV4 error: " + String(e));
        }
    }
}

function applySlotCountChange(reason) {
    const total = effectiveTotalSlots();
    const bp = getBackPackSubsystem(getGameInstance());
    if (isAlive(bp)) {
        const removed = unequipOverflowSlots(bp, total);
        if (total > VANILLA_SLOTS) {
            ensureAssemblyCapacity(bp, total);
        }
        if (removed > 0) {
            log("Slot change (" + reason + "): auto-unequipped " + removed + " accessory(ies) above slot #" + (total - 1));
        }
    }
    refreshAllActiveV4();
    flushLog();
}

// ============================================================================
// Widget & Loadout Poll
// ============================================================================

function pollForCharacterWidget() {
    if (stopped) return;
    const gi = getGameInstance();
    if (!gi) return;

    try {
        const bp = getBackPackSubsystem(gi);
        if (isAlive(bp)) {
            restoreExtraLoadoutIfNeeded(bp);
            reapplyAllExtraSlotEffects(bp);
        }
    } catch (_) {}

    if (!UE.WidgetBlueprintLibrary || !UE.UserWidget) return;
    try {
        const r = puerts.$ref(UE.NewArray(UE.UserWidget));
        UE.WidgetBlueprintLibrary.GetAllWidgetsOfClass(gi, r, UE.UserWidget.StaticClass(), false);
        const arr = puerts.$unref(r);
        if (!arr || typeof arr.Num !== "function") return;
        const n = arr.Num();
        for (let i = 0; i < n; i++) {
            const w = arr.Get(i);
            if (!isAlive(w)) continue;
            const cls = w.GetClass();
            if (!isAlive(cls)) continue;
            const cpath = String(UE.KismetSystemLibrary.GetPathName(cls));
            if (cpath.includes("WB_Character_V4")) {
                const newlyPatched = !v4ProtoPatched && patchCharacterV4Prototype(w);
                const newlyTracked = !activeV4Widgets.has(w);
                activeV4Widgets.add(w);
                if (newlyPatched || newlyTracked) {
                    const bp = getBackPackSubsystem(w);
                    if (isAlive(bp)) {
                        w.InitAccessory(bp);
                    } else {
                        ensureExtraSlotWidgets(w);
                    }
                    flushLog();
                }
            }
        }
    } catch (_) {}
}

// ============================================================================
// Settings Persistence + PBZModsMenu Registration
// ============================================================================

function applySetting(name, value, triggerRefresh) {
    if (!Object.prototype.hasOwnProperty.call(defaults, name)) return;
    const orig = defaults[name];
    const text = String(value).trim();
    let parsed = orig;
    if (typeof orig === "boolean") {
        parsed = /^(on|true|1|yes)$/i.test(text) ? true : /^(off|false|0|no)$/i.test(text) ? false : orig;
    } else if (name === "extraSlots") {
        const num = Number(text);
        if (text !== "" && Number.isFinite(num)) {
            parsed = Math.max(0, Math.min(MAX_EXTRA_SLOTS, Math.round(num)));
        }
    }
    const changed = config[name] !== parsed;
    config[name] = parsed;
    if (changed && triggerRefresh) {
        log("Setting changed: " + name + " = " + String(parsed));
        if (name === "enabled" || name === "extraSlots") {
            applySlotCountChange(name + "=" + String(parsed));
        }
        flushLog();
    }
}

function readSettings(triggerRefresh) {
    if (!UE.KismetSystemLibrary || !UE.BlueprintPathsLibrary || !UE.EasyCsv) return;
    if (!settingsPath) {
        const dir = UE.KismetSystemLibrary.GetProjectContentDirectory();
        settingsPath = UE.KismetSystemLibrary.ConvertToAbsolutePath(
            dir + (/[\\/]$/.test(dir) ? "" : "/") + "Paks/~mods/" + SETTINGS_FILE
        );
    }
    if (!UE.BlueprintPathsLibrary.FileExists(settingsPath)) {
        if (!settingsCreated) {
            settingsCreated = true;
            const lines = [
                "; PBZExtraAccessorySlots settings. Managed by PBZModsMenu.",
                "enabled=" + (defaults.enabled ? "On" : "Off"),
                "extraSlots=" + String(defaults.extraSlots),
                "uncapSameType=" + (defaults.uncapSameType ? "On" : "Off"),
            ];
            UE.EasyCsv.SaveStringToFileWithFullPath(lines.join("\r\n") + "\r\n", settingsPath);
        }
        return;
    }
    const out = puerts.$ref("");
    if (!UE.EasyCsv.LoadStringFromLocalFile(settingsPath, out)) return;
    const text = String(puerts.$unref(out));
    for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z0-9_]+)\s*=\s*([^;#]*?)(?:\s*[;#].*)?$/.exec(line);
        if (m) applySetting(m[1], m[2], triggerRefresh);
    }
}

function registerMenu() {
    const label = (en, zh) => ({ en, "zh-Hans": zh, "zh-Hant": zh });
    const menu = globalThis.PBZModsMenu || (globalThis.PBZModsMenu = []);
    menu.push({
        id: MOD_ID,
        title: label("Extra Accessory Slots", "额外饰品栏位"),
        description: label(
            "Adds 0-12 extra unlocked accessory slots after the 6 vanilla slots without altering vanilla unlock progress.",
            "在原版 6 个饰品栏位之后追加 0~12 个已解锁栏位，保留原版栏位解锁状态，调小栏位时自动安全卸下回背包。"
        ),
        version: VERSION,
        file: SETTINGS_FILE,
        settings: [
            {
                key: "enabled",
                type: "toggle",
                label: label("Enable mod", "启用本模组"),
                default: defaults.enabled,
                help: "Off safely unequips all extra slots back to inventory / 关闭时自动将额外栏位饰品安全卸下回背包",
            },
            {
                key: "extraSlots",
                type: "number",
                label: label("Extra accessory slots", "额外饰品栏位数量"),
                min: 0,
                max: MAX_EXTRA_SLOTS,
                step: 1,
                default: defaults.extraSlots,
                help: "0-12 extra unlocked slots appended after vanilla slots 1-6 / 在原版 1~6 格之后追加 0~12 个已解锁栏位",
            },
            {
                key: "uncapSameType",
                type: "toggle",
                label: label("Uncap same-type accessory limit", "解除同类饰品最多 3 个限制"),
                default: defaults.uncapSameType,
                help: "Default Off. Allows equipping more than 3 accessories of the same category / 默认关闭，开启后可装备超过 3 个同类饰品",
            },
        ],
        onChange: (key, value) => {
            if (!stopped) applySetting(key, value, true);
        },
    });
}

function stop() {
    stopped = true;
    if (pollTimer !== undefined) {
        clearInterval(pollTimer);
        pollTimer = undefined;
    }
    if (settingsTimer !== undefined) {
        clearInterval(settingsTimer);
        settingsTimer = undefined;
    }
    for (const idx of Array.from(appliedExtraHandles.keys())) {
        clearAppliedExtraSlotEffects(idx);
    }
    unpatchCharacterV4Prototype();
    activeV4Widgets.clear();
    flushLog();
    exports.ready = false;
}

exports.stop = stop;
exports.ready = false;

try {
    log("=== " + MOD_ID + " " + VERSION + " starting ===");
    readSettings(false);
    registerMenu();
    pollForCharacterWidget();
    pollTimer = setInterval(pollForCharacterWidget, 500);
    settingsTimer = setInterval(() => {
        if (!stopped) {
            try { readSettings(true); } catch (_) {}
        }
    }, 2000);
    exports.ready = true;
    log("=== " + MOD_ID + " ready (enabled=" + config.enabled + ", extraSlots=" + config.extraSlots + ", uncapSameType=" + config.uncapSameType + ") ===");
    flushLog();
} catch (e) {
    log("Startup failed: " + String(e));
    flushLog();
    stop();
    throw e;
}
