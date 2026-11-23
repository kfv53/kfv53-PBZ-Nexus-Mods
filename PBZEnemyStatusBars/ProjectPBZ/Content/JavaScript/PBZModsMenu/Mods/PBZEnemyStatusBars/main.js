"use strict";

// PBZEnemyStatusBars v1.0.0
// Displays circular Bleed (出血), Poison (中毒), and Burn/Ignite (燃烧) buildup gauges
// and active DoT countdown rings under Enemy and Boss HP bars.
// - Buildup mode: radial ring fills up (0 -> 1) as accumulation grows.
// - DoT mode (Poison & Ignite): radial ring empties (1 -> 0) as remaining DoT time counts down.
// - Integrates with PBZModsMenu (separate toggles for Enemy HP bar & Boss HP bar, per-status toggles, ring sizes).

const UE = require("ue");
const puerts = require("puerts");

const MOD_ID = "PBZEnemyStatusBars";
const VERSION = "1.3.3";
const SETTINGS_FILE = "PBZEnemyStatusBars.txt";
const LOG_FILE = "PBZEnemyStatusBars.log";

const DISCOVERY_INTERVAL_MS = 800;
const TICK_INTERVAL_MS = 66;
const GE_QUERY_CACHE_MS = 250;
const SETTINGS_POLL_MS = 2000;
const DEFAULT_ACCUM_MAX = 100.0;
const ACCUM_EPSILON = 0.05;

// Never treat resistance / cooldown / immunity / helper GEs as active DoT timers!
const EXCLUDE_GE_KEYWORDS = [
    "resistance",
    "cooldown",
    "immune",
    "hasaccumulation",
    "decrement",
];

const GAUGE_PARAM_CD_RATIO = "CD_Ratio";
const GAUGE_PARAM_COLOR_FG = "Color_FG";

const defaults = {
    enabled: true,
    useGameIcons: true,
    showEnemyBar: true,
    enemyBarAbove: true,
    showBossBar: true,
    showBleed: true,
    showPoison: true,
    showIgnite: true,
    showFrost: true,
    showElectrified: true,
    showWater: true,
    showChaos: true,
    enemyIconSize: 26,
    bossIconSize: 34,
};

const config = { ...defaults };

const STATUS_DEFS = [
    {
        id: "bleed",
        settingKey: "showBleed",
        attrNames: ["Bleed_Accumulation", "BloodBurst_Accumulation"],
        dotTagNames: [],
        geKeywords: ["bleed", "bloodburst"],
        glyph: "血",
        buildupColor: { R: 0.90, G: 0.14, B: 0.18, A: 0.96 },
        dotColor: { R: 1.00, G: 0.28, B: 0.30, A: 1.00 },
        glyphColor: { R: 1.00, G: 0.84, B: 0.84, A: 0.98 },
    },
    {
        id: "poison",
        settingKey: "showPoison",
        attrNames: ["Poison_Accumulation"],
        dotTagNames: ["CharacterState.StatusInfliction.Poison"],
        geKeywords: ["poison", "toxin"],
        useAccumForDot: true, // Multi-phase poison: active while Poison tag is present
        glyph: "毒",
        buildupColor: { R: 0.56, G: 0.94, B: 0.42, A: 0.98 },
        dotColor: { R: 0.18, G: 0.96, B: 0.32, A: 1.00 },
        glyphColor: { R: 0.84, G: 1.00, B: 0.86, A: 0.98 },
        phaseStyles: [
            {
                glyph: "毒1",
                ringColor: { R: 0.58, G: 0.94, B: 0.44, A: 0.98 }, // 1阶：嫩绿
                glyphColor: { R: 0.90, G: 1.00, B: 0.86, A: 0.98 },
            },
            {
                glyph: "毒2",
                ringColor: { R: 0.16, G: 0.96, B: 0.32, A: 1.00 }, // 2阶：毒绿
                glyphColor: { R: 0.80, G: 1.00, B: 0.84, A: 1.00 },
            },
            {
                glyph: "毒3",
                ringColor: { R: 0.58, G: 0.24, B: 0.94, A: 1.00 }, // 3阶：剧毒紫环 + 毒绿字
                glyphColor: { R: 0.56, G: 1.00, B: 0.66, A: 1.00 },
            },
        ],
    },
    {
        id: "ignite",
        settingKey: "showIgnite",
        attrNames: ["Ignite_Accumulation"],
        dotTagNames: ["CharacterState.StatusInfliction.Ignite", "CharacterState.StatusInfliction.GreenFire"],
        geKeywords: ["ignite", "burn", "fire"],
        glyph: "燃",
        buildupColor: { R: 1.00, G: 0.46, B: 0.08, A: 0.96 },
        dotColor: { R: 1.00, G: 0.72, B: 0.18, A: 1.00 },
        glyphColor: { R: 1.00, G: 0.92, B: 0.80, A: 0.98 },
    },
    {
        id: "frost",
        settingKey: "showFrost",
        attrNames: ["Frost_Accumulation"],
        dotTagNames: ["CharacterState.StatusInfliction.Frost", "CharacterState.StatusInfliction.Frost.Effect"],
        geKeywords: ["frost", "ice", "freeze"],
        glyph: "冰",
        buildupColor: { R: 0.28, G: 0.80, B: 1.00, A: 0.96 },
        dotColor: { R: 0.58, G: 0.94, B: 1.00, A: 1.00 },
        glyphColor: { R: 0.88, G: 0.98, B: 1.00, A: 0.98 },
    },
    {
        id: "electrified",
        settingKey: "showElectrified",
        attrNames: ["Electrified_Accumulation"], // Track Electrified_Accumulation cleanly (avoid jumping with Thunder_Accumulation)
        dotTagNames: ["CharacterState.StatusInfliction.Electrified"],
        geKeywords: ["electrified"],
        glyph: "雷",
        buildupColor: { R: 0.96, G: 0.84, B: 0.18, A: 0.96 },
        dotColor: { R: 1.00, G: 0.96, B: 0.45, A: 1.00 },
        glyphColor: { R: 1.00, G: 0.98, B: 0.82, A: 0.98 },
    },
    {
        id: "water",
        settingKey: "showWater",
        attrNames: ["Water_Accumulation"],
        dotTagNames: ["CharacterState.StatusInfliction.Water"],
        geKeywords: ["water", "aqua"],
        glyph: "水",
        buildupColor: { R: 0.18, G: 0.50, B: 1.00, A: 0.96 },
        dotColor: { R: 0.40, G: 0.72, B: 1.00, A: 1.00 },
        glyphColor: { R: 0.84, G: 0.92, B: 1.00, A: 0.98 },
    },
    {
        id: "chaos",
        settingKey: "showChaos",
        attrNames: ["Chaos_Accumulation"],
        dotTagNames: ["CharacterState.StatusInfliction.Chaos"],
        geKeywords: ["chaos"],
        glyph: "混",
        buildupColor: { R: 0.72, G: 0.28, B: 0.96, A: 0.96 },
        dotColor: { R: 0.88, G: 0.48, B: 1.00, A: 1.00 },
        glyphColor: { R: 0.95, G: 0.86, B: 1.00, A: 0.98 },
    },
];

let stopped = false;
let discoveryTimer = undefined;
let tickTimer = undefined;
let settingsTimer = undefined;

let settingsPath = "";
let settingsCreated = false;
let logPath = "";
const logLines = [];
let flushedCount = 0;

// Cached native GAS attributes & tags
let staticsReady = false;
const statusAttrs = {};         // id -> FGameplayAttribute[]
let inflictionMaxAttr = null;   // Infliction_Max
let healthAttr = null;
let healthMaxAttr = null;
const statusDotTags = {};       // id -> FGameplayTag[]
const statusDotContainers = {}; // id -> FGameplayTagContainer[]
let emptyTagContainer = null;
let bossTag = null;
let combatTag = null;
let deadTag = null;

// Cached radial circle material (MI_UI_CdBar_Debuff_001 / MI_UI_CdBar_001) & native debuff icon textures
let cachedCircleMaterial = null;
let circleMatSearchLogged = false;
let debuffIconsLoaded = false;
let debuffTableScanAttempts = 0;
const cachedStatusTextures = {}; // statusId (or "poison_0"/"poison_1"/"poison_2") -> UTexture2D
const pendingTexturePaths = {};  // key -> path string already requested
let enemyLayoutLogged = false;
let bossLayoutLogged = false;
let firstStatusObservedLogged = false;
let damagedActorDiagCount = 0;
const dotDiagCounts = {};
const lastDotDiagTimeMs = {};

// Dynamic max accumulation observed per status (defaults to 100; adapts if game uses >100)
const observedMaxAccum = {
    bleed: DEFAULT_ACCUM_MAX,
    poison: DEFAULT_ACCUM_MAX,
    ignite: DEFAULT_ACCUM_MAX,
};

// Tracked attachments keyed by widget path string
// Map<string, AttachmentRecord>
const attachments = new Map();

// ============================================================================
// Logging & Core Utilities
// ============================================================================

function isAlive(obj) {
    if (!obj) return false;
    try {
        return UE.KismetSystemLibrary.IsValid(obj);
    } catch (_) {
        return false;
    }
}

function getPathSafe(obj) {
    if (!isAlive(obj)) return "";
    try {
        return String(UE.KismetSystemLibrary.GetPathName(obj));
    } catch (_) {
        return "";
    }
}

function getClassPathSafe(obj) {
    if (!isAlive(obj)) return "";
    try {
        const cls = obj.GetClass();
        return isAlive(cls) ? String(UE.KismetSystemLibrary.GetPathName(cls)) : "";
    } catch (_) {
        return "";
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

function getGameInstance() {
    try {
        const gi = puerts.argv && puerts.argv.getByName ? puerts.argv.getByName("GameInstance") : null;
        return isAlive(gi) ? gi : null;
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

function getWorldContext() {
    const pc = getPlayerController();
    if (isAlive(pc)) return pc;
    return getGameInstance();
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
    if (logLines.length > 600) logLines.shift();
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

function clamp01(v) {
    if (!Number.isFinite(v) || v <= 0) return 0;
    if (v >= 1) return 1;
    return v;
}

function makeLinearColor(c) {
    return new UE.LinearColor(c.R, c.G, c.B, c.A);
}

function makeSlateColor(c) {
    const sc = new UE.SlateColor();
    sc.SpecifiedColor = makeLinearColor(c);
    return sc;
}

function toFText(str) {
    try {
        if (UE.KismetTextLibrary && typeof UE.KismetTextLibrary.Conv_StringToText === "function") {
            return UE.KismetTextLibrary.Conv_StringToText(String(str));
        }
    } catch (_) {}
    return String(str);
}

function applyLabelFont(label, iconSize, isTwoChar) {
    try {
        const baseFont = label.Font;
        if (!baseFont) return;
        const scale = isTwoChar ? 0.34 : 0.42;
        baseFont.Size = Math.max(8, Math.round(iconSize * scale));
        label.SetFont(baseFont);
    } catch (_) {}
}

function constructTag(tagName) {
    const TH = getTsHelper();
    if (TH && typeof TH.constructGameplayTag === "function") {
        try {
            return TH.constructGameplayTag(tagName);
        } catch (_) {}
    }
    const t = new UE.GameplayTag();
    t.TagName = tagName;
    return t;
}

// ============================================================================
// GAS Attribute & Tag Statics
// ============================================================================

function ensureGASStatics() {
    if (staticsReady) return true;
    try {
        if (!UE.PBZBlueprintFunctionLibrary || !UE.BasicAttributeSet) return false;
        const basicAttrClass = UE.BasicAttributeSet.StaticClass();
        if (!basicAttrClass) return false;

        for (const def of STATUS_DEFS) {
            statusAttrs[def.id] = [];
            for (const attrName of def.attrNames) {
                try {
                    const attr = UE.PBZBlueprintFunctionLibrary.MakeAttribute(attrName, basicAttrClass);
                    if (attr) statusAttrs[def.id].push(attr);
                } catch (_) {}
            }
            statusDotTags[def.id] = [];
            statusDotContainers[def.id] = [];
            for (const tagName of def.dotTagNames) {
                try {
                    const tag = constructTag(tagName);
                    statusDotTags[def.id].push(tag);
                    if (UE.BlueprintGameplayTagLibrary && typeof UE.BlueprintGameplayTagLibrary.MakeGameplayTagContainerFromTag === "function") {
                        statusDotContainers[def.id].push(UE.BlueprintGameplayTagLibrary.MakeGameplayTagContainerFromTag(tag));
                    }
                } catch (_) {}
            }
        }
        inflictionMaxAttr = UE.PBZBlueprintFunctionLibrary.MakeAttribute("Infliction_Max", basicAttrClass);
        healthAttr = UE.PBZBlueprintFunctionLibrary.MakeAttribute("Health", basicAttrClass);
        healthMaxAttr = UE.PBZBlueprintFunctionLibrary.MakeAttribute("Health_Max", basicAttrClass);
        emptyTagContainer = new UE.GameplayTagContainer();
        bossTag = constructTag("CharacterType.AI.Boss");
        combatTag = constructTag("AI.State.Combat");
        deadTag = constructTag("CharacterState.Dead");
        staticsReady = true;
        log("GAS statics initialized (All 7 statuses + Infliction_Max)");
        flushLog();
        return true;
    } catch (e) {
        log("ensureGASStatics error: " + String(e));
        return false;
    }
}

// ============================================================================
// Native Circular Radial Material Discovery (MI_UI_CdBar)
// ============================================================================

function extractMaterialFromBuffIcon(iconWidget) {
    if (!isAlive(iconWidget)) return null;
    try {
        const circle = iconWidget.Circle;
        if (!isAlive(circle)) return null;
        if (circle.Brush && isAlive(circle.Brush.ResourceObject)) {
            const res = circle.Brush.ResourceObject;
            // Only unwrap MaterialInstanceDynamic -> Parent; keep MaterialInstanceConstant (MI_UI_CdBar_Debuff_001) intact!
            const cpath = getClassPathSafe(res);
            if (cpath.includes("MaterialInstanceDynamic") && res.Parent && isAlive(res.Parent)) {
                return res.Parent;
            }
            return res;
        }
        const mid = typeof circle.GetDynamicMaterial === "function" ? circle.GetDynamicMaterial() : null;
        if (isAlive(mid)) {
            if (mid.Parent && isAlive(mid.Parent)) return mid.Parent;
            return mid;
        }
    } catch (_) {}
    return null;
}

function tryAcquireCircleMaterial(allWidgets) {
    if (isAlive(cachedCircleMaterial)) return cachedCircleMaterial;

    // 1. Inspect live W_BuffBar / W_BuffIcon widgets in the HUD
    if (allWidgets) {
        const n = allWidgets.Num();
        for (let i = 0; i < n; i++) {
            const w = allWidgets.Get(i);
            if (!isAlive(w)) continue;
            const cpath = getClassPathSafe(w);

            // Direct W_BuffIcon instance
            if (cpath.includes("BuffIcon") || (w.Circle && w.Icon)) {
                const mat = extractMaterialFromBuffIcon(w);
                if (isAlive(mat)) {
                    cachedCircleMaterial = mat;
                    log("Acquired radial ring material from live BuffIcon: " + getPathSafe(mat));
                    flushLog();
                    return cachedCircleMaterial;
                }
            }

            // W_BuffBar -> DeBuffEntryBox / BuffEntryBox -> existing entry or EntryWidgetClass
            if (cpath.includes("BuffBar") || w.DeBuffEntryBox || w.BuffEntryBox) {
                const boxes = [w.DeBuffEntryBox, w.BuffEntryBox];
                for (const box of boxes) {
                    if (!isAlive(box)) continue;
                    // Check already pooled/active entries
                    try {
                        const entries = box.GetAllEntries();
                        if (entries && entries.Num() > 0) {
                            const mat = extractMaterialFromBuffIcon(entries.Get(0));
                            if (isAlive(mat)) {
                                cachedCircleMaterial = mat;
                                log("Acquired radial ring material from BuffBar entry: " + getPathSafe(mat));
                                flushLog();
                                return cachedCircleMaterial;
                            }
                        }
                    } catch (_) {}

                    // Spawn a temporary W_BuffIcon from EntryWidgetClass just to read its Circle brush material
                    try {
                        const entryCls = box.EntryWidgetClass;
                        if (isAlive(entryCls)) {
                            const pc = getPlayerController();
                            const tempIcon = UE.WidgetBlueprintLibrary.Create(w, entryCls, pc);
                            if (isAlive(tempIcon)) {
                                const mat = extractMaterialFromBuffIcon(tempIcon);
                                if (isAlive(mat)) {
                                    cachedCircleMaterial = mat;
                                    log("Acquired radial ring material from temp BuffIcon (" + getPathSafe(entryCls) + "): " + getPathSafe(mat));
                                    flushLog();
                                    return cachedCircleMaterial;
                                }
                            }
                        }
                    } catch (e) {
                        if (!circleMatSearchLogged) {
                            log("Temp BuffIcon probe err: " + String(e));
                        }
                    }
                }
            }
        }
    }

    if (!circleMatSearchLogged) {
        circleMatSearchLogged = true;
        log("Radial ring material not yet found; will retry as HUD constructs (using ProgressBar fallback until ready)");
        flushLog();
    }
    return null;
}

// ============================================================================
// Native Debuff Icon Discovery from DT_BuffStatus (via Player's BuffTracker GA)
// ============================================================================

function findBuffStatusRowsFromPlayer() {
    const pc = getPlayerController();
    const pawn = isAlive(pc) ? pc.K2_GetPawn() : null;
    if (!isAlive(pawn)) return null;

    let asc = null;
    try {
        asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(pawn);
    } catch (_) {
        asc = null;
    }
    if (!isAlive(asc)) return null;

    const TH = getTsHelper();
    let buffTable = null;
    let btRows = null;
    let btChargeRows = null;

    // Inspect player's activatable abilities to find GA_Player_BuffTracker (which holds btRows, btChargeRows & BuffStatusTable)
    try {
        const specs = asc.ActivatableAbilities && asc.ActivatableAbilities.Items;
        if (specs && typeof specs.Num === "function") {
            const count = specs.Num();
            for (let i = 0; i < count; i++) {
                const spec = specs.Get(i);
                if (!spec) continue;
                const candidates = [];
                if (isAlive(spec.Ability)) candidates.push(spec.Ability);
                try {
                    if (spec.NonReplicatedInstances && typeof spec.NonReplicatedInstances.Num === "function") {
                        for (let j = 0; j < spec.NonReplicatedInstances.Num(); j++) {
                            const inst = spec.NonReplicatedInstances.Get(j);
                            if (isAlive(inst)) candidates.push(inst);
                        }
                    }
                } catch (_) {}
                for (const ab of candidates) {
                    if (ab.btRows && Array.isArray(ab.btRows) && ab.btRows.length > 0) {
                        btRows = ab.btRows;
                        if (ab.btChargeRows) btChargeRows = ab.btChargeRows;
                        break;
                    }
                    if (isAlive(ab.BuffStatusTable)) {
                        buffTable = ab.BuffStatusTable;
                    }
                }
                if (btRows) break;
            }
        }
    } catch (_) {}

    if (btRows) {
        const merged = btRows.map((r) => ({
            isDebuff: !!r.isDebuff,
            classPath: String(r.classPathNorm || "").toLowerCase(),
            chargeId: String(r.chargeId || "").toLowerCase(),
            iconPath: String(r.iconPath || ""),
        }));
        if (btChargeRows && typeof btChargeRows.values === "function") {
            for (const r of btChargeRows.values()) {
                merged.push({
                    isDebuff: !!r.isDebuff,
                    classPath: String(r.classPathNorm || "").toLowerCase(),
                    chargeId: String(r.chargeId || "").toLowerCase(),
                    iconPath: String(r.iconPath || ""),
                });
            }
        }
        return merged;
    }

    // Fallback: read DT_BuffStatus DataTable directly if found on BuffTracker CDO or via common asset paths
    if (!isAlive(buffTable)) {
        const dtPaths = [
            "/Game/PBZContent/DataTable/DT_BuffStatus.DT_BuffStatus",
            "/Game/PBZContent/UI/DataTable/DT_BuffStatus.DT_BuffStatus",
            "/PBZCombatAsset/DataTable/DT_BuffStatus.DT_BuffStatus",
        ];
        for (const p of dtPaths) {
            try {
                const loaded = UE.DataTable.Load(p);
                if (isAlive(loaded)) {
                    buffTable = loaded;
                    break;
                }
            } catch (_) {}
        }
    }

    if (isAlive(buffTable) && TH && typeof TH.GetDatatableAllRows === "function" && UE.PBZBuffStatusRow) {
        try {
            const rows = TH.GetDatatableAllRows(buffTable, UE.PBZBuffStatusRow.StaticStruct());
            const result = [];
            for (const row of rows) {
                const clsStr = String(UE.KismetSystemLibrary.Conv_SoftClassReferenceToString(row.GameplayEffectClass) || "").toLowerCase();
                const iconStr = String(UE.KismetSystemLibrary.Conv_SoftObjectReferenceToString(row.Icon) || "");
                const chargeStr = row.ChargeID ? String(row.ChargeID).toLowerCase() : "";
                result.push({
                    isDebuff: !!row.bIsDebuff,
                    classPath: clsStr,
                    chargeId: chargeStr === "none" ? "" : chargeStr,
                    iconPath: iconStr,
                });
            }
            return result;
        } catch (e) {
            log("Read DT_BuffStatus error: " + String(e));
        }
    }

    return null;
}

function scoreDebuffRowMatch(row, def, phaseNumber) {
    if (!row || !row.iconPath || row.iconPath === "None") return -1;
    const hay = row.classPath + " " + row.chargeId + " " + row.iconPath.toLowerCase();
    // Skip non-status / accessory / resistance / player-buff rows
    if (hay.includes("resistance") || hay.includes("accessory") || hay.includes("xieshan") || hay.includes("cooldown")) {
        return -1;
    }

    let matchedKw = false;
    for (const kw of def.geKeywords) {
        if (hay.includes(kw)) {
            matchedKw = true;
            break;
        }
    }
    if (!matchedKw) return -1;

    let score = row.isDebuff ? 100 : 10;
    if (hay.includes("statusinfliction") || hay.includes("debuff")) score += 30;
    if (phaseNumber > 0) {
        if (hay.includes("phase" + phaseNumber) || hay.includes("lv" + phaseNumber) || hay.includes("_" + phaseNumber)) {
            score += 50;
        }
    }
    return score;
}

function exportIconTextureOnce(cacheKey, tex, worldCtx) {
    if (!isAlive(tex) || !isAlive(worldCtx) || !UE.KismetRenderingLibrary) return;
    try {
        const savedDir = UE.KismetSystemLibrary.GetProjectSavedDirectory();
        const outDir = UE.KismetSystemLibrary.ConvertToAbsolutePath(
            savedDir.replace(/[\\/]*$/, "/") + "PBZStatusIcons"
        );
        const fileName = cacheKey + ".png";
        const fullPath = outDir + "/" + fileName;
        if (UE.BlueprintPathsLibrary && UE.BlueprintPathsLibrary.FileExists(fullPath)) return;

        // Render via RTF_RGBA8 RenderTarget2D so BC7/DXT compressed textures export cleanly with alpha
        const w = typeof tex.Blueprint_GetSizeX === "function" ? Math.max(64, tex.Blueprint_GetSizeX()) : 128;
        const h = typeof tex.Blueprint_GetSizeY === "function" ? Math.max(64, tex.Blueprint_GetSizeY()) : 128;
        const rt = UE.KismetRenderingLibrary.CreateRenderTarget2D(
            worldCtx,
            w,
            h,
            UE.ETextureRenderTargetFormat.RTF_RGBA8,
            new UE.LinearColor(0, 0, 0, 0),
            false
        );
        if (isAlive(rt)) {
            UE.KismetRenderingLibrary.ClearRenderTarget2D(worldCtx, rt, new UE.LinearColor(0, 0, 0, 0));
            const canvasRef = puerts.$ref(undefined);
            const sizeRef = puerts.$ref(new UE.Vector2D(w, h));
            const ctxRef = puerts.$ref(new UE.DrawToRenderTargetContext());
            UE.KismetRenderingLibrary.BeginDrawCanvasToRenderTarget(worldCtx, rt, canvasRef, sizeRef, ctxRef);
            const canvas = puerts.$unref(canvasRef);
            const ctx = puerts.$unref(ctxRef);
            if (isAlive(canvas)) {
                canvas.K2_DrawTexture(
                    tex,
                    new UE.Vector2D(0, 0),
                    new UE.Vector2D(w, h),
                    new UE.Vector2D(0, 0),
                    new UE.Vector2D(1, 1),
                    new UE.LinearColor(1, 1, 1, 1),
                    UE.EBlendMode.BLEND_Translucent,
                    0,
                    new UE.Vector2D(0.5, 0.5)
                );
            }
            UE.KismetRenderingLibrary.EndDrawCanvasToRenderTarget(worldCtx, ctx);
            UE.KismetRenderingLibrary.ExportRenderTarget(worldCtx, rt, outDir, fileName);
            log("Exported native icon PNG -> " + fullPath + " (" + w + "x" + h + ")");
            flushLog();
        }
    } catch (e) {
        log("exportIconTextureOnce(" + cacheKey + ") err: " + String(e));
        flushLog();
    }
}

function requestIconTextureLoad(cacheKey, iconPath, worldCtx) {
    if (!iconPath || pendingTexturePaths[cacheKey] === iconPath) return;
    pendingTexturePaths[cacheKey] = iconPath;
    try {
        const softPath = UE.KismetSystemLibrary.MakeSoftObjectPath(iconPath);
        if (UE.PBZAssetManager && typeof UE.PBZAssetManager.AsyncLoadObject === "function") {
            UE.PBZAssetManager.AsyncLoadObject(worldCtx, softPath, puerts.toOneShotDelegate((asset) => {
                if (isAlive(asset)) {
                    cachedStatusTextures[cacheKey] = asset;
                    log("Loaded native icon [" + cacheKey + "] -> " + iconPath);
                    exportIconTextureOnce(cacheKey, asset, worldCtx);
                    flushLog();
                }
            }));
            return;
        }
    } catch (_) {}

    // Sync fallback if AsyncLoadObject unavailable
    try {
        const tex = UE.Texture2D.Load(iconPath);
        if (isAlive(tex)) {
            cachedStatusTextures[cacheKey] = tex;
            log("Loaded native icon sync [" + cacheKey + "] -> " + iconPath);
            exportIconTextureOnce(cacheKey, tex, worldCtx);
            flushLog();
        }
    } catch (_) {}
}

function tryAcquireDebuffIcons() {
    if (debuffIconsLoaded || debuffTableScanAttempts >= 30) return;
    const pc = getPlayerController();
    const pawn = isAlive(pc) ? pc.K2_GetPawn() : null;
    // Do NOT count attempts while on the title/loading screen before a live pawn exists!
    if (!isAlive(pawn)) return;

    const worldCtx = getWorldContext();
    if (!isAlive(worldCtx)) return;

    const rows = findBuffStatusRowsFromPlayer();
    if (!rows || rows.length === 0) {
        debuffTableScanAttempts++;
        return;
    }

    debuffIconsLoaded = true;
    const debuffSample = [];
    for (const r of rows) {
        if (r.isDebuff && r.iconPath) {
            debuffSample.push((r.classPath.split(".").pop() || r.chargeId || "?") + "=>" + r.iconPath.split(".").pop());
        }
    }
    log("DT_BuffStatus loaded: total=" + rows.length + ", debuffs=" + debuffSample.length + " [" + debuffSample.slice(0, 15).join(", ") + "]");

    for (const def of STATUS_DEFS) {
        let bestRow = null;
        let bestScore = -1;
        for (const row of rows) {
            const s = scoreDebuffRowMatch(row, def, 0);
            if (s > bestScore) {
                bestScore = s;
                bestRow = row;
            }
        }
        if (bestRow) {
            requestIconTextureLoad(def.id, bestRow.iconPath, worldCtx);
        }

        // For 3-stage Poison, also look for distinct phase 1/2/3 icons
        if (def.phaseStyles) {
            for (let p = 0; p < def.phaseStyles.length; p++) {
                let bestPhaseRow = null;
                let bestPhaseScore = -1;
                for (const row of rows) {
                    const s = scoreDebuffRowMatch(row, def, p + 1);
                    if (s > bestPhaseScore) {
                        bestPhaseScore = s;
                        bestPhaseRow = row;
                    }
                }
                if (bestPhaseRow) {
                    requestIconTextureLoad(def.id + "_" + p, bestPhaseRow.iconPath, worldCtx);
                }
            }
        }
    }

    // One-time probe of missing T_BuffUI_4..13 textures to discover Poison & Electrified native icons
    for (const num of [4, 5, 6, 7, 9, 10, 12, 13]) {
        const p = "/Game/PBZContent/UI/FrontEnd/BuffTexture/T_BuffUI_" + num + ".T_BuffUI_" + num;
        requestIconTextureLoad("probe_T_BuffUI_" + num, p, worldCtx);
    }

    flushLog();
}

function getStatusTexture(defId, phaseIdx) {
    if (phaseIdx >= 0) {
        const phaseTex = cachedStatusTextures[defId + "_" + phaseIdx];
        if (isAlive(phaseTex)) return phaseTex;
    }
    const baseTex = cachedStatusTextures[defId];
    return isAlive(baseTex) ? baseTex : null;
}

// ============================================================================
// Status Data Reading (Accumulation + Active DoT Timing)
// ============================================================================

function isExcludedGEPath(gePathLower) {
    if (!gePathLower) return false;
    for (const bad of EXCLUDE_GE_KEYWORDS) {
        if (gePathLower.includes(bad)) return true;
    }
    return false;
}

function getActiveDotTiming(asc, def, worldCtx, timingCache) {
    // Returns { active: boolean, ratio: number (1 -> 0), remaining: number, duration: number }
    const dotTags = statusDotTags[def.id];
    if (!dotTags || dotTags.length === 0) return { active: false, ratio: 0, remaining: 0, duration: 0 };

    let hasTag = false;
    for (const tag of dotTags) {
        try {
            if (asc.HasMatchingGameplayTag(tag)) {
                hasTag = true;
                break;
            }
        } catch (_) {}
    }
    if (!hasTag) {
        if (timingCache) timingCache[def.id] = null;
        return { active: false, ratio: 0, remaining: 0, duration: 0 };
    }

    // Multi-phase accumulation-driven statuses (e.g. Poison) skip GE duration scanning
    if (def.useAccumForDot) {
        return { active: true, ratio: -1, remaining: 0, duration: 0 };
    }

    let now = 0;
    try {
        now = UE.KismetSystemLibrary.GetGameTimeInSeconds(worldCtx);
    } catch (_) {
        now = 0;
    }

    // Reuse cached GE timing for GE_QUERY_CACHE_MS to minimize Puerts FFI overhead
    const nowMs = Date.now();
    const cached = timingCache ? timingCache[def.id] : null;
    if (cached && (nowMs - cached.fetchedAtMs) < GE_QUERY_CACHE_MS) {
        if (cached.duration > 0 && cached.endTime > 0) {
            const remaining = Math.max(0, cached.endTime - now);
            return {
                active: true,
                ratio: clamp01(remaining / cached.duration),
                remaining,
                duration: cached.duration,
            };
        }
        return { active: true, ratio: -1, remaining: 0, duration: 0 };
    }

    let bestEnd = -1;
    let bestDuration = 0;

    // Strategy 1: Query active GEs granting any of this status's StatusInfliction tags (excluding Resistance/Cooldown GEs!)
    try {
        const containers = statusDotContainers[def.id] || [];
        if (typeof asc.GetActiveEffectsWithAllTags === "function") {
            for (const container of containers) {
                const handles = asc.GetActiveEffectsWithAllTags(container);
                if (handles && handles.Num() > 0) {
                    for (let i = 0; i < handles.Num(); i++) {
                        const h = handles.Get(i);
                        if (!h) continue;
                        const dur = UE.AbilitySystemBlueprintLibrary.GetActiveGameplayEffectTotalDuration(h);
                        if (dur <= 0) continue;
                        const ge = UE.AbilitySystemBlueprintLibrary.GetGameplayEffectFromActiveEffectHandle(h);
                        if (isAlive(ge) && isExcludedGEPath(getClassPathSafe(ge).toLowerCase())) continue;
                        const end = UE.AbilitySystemBlueprintLibrary.GetActiveGameplayEffectExpectedEndTime(h);
                        if (end > bestEnd) {
                            bestEnd = end;
                            bestDuration = dur;
                        }
                    }
                }
            }
        }
    } catch (_) {}

    // Strategy 2: If tag-filtered query found no duration GE, scan all active GEs by class name keyword (excluding Resistance/Cooldown!)
    if (bestDuration <= 0 && emptyTagContainer) {
        try {
            const allHandles = asc.GetActiveEffectsWithAllTags(emptyTagContainer);
            if (allHandles && allHandles.Num() > 0) {
                for (let i = 0; i < allHandles.Num(); i++) {
                    const h = allHandles.Get(i);
                    if (!h) continue;
                    const dur = UE.AbilitySystemBlueprintLibrary.GetActiveGameplayEffectTotalDuration(h);
                    if (dur <= 0) continue;
                    const ge = UE.AbilitySystemBlueprintLibrary.GetGameplayEffectFromActiveEffectHandle(h);
                    if (!isAlive(ge)) continue;
                    const gePath = getClassPathSafe(ge).toLowerCase();
                    if (isExcludedGEPath(gePath)) continue;
                    let matched = false;
                    for (const kw of def.geKeywords) {
                        if (gePath.includes(kw)) {
                            matched = true;
                            break;
                        }
                    }
                    if (matched) {
                        const end = UE.AbilitySystemBlueprintLibrary.GetActiveGameplayEffectExpectedEndTime(h);
                        if (end > bestEnd) {
                            bestEnd = end;
                            bestDuration = dur;
                        }
                    }
                }
            }
        } catch (_) {}
    }

    if (timingCache) {
        timingCache[def.id] = { fetchedAtMs: nowMs, endTime: bestEnd, duration: bestDuration };
    }

    if (bestDuration > 0 && bestEnd > 0) {
        const remaining = Math.max(0, bestEnd - now);
        const ratio = clamp01(remaining / bestDuration);
        return { active: true, ratio, remaining, duration: bestDuration };
    }

    return { active: true, ratio: -1, remaining: 0, duration: 0 };
}

function readActorStatusState(actor, worldCtx, timingCache) {
    if (!isAlive(actor) || !ensureGASStatics()) return null;
    let asc = null;
    try {
        asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(actor);
    } catch (_) {
        asc = null;
    }
    if (!isAlive(asc)) return null;

    // Skip dead actors cleanly
    try {
        if (deadTag && asc.HasMatchingGameplayTag(deadTag)) {
            return { dead: true, items: null };
        }
    } catch (_) {}

    // Read real Infliction_Max from BasicAttributeSet (fallback 100)
    let actorInflictionMax = DEFAULT_ACCUM_MAX;
    try {
        if (inflictionMaxAttr) {
            const im = UE.AttributeUtils.GetCharacterAttributeValue(actor, inflictionMaxAttr);
            if (Number.isFinite(im) && im > 0) actorInflictionMax = im;
        }
    } catch (_) {}

    const items = {};
    for (const def of STATUS_DEFS) {
        let accum = 0;
        try {
            const attrs = statusAttrs[def.id] || [];
            for (const attr of attrs) {
                const v = UE.AttributeUtils.GetCharacterAttributeValue(actor, attr);
                if (Number.isFinite(v) && v > accum) accum = v;
            }
        } catch (_) {
            accum = 0;
        }

        const maxVal = Math.max(actorInflictionMax, accum > actorInflictionMax ? accum : actorInflictionMax);
        const buildupRatio = clamp01(accum / maxVal);

        const dot = getActiveDotTiming(asc, def, worldCtx, timingCache);
        let mode = "none";
        let ratio = 0;

        if (def.useAccumForDot) {
            // Multi-phase Poison: active ONLY while CharacterState.StatusInfliction.Poison is present!
            // When poison ends, PBZ removes the tag while Poison_Accumulation may remain stale -> hide immediately!
            if (dot.active) {
                mode = "dot";
                ratio = dot.ratio >= 0 ? dot.ratio : (accum > ACCUM_EPSILON ? buildupRatio : 1.0);
                // Determine Poison phase (1: <34%, 2: 34%-66%, 3: >=67%)
                const phaseIdx = buildupRatio >= 0.665 ? 2 : (buildupRatio >= 0.335 ? 1 : 0);
                items[def.id] = { mode, ratio, accum, phaseIdx, remaining: dot.remaining, duration: dot.duration };
                continue;
            } else {
                mode = "none";
                ratio = 0;
            }
        } else if (dot.active) {
            if (dot.ratio >= 0) {
                mode = "dot";
                ratio = dot.ratio; // Empties 1 -> 0
            } else if (accum > ACCUM_EPSILON) {
                mode = "dot";
                ratio = buildupRatio; // Fallback: accumulation drain 1 -> 0
            } else {
                // Active tag with no finite duration GE and 0 accumulation -> hide rather than sticking at 100% forever
                mode = "none";
                ratio = 0;
            }
        } else if (accum > ACCUM_EPSILON) {
            mode = "buildup";
            ratio = buildupRatio; // Fills 0 -> 1
        }

        items[def.id] = { mode, ratio, accum, remaining: dot.remaining, duration: dot.duration };
    }

    return { dead: false, items };
}

// ============================================================================
// UMG Circular Status Widget Builder
// ============================================================================

function createRingSlotUI(outerWidget, def, iconSize) {
    const sizeBox = UE.NewObject(UE.SizeBox.StaticClass(), outerWidget);
    sizeBox.SetWidthOverride(iconSize);
    sizeBox.SetHeightOverride(iconSize);
    sizeBox.SetVisibility(UE.ESlateVisibility.Collapsed);

    const overlay = UE.NewObject(UE.Overlay.StaticClass(), outerWidget);
    sizeBox.AddChild(overlay);

    // 1. Background ring track (full dark circle)
    const bgImg = UE.NewObject(UE.Image.StaticClass(), outerWidget);
    const bgSlot = overlay.AddChildToOverlay(bgImg);
    if (bgSlot) {
        bgSlot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Fill);
        bgSlot.SetVerticalAlignment(UE.EVerticalAlignment.VAlign_Fill);
    }

    // 2. Foreground progress ring (radial CD_Ratio 0..1)
    const fgImg = UE.NewObject(UE.Image.StaticClass(), outerWidget);
    const fgSlot = overlay.AddChildToOverlay(fgImg);
    if (fgSlot) {
        fgSlot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Fill);
        fgSlot.SetVerticalAlignment(UE.EVerticalAlignment.VAlign_Fill);
    }

    // 3. Fallback horizontal bar (only shown if MI_UI_CdBar material is not yet loaded)
    const fallbackBar = UE.NewObject(UE.ProgressBar.StaticClass(), outerWidget);
    fallbackBar.SetFillColorAndOpacity(makeLinearColor(def.buildupColor));
    fallbackBar.SetVisibility(UE.ESlateVisibility.Collapsed);
    const fbSlot = overlay.AddChildToOverlay(fallbackBar);
    if (fbSlot) {
        fbSlot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Fill);
        fbSlot.SetVerticalAlignment(UE.EVerticalAlignment.VAlign_Bottom);
    }

    // 4. Native debuff icon image (used when useGameIcons is On)
    const iconImg = UE.NewObject(UE.Image.StaticClass(), outerWidget);
    iconImg.SetVisibility(UE.ESlateVisibility.Collapsed);
    const iconSlot = overlay.AddChildToOverlay(iconImg);
    if (iconSlot) {
        const pad = Math.max(3, Math.round(iconSize * 0.16));
        iconSlot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Fill);
        iconSlot.SetVerticalAlignment(UE.EVerticalAlignment.VAlign_Fill);
        iconSlot.SetPadding(new UE.Margin(pad, pad, pad, pad));
    }

    // 5. Crisp center glyph (血 / 毒 / 燃 / 冰 / 雷 / 水 / 混 - used when useGameIcons is Off or icon fallback)
    const label = UE.NewObject(UE.TextBlock.StaticClass(), outerWidget);
    label.SetText(toFText(def.glyph));
    label.SetColorAndOpacity(makeSlateColor(def.glyphColor));
    applyLabelFont(label, iconSize);
    try {
        label.SetJustification(UE.ETextJustify.Center);
        label.SetShadowOffset(new UE.Vector2D(1, 1));
        label.SetShadowColorAndOpacity(new UE.LinearColor(0, 0, 0, 0.9));
    } catch (_) {}
    const lblSlot = overlay.AddChildToOverlay(label);
    if (lblSlot) {
        lblSlot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Center);
        lblSlot.SetVerticalAlignment(UE.EVerticalAlignment.VAlign_Center);
    }

    const slot = {
        def,
        sizeBox,
        overlay,
        bgImg,
        fgImg,
        fallbackBar,
        iconImg,
        iconSlot,
        label,
        bgMid: null,
        fgMid: null,
        usingCircleMat: false,
        showingGameIcon: false,
        lastIconTex: null,
        lastMode: "none",
        lastPhaseIdx: -1,
        lastRatio: -1,
        currentSize: iconSize,
    };

    bindCircleMaterialToSlot(slot, outerWidget);
    return slot;
}

function bindCircleMaterialToSlot(slot, outerWidget) {
    if (slot.usingCircleMat && isAlive(slot.fgMid) && isAlive(slot.bgMid)) return true;
    if (!isAlive(cachedCircleMaterial)) {
        // Fallback mode until material is ready
        try {
            slot.bgImg.SetVisibility(UE.ESlateVisibility.Collapsed);
            slot.fgImg.SetVisibility(UE.ESlateVisibility.Collapsed);
            slot.fallbackBar.SetVisibility(UE.ESlateVisibility.SelfHitTestInvisible);
        } catch (_) {}
        return false;
    }

    try {
        const bgMid = UE.KismetMaterialLibrary.CreateDynamicMaterialInstance(
            outerWidget,
            cachedCircleMaterial,
            "StatusBg_" + slot.def.id
        );
        const fgMid = UE.KismetMaterialLibrary.CreateDynamicMaterialInstance(
            outerWidget,
            cachedCircleMaterial,
            "StatusFg_" + slot.def.id
        );
        if (!isAlive(bgMid) || !isAlive(fgMid)) return false;

        bgMid.SetScalarParameterValue(GAUGE_PARAM_CD_RATIO, 1.0);
        bgMid.SetVectorParameterValue(GAUGE_PARAM_COLOR_FG, new UE.LinearColor(0.05, 0.05, 0.05, 0.65));

        fgMid.SetScalarParameterValue(GAUGE_PARAM_CD_RATIO, 0.0);
        fgMid.SetVectorParameterValue(GAUGE_PARAM_COLOR_FG, makeLinearColor(slot.def.buildupColor));

        slot.bgImg.SetBrushFromMaterial(bgMid);
        slot.bgImg.SetVisibility(UE.ESlateVisibility.SelfHitTestInvisible);
        slot.fgImg.SetBrushFromMaterial(fgMid);
        slot.fgImg.SetVisibility(UE.ESlateVisibility.SelfHitTestInvisible);
        slot.fallbackBar.SetVisibility(UE.ESlateVisibility.Collapsed);

        slot.bgMid = bgMid;
        slot.fgMid = fgMid;
        slot.usingCircleMat = true;
        slot.lastMode = "none";
        slot.lastRatio = -1;
        return true;
    } catch (e) {
        log("bindCircleMaterialToSlot error: " + String(e));
        return false;
    }
}

function resizeRingSlot(slot, iconSize) {
    if (slot.currentSize === iconSize) return;
    slot.currentSize = iconSize;
    try {
        slot.sizeBox.SetWidthOverride(iconSize);
        slot.sizeBox.SetHeightOverride(iconSize);
        if (isAlive(slot.iconSlot)) {
            const pad = Math.max(3, Math.round(iconSize * 0.16));
            slot.iconSlot.SetPadding(new UE.Margin(pad, pad, pad, pad));
        }
        applyLabelFont(slot.label, iconSize, !!(slot.def.phaseStyles && slot.lastPhaseIdx >= 0));
    } catch (_) {}
}

function syncSlotCenterVisual(slot, phaseIdx) {
    const tex = config.useGameIcons ? getStatusTexture(slot.def.id, phaseIdx) : null;
    const wantIcon = !!tex;
    if (wantIcon) {
        if (!slot.showingGameIcon || slot.lastIconTex !== tex) {
            try {
                slot.iconImg.SetBrushFromTexture(tex, false);
                slot.iconImg.SetVisibility(UE.ESlateVisibility.SelfHitTestInvisible);
                slot.label.SetVisibility(UE.ESlateVisibility.Collapsed);
                slot.showingGameIcon = true;
                slot.lastIconTex = tex;
            } catch (_) {}
        }
    } else if (slot.showingGameIcon) {
        try {
            slot.iconImg.SetVisibility(UE.ESlateVisibility.Collapsed);
            slot.label.SetVisibility(UE.ESlateVisibility.SelfHitTestInvisible);
            slot.showingGameIcon = false;
            slot.lastIconTex = null;
        } catch (_) {}
    }
}

function updateRingSlot(slot, state, enabledForStatus, outerWidget) {
    if (!enabledForStatus || !state || state.mode === "none") {
        if (slot.lastMode !== "none") {
            slot.lastMode = "none";
            slot.lastPhaseIdx = -1;
            slot.lastRatio = -1;
            try {
                slot.sizeBox.SetVisibility(UE.ESlateVisibility.Collapsed);
                slot.sizeBox.SetRenderScale(new UE.Vector2D(1.0, 1.0));
            } catch (_) {}
        }
        return false;
    }

    // Upgrade from fallback bar to radial circle as soon as material is cached
    if (!slot.usingCircleMat && isAlive(cachedCircleMaterial)) {
        bindCircleMaterialToSlot(slot, outerWidget);
    }

    const phaseIdx = typeof state.phaseIdx === "number" ? state.phaseIdx : -1;
    const modeChanged = slot.lastMode !== state.mode;
    const phaseChanged = slot.lastPhaseIdx !== phaseIdx;
    const ratioChanged = Math.abs(slot.lastRatio - state.ratio) >= 0.004;

    if (modeChanged || phaseChanged) {
        try {
            slot.sizeBox.SetVisibility(UE.ESlateVisibility.SelfHitTestInvisible);
            // Slightly pop scale during active DoT (and extra slight pop on Phase 3)
            const scale = state.mode === "dot" ? (phaseIdx >= 2 ? 1.12 : 1.08) : 1.0;
            slot.sizeBox.SetRenderScale(new UE.Vector2D(scale, scale));
        } catch (_) {}

        const phaseStyle = (slot.def.phaseStyles && phaseIdx >= 0) ? slot.def.phaseStyles[phaseIdx] : null;
        const targetColor = phaseStyle
            ? phaseStyle.ringColor
            : (state.mode === "dot" ? slot.def.dotColor : slot.def.buildupColor);

        if (phaseStyle) {
            try {
                slot.label.SetText(toFText(phaseStyle.glyph));
                slot.label.SetColorAndOpacity(makeSlateColor(phaseStyle.glyphColor));
                applyLabelFont(slot.label, slot.currentSize, true);
            } catch (_) {}
        } else if (slot.lastPhaseIdx >= 0) {
            try {
                slot.label.SetText(toFText(slot.def.glyph));
                slot.label.SetColorAndOpacity(makeSlateColor(slot.def.glyphColor));
                applyLabelFont(slot.label, slot.currentSize, false);
            } catch (_) {}
        }

        if (slot.usingCircleMat && isAlive(slot.fgMid)) {
            try {
                slot.fgMid.SetVectorParameterValue(GAUGE_PARAM_COLOR_FG, makeLinearColor(targetColor));
            } catch (_) {}
        } else {
            try {
                slot.fallbackBar.SetFillColorAndOpacity(makeLinearColor(targetColor));
            } catch (_) {}
        }
        slot.lastMode = state.mode;
        slot.lastPhaseIdx = phaseIdx;
    }

    // Sync native game icon vs Chinese glyph (live-reacts to useGameIcons toggle & async texture load)
    syncSlotCenterVisual(slot, phaseIdx);

    if (modeChanged || phaseChanged || ratioChanged) {
        if (slot.usingCircleMat && isAlive(slot.fgMid)) {
            try {
                slot.fgMid.SetScalarParameterValue(GAUGE_PARAM_CD_RATIO, state.ratio);
            } catch (_) {}
        } else {
            try {
                slot.fallbackBar.SetPercent(state.ratio);
            } catch (_) {}
        }
        slot.lastRatio = state.ratio;
    }

    return true;
}

// ============================================================================
// Widget Attachment (Dynamic Layout Inspection for Enemy & Boss HP Bars)
// ============================================================================

function attachContainerToWidget(hpBarWidget, container, isBoss) {
    const candidates = [];
    try {
        if (hpBarWidget.HPBar && typeof hpBarWidget.HPBar.GetParent === "function") {
            const p = hpBarWidget.HPBar.GetParent();
            if (isAlive(p)) candidates.push(p);
        }
    } catch (_) {}
    try {
        if (hpBarWidget.WidgetTree && isAlive(hpBarWidget.WidgetTree.RootWidget)) {
            const root = hpBarWidget.WidgetTree.RootWidget;
            if (!candidates.includes(root)) candidates.push(root);
        }
    } catch (_) {}

    const yOffset = isBoss ? 8 : 4;
    const placeAbove = isBoss ? true : !!config.enemyBarAbove;

    for (const parent of candidates) {
        const pClass = getClassPathSafe(parent);
        try {
            if (typeof parent.AddChildToVerticalBox === "function") {
                const slot = parent.AddChildToVerticalBox(container);
                if (slot) {
                    slot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Center);
                    slot.SetPadding(new UE.Margin(0, yOffset, 0, 0));
                }
                return { parent, slot, method: "VerticalBox(" + pClass + ")", mode: "vbox", placeAbove, yOffset };
            }
            if (typeof parent.AddChildToCanvas === "function") {
                const slot = parent.AddChildToCanvas(container);
                if (slot) {
                    applyCanvasSlotPlacement(slot, placeAbove, yOffset);
                }
                return { parent, slot, method: "CanvasPanel(" + pClass + ")", mode: "canvas", placeAbove, yOffset };
            }
            if (typeof parent.AddChildToOverlay === "function") {
                const slot = parent.AddChildToOverlay(container);
                const iconSize = isBoss ? config.bossIconSize : config.enemyIconSize;
                applyOverlaySlotPlacement(slot, container, placeAbove, iconSize, yOffset);
                return { parent, slot, method: "Overlay(" + pClass + ")", mode: "overlay", placeAbove, yOffset };
            }
        } catch (e) {
            log("Attach attempt failed on " + pClass + ": " + String(e));
        }
    }

    return null;
}

function applyCanvasSlotPlacement(slot, placeAbove, yOffset) {
    if (!isAlive(slot)) return;
    if (placeAbove) {
        const anchors = new UE.Anchors(new UE.Vector2D(0.5, 0.0), new UE.Vector2D(0.5, 0.0));
        slot.SetAnchors(anchors);
        slot.SetAlignment(new UE.Vector2D(0.5, 1.0));
        slot.SetAutoSize(true);
        slot.SetPosition(new UE.Vector2D(0, -yOffset));
    } else {
        const anchors = new UE.Anchors(new UE.Vector2D(0.5, 1.0), new UE.Vector2D(0.5, 1.0));
        slot.SetAnchors(anchors);
        slot.SetAlignment(new UE.Vector2D(0.5, 0.0));
        slot.SetAutoSize(true);
        slot.SetPosition(new UE.Vector2D(0, yOffset));
    }
}

function applyOverlaySlotPlacement(slot, container, placeAbove, iconSize, yOffset) {
    if (isAlive(slot)) {
        slot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Center);
        slot.SetVerticalAlignment(
            placeAbove ? UE.EVerticalAlignment.VAlign_Top : UE.EVerticalAlignment.VAlign_Bottom
        );
    }
    if (isAlive(container)) {
        const ty = placeAbove ? -(iconSize + yOffset) : (iconSize + yOffset);
        container.SetRenderTranslation(new UE.Vector2D(0, ty));
    }
}

function createAttachment(hpBarWidget, actor, isBoss) {
    const widgetKey = getPathSafe(hpBarWidget);
    if (!widgetKey) return null;

    const iconSize = isBoss ? config.bossIconSize : config.enemyIconSize;
    const hbox = UE.NewObject(UE.HorizontalBox.StaticClass(), hpBarWidget);
    hbox.SetVisibility(UE.ESlateVisibility.Collapsed);
    try {
        hbox.SetClipping(UE.EWidgetClipping.Inherit);
    } catch (_) {}

    const slots = {};
    for (let i = 0; i < STATUS_DEFS.length; i++) {
        const def = STATUS_DEFS[i];
        const ringSlot = createRingSlotUI(hpBarWidget, def, iconSize);
        const hbSlot = hbox.AddChildToHorizontalBox(ringSlot.sizeBox);
        if (hbSlot) {
            hbSlot.SetHorizontalAlignment(UE.EHorizontalAlignment.HAlign_Center);
            hbSlot.SetVerticalAlignment(UE.EVerticalAlignment.VAlign_Center);
            hbSlot.SetPadding(new UE.Margin(i === 0 ? 0 : 3, 0, 3, 0));
        }
        slots[def.id] = ringSlot;
    }

    const attached = attachContainerToWidget(hpBarWidget, hbox, isBoss);
    if (!attached) {
        log("Failed to attach status container to " + (isBoss ? "Boss" : "Enemy") + " widget: " + widgetKey);
        flushLog();
        return null;
    }

    if (isBoss && !bossLayoutLogged) {
        bossLayoutLogged = true;
        log("Attached Boss status rings via " + attached.method + " on " + getClassPathSafe(hpBarWidget) + " (actor=" + (isAlive(actor) ? actor.GetName() : "none") + ")");
        flushLog();
    } else if (!isBoss && !enemyLayoutLogged) {
        enemyLayoutLogged = true;
        log("Attached Enemy status rings via " + attached.method + " on " + getClassPathSafe(hpBarWidget) + " (actor=" + (isAlive(actor) ? actor.GetName() : "none") + ")");
        flushLog();
    }

    const record = {
        key: widgetKey,
        widget: hpBarWidget,
        actor,
        isBoss,
        container: hbox,
        attachSlot: attached.slot,
        slots,
        timingCache: {},
        visible: false,
        attachMode: attached.mode,
        placeAbove: !!attached.placeAbove,
        yOffset: attached.yOffset || (isBoss ? 8 : 4),
        lastIconSize: iconSize,
    };
    attachments.set(widgetKey, record);
    return record;
}

function removeAttachment(key) {
    const rec = attachments.get(key);
    if (!rec) return;
    try {
        if (isAlive(rec.container)) {
            rec.container.RemoveFromParent();
        }
    } catch (_) {}
    attachments.delete(key);
}

// ============================================================================
// Boss Actor Resolution & Discovery
// ============================================================================

const BOSS_ACTOR_PROP_CANDIDATES = [
    "SelfActor",
    "BossActor",
    "TargetActor",
    "OwnerActor",
    "BindActor",
    "EnemyActor",
    "BossCharacter",
    "Character",
    "Boss",
    "Target",
];

function resolveBossActorFromWidget(bossWidget, fallbackCombatBosses) {
    if (!isAlive(bossWidget)) return null;
    for (const prop of BOSS_ACTOR_PROP_CANDIDATES) {
        try {
            const val = bossWidget[prop];
            if (isAlive(val) && typeof val.K2_GetActorLocation === "function") {
                return val;
            }
        } catch (_) {}
    }

    // Fallback: if there is a single active combat boss in the world, match it
    if (fallbackCombatBosses && fallbackCombatBosses.length === 1) {
        return fallbackCombatBosses[0];
    }
    return null;
}

function findActiveCombatBosses(worldCtx) {
    const result = [];
    if (!isAlive(worldCtx) || !ensureGASStatics()) return result;
    try {
        const outRef = puerts.$ref(UE.NewArray(UE.Character));
        UE.GameplayStatics.GetAllActorsOfClass(worldCtx, UE.Character.StaticClass(), outRef);
        const arr = puerts.$unref(outRef);
        if (!arr) return result;
        const n = arr.Num();
        for (let i = 0; i < n; i++) {
            const ch = arr.Get(i);
            if (!isAlive(ch)) continue;
            const asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(ch);
            if (!isAlive(asc)) continue;
            if (!asc.HasMatchingGameplayTag(bossTag)) continue;
            if (deadTag && asc.HasMatchingGameplayTag(deadTag)) continue;
            if (combatTag && asc.HasMatchingGameplayTag(combatTag)) {
                result.push(ch);
            }
        }
    } catch (_) {}
    return result;
}

function discoverWidgets() {
    if (stopped) return;
    const gi = getGameInstance();
    if (!gi) return;
    ensureGASStatics();

    // 1. Collect all UserWidgets once for material discovery + EnemyHPBar discovery
    let allWidgets = null;
    try {
        if (UE.WidgetBlueprintLibrary && UE.UserWidget) {
            const outRef = puerts.$ref(UE.NewArray(UE.UserWidget));
            UE.WidgetBlueprintLibrary.GetAllWidgetsOfClass(gi, outRef, UE.UserWidget.StaticClass(), false);
            allWidgets = puerts.$unref(outRef);
        }
    } catch (_) {
        allWidgets = null;
    }

    // Acquire native radial circle material & DT_BuffStatus debuff icons if not yet cached
    if (allWidgets && !isAlive(cachedCircleMaterial)) {
        tryAcquireCircleMaterial(allWidgets);
    }
    if (!debuffIconsLoaded) {
        tryAcquireDebuffIcons();
    }

    // 2. Discover Enemy HP Bar widgets
    if (config.enabled && config.showEnemyBar && allWidgets) {
        const n = allWidgets.Num();
        for (let i = 0; i < n; i++) {
            const w = allWidgets.Get(i);
            if (!isAlive(w)) continue;
            // EnemyHPBar mixin widgets always have SelfActor + HPBar
            let actor = null;
            try {
                if (!w.HPBar || !w.SelfActor) continue;
                actor = w.SelfActor;
            } catch (_) {
                continue;
            }
            if (!isAlive(actor)) continue;

            // Skip hostile bosses on overhead bar (they use Boss HP bar)
            try {
                if (typeof w.isBoss === "function" && w.isBoss()) continue;
            } catch (_) {}

            const key = getPathSafe(w);
            if (!key) continue;
            const existing = attachments.get(key);
            if (existing) {
                existing.actor = actor;
            } else {
                createAttachment(w, actor, false);
            }
        }
    }

    // 3. Discover Boss HP Bar widgets via PBZHUDLayout.GetBossHPBarInstances() + fallback scan
    if (config.enabled && config.showBossBar) {
        const worldCtx = getWorldContext();
        const bossWidgets = [];
        const seenBossKeys = new Set();

        try {
            if (UE.PBZHUDLayout && typeof UE.PBZHUDLayout.GetHUDLayout === "function") {
                const hud = UE.PBZHUDLayout.GetHUDLayout(worldCtx);
                if (isAlive(hud) && typeof hud.GetBossHPBarInstances === "function") {
                    const list = hud.GetBossHPBarInstances();
                    if (list && typeof list.Num === "function") {
                        for (let i = 0; i < list.Num(); i++) {
                            const bw = list.Get(i);
                            if (!isAlive(bw)) continue;
                            const k = getPathSafe(bw);
                            if (k && !seenBossKeys.has(k)) {
                                seenBossKeys.add(k);
                                bossWidgets.push(bw);
                            }
                        }
                    }
                }
            }
        } catch (_) {}

        // Fallback: scan allWidgets for BossHPBar class names
        if (bossWidgets.length === 0 && allWidgets) {
            const n = allWidgets.Num();
            for (let i = 0; i < n; i++) {
                const w = allWidgets.Get(i);
                if (!isAlive(w)) continue;
                const cpath = getClassPathSafe(w);
                if (!/Boss.*HP.*Bar|BossHPBar/i.test(cpath)) continue;
                const k = getPathSafe(w);
                if (k && !seenBossKeys.has(k)) {
                    seenBossKeys.add(k);
                    bossWidgets.push(w);
                }
            }
        }

        if (bossWidgets.length > 0) {
            let fallbackBosses = null;
            for (const bw of bossWidgets) {
                let actor = resolveBossActorFromWidget(bw, null);
                if (!isAlive(actor)) {
                    if (fallbackBosses === null) {
                        fallbackBosses = findActiveCombatBosses(worldCtx);
                    }
                    actor = resolveBossActorFromWidget(bw, fallbackBosses);
                }
                const key = getPathSafe(bw);
                if (!key) continue;
                const existing = attachments.get(key);
                if (existing) {
                    if (isAlive(actor)) existing.actor = actor;
                } else {
                    createAttachment(bw, actor, true);
                }
            }
        }
    }

    // 4. Prune dead/destroyed widgets
    for (const [key, rec] of Array.from(attachments.entries())) {
        if (!isAlive(rec.widget) || !isAlive(rec.container)) {
            attachments.delete(key);
        }
    }
}

// ============================================================================
// High-Frequency Smooth Gauge Update Loop
// ============================================================================

function tickAttachments() {
    if (stopped || attachments.size === 0) return;

    const worldCtx = getWorldContext();
    if (!isAlive(worldCtx)) return;

    for (const [key, rec] of Array.from(attachments.entries())) {
        if (!isAlive(rec.widget) || !isAlive(rec.container)) {
            attachments.delete(key);
            continue;
        }

        const barAllowed = config.enabled && (rec.isBoss ? config.showBossBar : config.showEnemyBar);
        if (!barAllowed || !isAlive(rec.actor)) {
            if (rec.visible) {
                rec.visible = false;
                try { rec.container.SetVisibility(UE.ESlateVisibility.Collapsed); } catch (_) {}
            }
            continue;
        }

        const state = readActorStatusState(rec.actor, worldCtx, rec.timingCache);
        if (!state || state.dead || !state.items) {
            if (rec.visible) {
                rec.visible = false;
                try { rec.container.SetVisibility(UE.ESlateVisibility.Collapsed); } catch (_) {}
            }
            continue;
        }

        const targetSize = rec.isBoss ? config.bossIconSize : config.enemyIconSize;
        const desiredAbove = rec.isBoss ? true : !!config.enemyBarAbove;
        if (rec.lastIconSize !== targetSize || rec.placeAbove !== desiredAbove) {
            rec.lastIconSize = targetSize;
            rec.placeAbove = desiredAbove;
            try {
                if (rec.attachMode === "overlay") {
                    applyOverlaySlotPlacement(rec.attachSlot, rec.container, desiredAbove, targetSize, rec.yOffset);
                } else if (rec.attachMode === "canvas") {
                    applyCanvasSlotPlacement(rec.attachSlot, desiredAbove, rec.yOffset);
                }
            } catch (_) {}
        }
        let anyShown = false;

        for (const def of STATUS_DEFS) {
            const slot = rec.slots[def.id];
            if (!slot) continue;
            resizeRingSlot(slot, targetSize);
            const shown = updateRingSlot(slot, state.items[def.id], !!config[def.settingKey], rec.widget);
            if (shown) anyShown = true;
        }

        if (anyShown !== rec.visible) {
            rec.visible = anyShown;
            try {
                rec.container.SetVisibility(
                    anyShown ? UE.ESlateVisibility.SelfHitTestInvisible : UE.ESlateVisibility.Collapsed
                );
            } catch (_) {}
        }
    }
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
    } else if (name === "enemyIconSize") {
        const num = Number(text);
        if (text !== "" && Number.isFinite(num)) {
            parsed = Math.max(16, Math.min(48, Math.round(num)));
        }
    } else if (name === "bossIconSize") {
        const num = Number(text);
        if (text !== "" && Number.isFinite(num)) {
            parsed = Math.max(20, Math.min(60, Math.round(num)));
        }
    }

    const changed = config[name] !== parsed;
    config[name] = parsed;
    if (changed && triggerRefresh) {
        log("Setting changed: " + name + " = " + String(parsed));
        tickAttachments();
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
                "; PBZEnemyStatusBars settings. Managed by PBZModsMenu.",
                "enabled=" + (defaults.enabled ? "On" : "Off"),
                "useGameIcons=" + (defaults.useGameIcons ? "On" : "Off"),
                "showEnemyBar=" + (defaults.showEnemyBar ? "On" : "Off"),
                "enemyBarAbove=" + (defaults.enemyBarAbove ? "On" : "Off"),
                "showBossBar=" + (defaults.showBossBar ? "On" : "Off"),
                "showBleed=" + (defaults.showBleed ? "On" : "Off"),
                "showPoison=" + (defaults.showPoison ? "On" : "Off"),
                "showIgnite=" + (defaults.showIgnite ? "On" : "Off"),
                "showFrost=" + (defaults.showFrost ? "On" : "Off"),
                "showElectrified=" + (defaults.showElectrified ? "On" : "Off"),
                "showWater=" + (defaults.showWater ? "On" : "Off"),
                "showChaos=" + (defaults.showChaos ? "On" : "Off"),
                "enemyIconSize=" + String(defaults.enemyIconSize),
                "bossIconSize=" + String(defaults.bossIconSize),
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
        title: label("Enemy & Boss Status Rings", "敌人/Boss 异常累积圆环"),
        description: label(
            "Shows circular Bleed, Poison, and Burn (Ignite) buildup rings (filling up) and active DoT countdown rings (emptying) under Enemy and Boss HP bars.",
            "在敌人和 Boss 血条下方显示出血、中毒、燃烧的圆形累积进度环（慢慢变多），以及中毒/燃烧触发后的 DoT 倒计时环（慢慢变空）。"
        ),
        version: VERSION,
        file: SETTINGS_FILE,
        settings: [
            {
                key: "enabled",
                type: "toggle",
                label: label("Enable mod", "启用本模组"),
                default: defaults.enabled,
                help: "Master toggle for all status rings / 总开关",
            },
            {
                key: "useGameIcons",
                type: "toggle",
                label: label("Use Native Game Icons", "使用游戏原版异常图标（替代汉字）"),
                default: defaults.useGameIcons,
                help: "On = show native PBZ debuff icons inside rings; Off = show Chinese glyphs (血/燃/毒/冰/雷/水/混) / 开启=使用原版图标，关闭=显示汉字",
            },
            {
                key: "showEnemyBar",
                type: "toggle",
                label: label("Show on Enemy HP Bars", "敌人血条显示"),
                default: defaults.showEnemyBar,
                help: "Display status rings on normal enemy overhead HP bars / 在普通敌人头顶血条显示",
            },
            {
                key: "enemyBarAbove",
                type: "toggle",
                label: label("Enemy Rings Above HP Bar", "普通敌人状态栏置于血条上方"),
                default: defaults.enemyBarAbove,
                help: "On = above Enemy HP bar (default), Off = below Enemy HP bar / 开启=血条上方（默认），关闭=血条下方",
            },
            {
                key: "showBossBar",
                type: "toggle",
                label: label("Show on Boss HP Bars", "Boss 血条显示"),
                default: defaults.showBossBar,
                help: "Display status rings under Boss HP bars / 在 Boss 血条下方显示",
            },
            {
                key: "showBleed",
                type: "toggle",
                label: label("Show Bleed", "显示出血"),
                default: defaults.showBleed,
                help: "Show Bleed accumulation ring / 显示出血累积圆环",
            },
            {
                key: "showPoison",
                type: "toggle",
                label: label("Show Poison (Buildup + DoT)", "显示中毒（累积 + DoT 倒计时）"),
                default: defaults.showPoison,
                help: "Show Poison buildup ring and DoT countdown ring / 显示中毒累积与毒伤倒计时圆环",
            },
            {
                key: "showIgnite",
                type: "toggle",
                label: label("Show Burn / Ignite", "显示燃烧"),
                default: defaults.showIgnite,
                help: "Show Burn/Ignite buildup & DoT countdown ring / 显示燃烧累积与灼烧倒计时圆环",
            },
            {
                key: "showFrost",
                type: "toggle",
                label: label("Show Frost / Freeze", "显示冰冻"),
                default: defaults.showFrost,
                help: "Show Frost buildup & freeze countdown ring / 显示冰冻累积与冰冻状态圆环",
            },
            {
                key: "showElectrified",
                type: "toggle",
                label: label("Show Electrified / Thunder", "显示感电 / 雷"),
                default: defaults.showElectrified,
                help: "Show Electrified/Thunder buildup & state ring / 显示感电与雷击累积圆环",
            },
            {
                key: "showWater",
                type: "toggle",
                label: label("Show Water / Wet", "显示潮湿 / 水"),
                default: defaults.showWater,
                help: "Show Water/Wet buildup & state ring / 显示潮湿累积与状态圆环",
            },
            {
                key: "showChaos",
                type: "toggle",
                label: label("Show Chaos", "显示混沌"),
                default: defaults.showChaos,
                help: "Show Chaos buildup & state ring / 显示混沌累积与状态圆环",
            },
            {
                key: "enemyIconSize",
                type: "number",
                label: label("Enemy Ring Size (px)", "敌人圆圈大小 (px)"),
                min: 16,
                max: 48,
                step: 2,
                default: defaults.enemyIconSize,
                help: "Diameter of status rings under Enemy HP bars / 敌人血条下方圆环直径",
            },
            {
                key: "bossIconSize",
                type: "number",
                label: label("Boss Ring Size (px)", "Boss 圆圈大小 (px)"),
                min: 20,
                max: 60,
                step: 2,
                default: defaults.bossIconSize,
                help: "Diameter of status rings under Boss HP bars / Boss 血条下方圆环直径",
            },
        ],
        onChange: (key, value) => {
            if (!stopped) applySetting(key, value, true);
        },
    });
}

// ============================================================================
// Lifecycle (Start / Stop)
// ============================================================================

function stop() {
    stopped = true;
    if (discoveryTimer !== undefined) {
        clearInterval(discoveryTimer);
        discoveryTimer = undefined;
    }
    if (tickTimer !== undefined) {
        clearInterval(tickTimer);
        tickTimer = undefined;
    }
    if (settingsTimer !== undefined) {
        clearInterval(settingsTimer);
        settingsTimer = undefined;
    }
    for (const key of Array.from(attachments.keys())) {
        removeAttachment(key);
    }
    attachments.clear();
    cachedCircleMaterial = null;
    flushLog();
    exports.ready = false;
}

exports.stop = stop;
exports.ready = false;

try {
    log("=== " + MOD_ID + " " + VERSION + " starting ===");
    readSettings(false);
    registerMenu();
    discoverWidgets();
    discoveryTimer = setInterval(discoverWidgets, DISCOVERY_INTERVAL_MS);
    tickTimer = setInterval(tickAttachments, TICK_INTERVAL_MS);
    settingsTimer = setInterval(() => {
        if (!stopped) {
            try { readSettings(true); } catch (_) {}
        }
    }, SETTINGS_POLL_MS);
    exports.ready = true;
    log(
        "=== " + MOD_ID + " ready (enabled=" + config.enabled +
        ", enemy=" + config.showEnemyBar +
        ", boss=" + config.showBossBar + ") ==="
    );
    flushLog();
} catch (e) {
    log("Startup failed: " + String(e));
    flushLog();
    stop();
    throw e;
}
