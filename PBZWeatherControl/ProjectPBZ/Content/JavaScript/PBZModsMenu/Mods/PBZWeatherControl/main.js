"use strict";

// PBZWeatherControl v1.0.0
// Full-map Weather & Lighting Control Mod for Phantom Blade Zero
// Compatible with PBZModsMenu (live switching, per-map snapshot & restore)

const UE = require("ue");
const puerts = require("puerts");

const MOD_ID = "PBZWeatherControl";
const VERSION = "1.1.3";
const SETTINGS_FILE = MOD_ID + ".txt";
const LOG_FILE = MOD_ID + ".log";

const UDW_CLASS_PATH = "/Weather/UltraDynamicSky/Blueprints/Ultra_Dynamic_Weather.Ultra_Dynamic_Weather_C";
const UDW_CHILD_CLASS_PATH = "/Weather/OurWeather/Blueprints/Ultra_Dynamic_Weather_Child.Ultra_Dynamic_Weather_Child_C";
const UDS_CLASS_PATH = "/Weather/UltraDynamicSky/Blueprints/Ultra_Dynamic_Sky.Ultra_Dynamic_Sky_C";
const UDS_CHILD_CLASS_PATH = "/Weather/OurWeather/Blueprints/Ultra_Dynamic_Sky_Child.Ultra_Dynamic_Sky_Child_C";
const UDS_FUNCS_PATH = "/Weather/UltraDynamicSky/Blueprints/Functions/UltraDynamicSky_Functions.UltraDynamicSky_Functions_C";
const UDW_FUNCS_PATH = "/Weather/UltraDynamicSky/Blueprints/Functions/UltraDynamicWeather_Functions.UltraDynamicWeather_Functions_C";
const WEATHER_UTIL_PATH = "/Weather/OurWeather/Blueprints/BPF_WeatherUtilities.BPF_WeatherUtilities_C";

const PRESET_BASE = "/Weather/UltraDynamicSky/Blueprints/Weather_Effects/Weather_Presets/";

// Wwise audio assets for stopping/restoring persistent rain ambience
const WWISE_RTPC_RAIN = "/Game/Wwise/Game_Parameters/Amb/Weather/Rain.Rain";
const WWISE_RTPC_RAIN_PLAYING = "/Game/Wwise/Game_Parameters/Amb/Weather/Rain_Playing.Rain_Playing";
const WWISE_RTPC_AMB_VOL = "/Game/Wwise/Game_Parameters/Amb/Weather/Amb_Weather_Volume.Amb_Weather_Volume";
const WWISE_STATE_RAIN_NONE = "/Game/Wwise/States/Amb/Weather_Rain/Weather_Rain-None.Weather_Rain-None";
const WWISE_STATE_RAIN_OUTSIDE = "/Game/Wwise/States/Amb/Weather_Rain/Weather_Rain-Outside.Weather_Rain-Outside";
const WWISE_EVENT_RAIN_STOP = "/Game/Wwise/Events/Stop/Amb/Weather/SFX_AMB_Weathe_Rain_Loop_Stop.SFX_AMB_Weathe_Rain_Loop_Stop";

// Built-in UDS_Weather_Settings presets + fallback manual override profiles
const WEATHER_PRESETS = {
    Clear_Skies:       { asset: "Clear_Skies",       rain: 0.0, snow: 0.0, dust: 0.0, cloud: 0.15, fog: 0.0,  wind: 0.4, wet: 0.0, matSnow: 0.0,  matDust: 0.0,  dry: true  },
    Partly_Cloudy:     { asset: "Partly_Cloudy",     rain: 0.0, snow: 0.0, dust: 0.0, cloud: 1.0,  fog: 0.05, wind: 0.7, wet: 0.0, matSnow: 0.0,  matDust: 0.0,  dry: true  },
    Cloudy:            { asset: "Cloudy",            rain: 0.0, snow: 0.0, dust: 0.0, cloud: 2.8,  fog: 0.15, wind: 1.0, wet: 0.0, matSnow: 0.0,  matDust: 0.0,  dry: true  },
    Overcast:          { asset: "Overcast",          rain: 0.0, snow: 0.0, dust: 0.0, cloud: 4.8,  fog: 0.35, wind: 1.2, wet: 0.1, matSnow: 0.0,  matDust: 0.0,  dry: true  },
    Foggy:             { asset: "Foggy",             rain: 0.0, snow: 0.0, dust: 0.0, cloud: 3.0,  fog: 1.2,  wind: 0.4, wet: 0.2, matSnow: 0.0,  matDust: 0.0,  dry: true  },
    Rain_Light:        { asset: "Rain_Light",        rain: 1.0, snow: 0.0, dust: 0.0, cloud: 4.5,  fog: 0.4,  wind: 1.5, wet: 0.5, matSnow: 0.0,  matDust: 0.0,  dry: false },
    Rain:              { asset: "Rain",              rain: 2.5, snow: 0.0, dust: 0.0, cloud: 5.5,  fog: 0.7,  wind: 2.5, wet: 0.8, matSnow: 0.0,  matDust: 0.0,  dry: false },
    Rain_Thunderstorm: { asset: "Rain_Thunderstorm", rain: 4.5, snow: 0.0, dust: 0.0, cloud: 7.0,  fog: 1.0,  wind: 4.0, wet: 1.0, matSnow: 0.0,  matDust: 0.0,  dry: false },
    Snow_Light:        { asset: "Snow_Light",        rain: 0.0, snow: 1.5, dust: 0.0, cloud: 4.0,  fog: 0.35, wind: 1.0, wet: 0.0, matSnow: 0.45, matDust: 0.0,  dry: true  },
    Snow:              { asset: "Snow",              rain: 0.0, snow: 3.0, dust: 0.0, cloud: 5.5,  fog: 0.6,  wind: 2.0, wet: 0.0, matSnow: 0.8,  matDust: 0.0,  dry: true  },
    Snow_Blizzard:     { asset: "Snow_Blizzard",     rain: 0.0, snow: 5.0, dust: 0.0, cloud: 7.0,  fog: 1.1,  wind: 4.5, wet: 0.0, matSnow: 1.0,  matDust: 0.0,  dry: true  },
    Sand_Dust_Calm:    { asset: "Sand_Dust_Calm",    rain: 0.0, snow: 0.0, dust: 1.5, cloud: 1.5,  fog: 0.5,  wind: 2.0, wet: 0.0, matSnow: 0.0,  matDust: 0.4,  dry: true  },
    Sand_Dust_Storm:   { asset: "Sand_Dust_Storm",   rain: 0.0, snow: 0.0, dust: 4.5, cloud: 4.5,  fog: 1.2,  wind: 4.5, wet: 0.0, matSnow: 0.0,  matDust: 0.85, dry: true  },
};

const DEFAULT_CONFIG = {
    enabled: true,
    weatherPreset: "default",
    timePreset: "default",
    sunIntensity: 1.0,
    skyIntensity: 1.0,
    fogScale: 1.0,
    saturation: 1.0,
    dryGround: true,
    sunAngleOffset: 0,
};

let config = { ...DEFAULT_CONFIG };

// Per-map original snapshot so we can restore cleanly anytime
let currentLevelKey = "";
let currentUdw = null;
let currentUds = null;
let origUdwState = null;
let origUdsState = null;
let origGlobalWeatherProps = null;
let dripActorsHidden = false;
let hasOverridden = false;

let pollTimer = null;
let lastAppliedSig = "";
const logLines = [];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function safeCall(fn, fb = undefined) {
    try { return fn(); } catch (_) { return fb; }
}

function isValid(o) {
    if (!o) return false;
    try { return !!UE.KismetSystemLibrary.IsValid(o); } catch (_) { return true; }
}

function getSavedDir() {
    try { return String(UE.KismetSystemLibrary.GetProjectSavedDirectory()); }
    catch (_) { return "C:/Users/baige/AppData/Local/ProjectPBZ/Saved/"; }
}

function getSettingsPath() {
    try { return String(UE.KismetSystemLibrary.GetProjectContentDirectory()) + "Paks/~mods/" + SETTINGS_FILE; }
    catch (_) { return ""; }
}

function log(msg) {
    const line = `[${new Date().toISOString()}] [${MOD_ID}] ${msg}`;
    logLines.push(line);
    if (logLines.length > 300) logLines.shift();
    console.warn(line);
    try {
        UE.EasyCsv.SaveStringToFileWithFullPath(logLines.join("\n") + "\n", getSavedDir() + LOG_FILE);
    } catch (_) {}
}

function parseBool(v, fb) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v || "").trim().toLowerCase();
    if (s === "on" || s === "true" || s === "1" || s === "yes") return true;
    if (s === "off" || s === "false" || s === "0" || s === "no") return false;
    return fb;
}

function parseNum(v, fb, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fb;
    return Math.max(min, Math.min(max, n));
}

function loadSettingsFromDisk() {
    const path = getSettingsPath();
    if (!path) return;
    if (!safeCall(() => UE.BlueprintPathsLibrary.FileExists(path), false)) return;
    const outRef = puerts.$ref("");
    if (!safeCall(() => UE.EasyCsv.LoadStringFromLocalFile(path, outRef), false)) return;
    const text = String(puerts.$unref(outRef) || "").replace(/^\uFEFF/, "");
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/[;#].*$/, "").trim();
        if (!line) continue;
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        applyConfigValue(k, v);
    }
}

function applyConfigValue(key, value) {
    switch (key) {
        case "enabled":
            config.enabled = parseBool(value, DEFAULT_CONFIG.enabled);
            break;
        case "weatherPreset": {
            const s = String(value || "default").trim();
            config.weatherPreset = (s === "default" || WEATHER_PRESETS[s]) ? s : "default";
            break;
        }
        case "timePreset":
            config.timePreset = String(value || "default").trim();
            break;
        case "sunIntensity":
            config.sunIntensity = parseNum(value, DEFAULT_CONFIG.sunIntensity, 0, 4);
            break;
        case "skyIntensity":
            config.skyIntensity = parseNum(value, DEFAULT_CONFIG.skyIntensity, 0, 4);
            break;
        case "fogScale":
            config.fogScale = parseNum(value, DEFAULT_CONFIG.fogScale, 0, 2);
            break;
        case "saturation":
            config.saturation = parseNum(value, DEFAULT_CONFIG.saturation, 0.2, 2);
            break;
        case "dryGround":
            config.dryGround = parseBool(value, DEFAULT_CONFIG.dryGround);
            break;
        case "sunAngleOffset":
            config.sunAngleOffset = parseNum(value, DEFAULT_CONFIG.sunAngleOffset, -180, 180);
            break;
    }
}

function getWorldContext() {
    const gi = safeCall(() => puerts.argv && puerts.argv.getByName ? puerts.argv.getByName("GameInstance") : null, null);
    if (!gi || !isValid(gi)) return null;
    const pawn = safeCall(() => UE.GameplayStatics.GetPlayerCharacter(gi, 0), null);
    if (pawn && isValid(pawn)) return pawn;
    const pc = safeCall(() => UE.GameplayStatics.GetPlayerController(gi, 0), null);
    if (pc && isValid(pc)) return pc;
    return null;
}

function getAllActorsOfClass(ctx, cls) {
    if (!cls) return [];
    const outRef = puerts.$ref(UE.NewArray(UE.Actor));
    safeCall(() => UE.GameplayStatics.GetAllActorsOfClass(ctx, cls, outRef));
    const arr = puerts.$unref(outRef);
    const res = [];
    if (arr && typeof arr.Num === "function") {
        for (let i = 0; i < arr.Num(); i++) {
            const a = safeCall(() => arr.Get(i), null);
            if (a && isValid(a)) res.push(a);
        }
    }
    return res;
}

// ---------------------------------------------------------------------------
// Finding UDW & UDS in any map
// ---------------------------------------------------------------------------

function findUdwAndUds(ctx) {
    let udw = null;
    let uds = null;

    // 1. Try WeatherSubsystem.GlobelWeatherObjects first (fastest & zero-alloc)
    const TsHelper = safeCall(() => require("Library/TsHelper").default, null);
    const wsCls = safeCall(() => UE.WeatherSubsystem.StaticClass(), null);
    if (wsCls) {
        const ws = (TsHelper && safeCall(() => TsHelper.getWorldSubsystem(ctx, wsCls), null))
            || safeCall(() => UE.SubsystemBlueprintLibrary.GetWorldSubsystem(ctx, wsCls), null);
        if (ws && ws.GlobelWeatherObjects && safeCall(() => ws.GlobelWeatherObjects.Num(), 0) > 0) {
            const cand = safeCall(() => ws.GlobelWeatherObjects.Get(0), null);
            if (cand && isValid(cand)) udw = cand;
        }
    }

    // 2. Fallback: GetAllActorsOfClass for UDW
    if (!udw) {
        for (const p of [UDW_CHILD_CLASS_PATH, UDW_CLASS_PATH]) {
            const cls = safeCall(() => UE.Class.Load(p), null);
            const found = getAllActorsOfClass(ctx, cls);
            if (found.length > 0) { udw = found[0]; break; }
        }
    }

    // 3. Try UDS reference on UDW
    if (udw && isValid(udw)) {
        for (const prop of ["UDS", "Ultra Dynamic Sky", "Ultra_Dynamic_Sky", "Target UDS"]) {
            const cand = safeCall(() => udw[prop], null);
            if (cand && isValid(cand)) { uds = cand; break; }
        }
    }

    // 4. Fallback: GetAllActorsOfClass for UDS
    if (!uds) {
        for (const p of [UDS_CHILD_CLASS_PATH, UDS_CLASS_PATH]) {
            const cls = safeCall(() => UE.Class.Load(p), null);
            const found = getAllActorsOfClass(ctx, cls);
            if (found.length > 0) { uds = found[0]; break; }
        }
    }

    return { udw, uds };
}

// ---------------------------------------------------------------------------
// Snapshot & Restore
// ---------------------------------------------------------------------------

const UDW_SNAPSHOT_PROPS = [
    "Cloud Coverage",
    "Cloud Coverage - Manual Override",
    "Fog",
    "Fog - Manual Override",
    "Rain",
    "Rain - Manual Override",
    "Snow",
    "Snow - Manual Override",
    "Dust",
    "Dust - Manual Override",
    "Wind Intensity",
    "Wind Intensity - Manual Override",
    "Thunder/Lightning - Manual Override",
    "Material Wetness",
    "Material Wetness - Manual Override",
    "Material Snow Coverage",
    "Material Snow Coverage - Manual Override",
    "Material Dust Coverage",
    "Material Dust Coverage - Manual Override",
    "Base Wetness when Clear",
    "Base Wetness when Raining",
    "Render Raindrop Decals",
    "Rain Volume",
    "RainAudio",
    "Enable Rain Sounds",
    "Close Thunder Volume",
    "Distant Thunder Volume",
    "Wind Volume",
    "LastRtpcValue_Rain",
    "Enable Rain Particles",
    "Enable Snow Particles",
    "Enable Dust Particles",
    "Enable Wind Debris",
    "Enable Post Process Wind Fog",
    "Max Material Wetness",
    "Max Material Snow Coverage",
    "Max Dust Coverage",
];

const UDS_SNAPSHOT_PROPS = [
    "Time of Day",
    "Sun Light Intensity",
    "Sky Light Intensity",
    "Overall Intensity",
    "Moon Light Intensity",
    "Night Brightness",
    "Scale Total Fog Density",
    "Scale Fog Density",
    "Height Fog Density",
    "Saturation",
    "North Yaw",
    "Sun Yaw",
    "Cloud Coverage",
    "Weather Cloud Coverage",
    "Weather Fog",
    "Only Fully Update Active Parameters When Cloud Coverage Changes",
];

function captureSimpleProps(obj) {
    if (!obj || !isValid(obj)) return null;
    const snap = {};
    let proto = obj;
    let d = 0;
    while (proto && d < 10) {
        if (proto === Object.prototype || proto === UE.Object?.prototype) break;
        for (const k of safeCall(() => Object.getOwnPropertyNames(proto), [])) {
            if (k === "constructor" || k.startsWith("__") || k === "StaticClass" || k in snap) continue;
            const desc = safeCall(() => Object.getOwnPropertyDescriptor(proto, k), null);
            if (!desc || typeof desc.get !== "function") continue;
            const v = safeCall(() => obj[k], undefined);
            const t = typeof v;
            if (t === "number" || t === "boolean" || t === "string") {
                snap[k] = v;
            }
        }
        proto = safeCall(() => Object.getPrototypeOf(proto), null);
        d++;
    }
    return snap;
}

function captureSnapshot(udw, uds) {
    origUdwState = null;
    origUdsState = null;
    origGlobalWeatherProps = null;
    if (udw && isValid(udw)) {
        origUdwState = {};
        for (const p of UDW_SNAPSHOT_PROPS) {
            const v = safeCall(() => udw[p], undefined);
            if (v !== undefined) origUdwState[p] = v;
        }
        const gws = safeCall(() => udw["Global Weather State"], null);
        if (gws && isValid(gws)) {
            origGlobalWeatherProps = captureSimpleProps(gws);
        }
    }
    if (uds && isValid(uds)) {
        origUdsState = {};
        for (const p of UDS_SNAPSHOT_PROPS) {
            const v = safeCall(() => uds[p], undefined);
            if (v !== undefined) origUdsState[p] = v;
        }
    }
    log(`Captured snapshot for ${currentLevelKey}: UDW=${!!origUdwState} (Rain=${origUdwState?.Rain}, Fog=${origUdwState?.Fog}, Cloud=${origUdwState?.["Cloud Coverage"]}, GWSProps=${origGlobalWeatherProps ? Object.keys(origGlobalWeatherProps).length : 0}), UDS=${!!origUdsState} (ToD=${origUdsState?.["Time of Day"]}, Sun=${origUdsState?.["Sun Light Intensity"]}, Sky=${origUdsState?.["Sky Light Intensity"]})`);
}

function setProp(obj, prop, val) {
    if (!obj || !isValid(obj) || val === undefined) return;
    safeCall(() => { obj[prop] = val; });
}

function refreshUdw(udw) {
    if (!udw || !isValid(udw)) return;
    setProp(udw, "Cloud Coverage Update Needed", true);
    setProp(udw, "Fog Update Needed", true);
    setProp(udw, "Rain Update Needed", true);
    setProp(udw, "Snow Update Needed", true);
    setProp(udw, "Dust Update Needed", true);
    setProp(udw, "Wind Intensity Update Needed", true);
    setProp(udw, "Material Wetness Update Needed", true);
    setProp(udw, "Material Snow Update Needed", true);
    setProp(udw, "Material Dust Update Needed", true);
    setProp(udw, "Current Weather State Changed", true);
    setProp(udw, "Global Weather Updated", true);
    setProp(udw, "Local Weather Updated", true);

    safeCall(() => udw["Set All Update Checks"]());
    safeCall(() => udw["Apply Manual State Override Values"]());
    safeCall(() => udw["Apply Current / Local Weather"]());
    safeCall(() => udw["Apply Current / Local Weather Src"]());
    safeCall(() => udw["Apply Max to Material Effects"]());
    safeCall(() => udw["Static Properties - Material Effects"]());
    safeCall(() => udw["Update Active Variables"]());
    safeCall(() => udw["Update Active Rain Parameters"]());
    safeCall(() => udw["Update Active Snow Parameters"]());
    safeCall(() => udw["Update Active Snow Parameters Src"]());
    safeCall(() => udw["Update Active Dust Parameters"]());
    safeCall(() => udw["Update Active Dust Parameters Src"]());
    safeCall(() => udw["Update Active Wind Debris Parameters"]());
    safeCall(() => udw["Update Active Wind Debris Parameters Src"]());
    safeCall(() => udw["Update Fog Particle Parameters"]());
    safeCall(() => udw["Update Fog Particle Parameters Src"]());
    safeCall(() => udw["Instant Sound Update"]());
}

function refreshUds(uds) {
    if (!uds || !isValid(uds)) return;
    // Safely rebuild UDS lighting/cloud cache without calling Hard Reset Cache or raw render-thread calls
    setProp(uds, "Only Fully Update Active Parameters When Cloud Coverage Changes", false);
    setProp(uds, "ForceUpdateCache", true);

    safeCall(() => uds["Cache Sun and Moon Orientation"]());
    safeCall(() => uds["Cache Properties"]());
    safeCall(() => uds["Set Cache Alpha"](1.0));

    safeCall(() => uds["Update Directional Light Rotations"]());
    safeCall(() => uds["Update Variables Controlled By Weather"]());
    safeCall(() => uds["Update Active Variables"]());
    safeCall(() => uds["Update Forced Active Variables"]());
    safeCall(() => uds["Update High Priority Properties"]());
    safeCall(() => uds["Update Low Priority Properties"]());
    safeCall(() => uds["Update Non-Cached Active Properties"]());
    safeCall(() => uds["Update Dynamic Sky Light Multiplier"]());
    safeCall(() => uds["Update Global Volumetric Fog Material"]());
    safeCall(() => uds["Update Current Volumetric Clouds MID"]());
    safeCall(() => uds["ForceSkyTick"]());

    // Only recapture the primary active SkyLight if it is registered & active
    const sl = safeCall(() => uds["SkyLightComponent"], null);
    if (sl && isValid(sl) && safeCall(() => sl.IsActive(), false)) {
        safeCall(() => sl.RecaptureSky());
    }

    // Also call BPF_WeatherUtilities.ForceUpdateUDSCache if available
    const utilCls = safeCall(() => UE.Class.Load(WEATHER_UTIL_PATH), null);
    if (utilCls) {
        const jsUtil = safeCall(() => puerts.blueprint.tojs(utilCls), null);
        if (jsUtil && typeof jsUtil.ForceUpdateUDSCache === "function") {
            safeCall(() => jsUtil.ForceUpdateUDSCache(uds));
        }
    }
}

function syncWwiseRainAudio(ctx, rainAmount, thunderActive) {
    const ak = safeCall(() => UE.AkGameplayStatics, null);
    if (!ak) return;

    const rtpcRain = safeCall(() => UE.Object.Load(WWISE_RTPC_RAIN), null);
    const rtpcPlaying = safeCall(() => UE.Object.Load(WWISE_RTPC_RAIN_PLAYING), null);
    const rtpcAmbVol = safeCall(() => UE.Object.Load(WWISE_RTPC_AMB_VOL), null);

    if (rainAmount <= 0.001) {
        // Silence Wwise rain RTPCs & state safely (no raw PostEventAtLocation to avoid C++ signature crashes)
        if (rtpcRain && isValid(rtpcRain)) safeCall(() => ak.SetRTPCValue(rtpcRain, 0.0, 200, null, "Rain"));
        if (rtpcPlaying && isValid(rtpcPlaying)) safeCall(() => ak.SetRTPCValue(rtpcPlaying, 0.0, 200, null, "Rain_Playing"));
        if (rtpcAmbVol && isValid(rtpcAmbVol)) safeCall(() => ak.SetRTPCValue(rtpcAmbVol, 0.0, 200, null, "Amb_Weather_Volume"));
        const stNone = safeCall(() => UE.Object.Load(WWISE_STATE_RAIN_NONE), null);
        if (stNone && isValid(stNone)) safeCall(() => ak.SetState(stNone, "Weather_Rain", "None"));
    } else {
        const rtpcVal = Math.min(100.0, Math.max(10.0, rainAmount * 15.0));
        if (rtpcAmbVol && isValid(rtpcAmbVol)) safeCall(() => ak.SetRTPCValue(rtpcAmbVol, 100.0, 200, null, "Amb_Weather_Volume"));
        if (rtpcRain && isValid(rtpcRain)) safeCall(() => ak.SetRTPCValue(rtpcRain, rtpcVal, 200, null, "Rain"));
        if (rtpcPlaying && isValid(rtpcPlaying)) safeCall(() => ak.SetRTPCValue(rtpcPlaying, 1.0, 200, null, "Rain_Playing"));
        const stOut = safeCall(() => UE.Object.Load(WWISE_STATE_RAIN_OUTSIDE), null);
        if (stOut && isValid(stOut)) safeCall(() => ak.SetState(stOut, "Weather_Rain", "Outside"));
    }
}

function syncUdwAudio(ctx, udw, rainAmount, windAmount, isThunder) {
    if (!udw || !isValid(udw)) return;
    const isRaining = rainAmount > 0.001;
    setProp(udw, "Enable Rain Sounds", isRaining);
    setProp(udw, "Rain Volume", isRaining ? 1.0 : 0.0);
    setProp(udw, "RainAudio", isRaining ? 1.0 : 0.0);
    setProp(udw, "LastRtpcValue_Rain", isRaining ? Math.min(100, rainAmount * 15) : 0.0);
    setProp(udw, "Close Thunder Volume", isThunder ? 1.0 : 0.0);
    setProp(udw, "Distant Thunder Volume", isThunder ? 1.0 : 0.0);
    setProp(udw, "Wind Volume", windAmount > 1.2 ? 1.0 : 0.35);

    safeCall(() => udw["Apply Sound Effects Volume Levels"]());
    safeCall(() => udw["Update Sounds With Weather State"]());
    safeCall(() => udw["Instant Sound Update"]());
    safeCall(() => udw["Audio Update"]());

    syncWwiseRainAudio(ctx, rainAmount, isThunder);
}

function setRainDripActorsHidden(ctx, hidden) {
    if (dripActorsHidden === hidden) return;
    const allActors = getAllActorsOfClass(ctx, UE.Actor.StaticClass());
    let count = 0;
    for (const a of allActors) {
        const cls = safeCall(() => String(a.GetClass().GetName()), "");
        if (cls.includes("RainDrip") || cls.includes("Rain_Drip")) {
            safeCall(() => a.SetActorHiddenInGame(hidden));
            count++;
        }
    }
    dripActorsHidden = hidden;
    if (count > 0) {
        log(`${hidden ? "Hid" : "Restored"} ${count} rain drip actor(s)`);
    }
}

function restoreUdwOriginal(ctx, udw, uds) {
    if (!udw || !isValid(udw) || !origUdwState) return;

    // 1. Restore original Global Weather State object fields and trigger instant Change Weather back to it
    const gws = safeCall(() => udw["Global Weather State"], null);
    if (gws && isValid(gws) && origGlobalWeatherProps) {
        for (const [k, v] of Object.entries(origGlobalWeatherProps)) {
            setProp(gws, k, v);
        }
        safeCall(() => udw["Change Weather"](gws, 0.0));
        setProp(udw, "Transition Active", false);
        setProp(udw, "Transition Alpha", 1.0);
    }

    // 2. Restore all snapshot UDW properties (including manual overrides, rain/snow/dust, wetness, caps)
    for (const [k, v] of Object.entries(origUdwState)) {
        setProp(udw, k, v);
    }

    // 3. Restore particle components visibility/activation to match original weather
    const origRain = Number(origUdwState["Rain"] || 0);
    const origSnow = Number(origUdwState["Snow"] || 0);
    const origDust = Number(origUdwState["Dust"] || 0);
    if (origRain <= 0) {
        setProp(udw, "Rain System Spawning", false);
        deactivateAllMatchingNiagara(udw, "Rain_Particles", ["rain"]);
    } else {
        setProp(udw, "Enable Rain Particles", true);
        setProp(udw, "Rain System Spawning", true);
        ensureNiagaraParticleActive(
            udw, "Rain_Particles",
            "/Weather/OurWeather/Pariticles/Rain.Rain",
            "Rain Particle Niagara System",
            "Make Rain Component", "Static Properties - Rain",
            "Rain System Spawning"
        );
    }
    if (origSnow <= 0) {
        setProp(udw, "Snow System Spawning", false);
        deactivateAllMatchingNiagara(udw, "Snow_Particles", ["snow"]);
    } else {
        setProp(udw, "Enable Snow Particles", true);
        setProp(udw, "Snow System Spawning", true);
        ensureNiagaraParticleActive(
            udw, "Snow_Particles",
            "/Weather/OurWeather/Pariticles/Snow.Snow",
            "Snow Particle Niagara System",
            "Make Snow Component", "Static Properties - Snow",
            "Snow System Spawning"
        );
    }
    if (origDust <= 0) {
        setProp(udw, "Dust System Spawning", false);
        deactivateAllMatchingNiagara(udw, "Dust_Particles", ["dust", "debris"]);
    } else {
        setProp(udw, "Enable Dust Particles", true);
        setProp(udw, "Dust System Spawning", true);
        ensureNiagaraParticleActive(
            udw, "Dust_Particles",
            "/Weather/OurWeather/Pariticles/Dust.Dust",
            "Dust Particle Niagara System",
            "Make Dust Component", "Static Properties - Dust",
            "Dust System Spawning"
        );
    }

    // Restore UDS weather cloud/fog fields too
    if (uds && isValid(uds) && origUdsState) {
        if (origUdsState["Cloud Coverage"] !== undefined) {
            setProp(uds, "Cloud Coverage", origUdsState["Cloud Coverage"]);
        }
        if (origUdsState["Weather Cloud Coverage"] !== undefined) {
            setProp(uds, "Weather Cloud Coverage", origUdsState["Weather Cloud Coverage"]);
        }
        if (origUdsState["Weather Fog"] !== undefined) {
            setProp(uds, "Weather Fog", origUdsState["Weather Fog"]);
        }
    }

    // Restore original Wwise & UDW rain audio
    syncWwiseRainAudio(ctx, origRain, false);
    safeCall(() => udw["Apply Sound Effects Volume Levels"]());
    safeCall(() => udw["Update Sounds With Weather State"]());
    safeCall(() => udw["Instant Sound Update"]());

    refreshUdw(udw);
    if (ctx) {
        setRainDripActorsHidden(ctx, false);
    }
}

function restoreOriginal(ctx) {
    restoreUdwOriginal(ctx, currentUdw, currentUds);
    if (currentUds && isValid(currentUds) && origUdsState) {
        for (const [k, v] of Object.entries(origUdsState)) {
            setProp(currentUds, k, v);
        }
        const origTod = origUdsState["Time of Day"];
        if (origTod !== undefined) {
            setProp(currentUds, "Internal Time of Day", origTod);
            setProp(currentUds, "Replicated Time of Day", origTod);
            const udsFuncsCls = safeCall(() => UE.Class.Load(UDS_FUNCS_PATH), null);
            if (udsFuncsCls) {
                const jsFuncs = safeCall(() => puerts.blueprint.tojs(udsFuncsCls), null);
                const setTodFn = jsFuncs && jsFuncs["Set Time of Day · 𝖴𝖣𝖲"];
                if (typeof setTodFn === "function") {
                    safeCall(() => setTodFn(currentUds, origTod));
                }
            }
        }
        refreshUds(currentUds);
    }
    log(`Restored original weather & lighting for ${currentLevelKey}`);
}

// ---------------------------------------------------------------------------
// Applying Weather & Lighting
// ---------------------------------------------------------------------------

function deactivateAllMatchingNiagara(udw, compProp, keywords) {
    if (!udw || !isValid(udw)) return;
    const stopComp = (c) => {
        if (!c || !isValid(c)) return;
        safeCall(() => {
            c.Deactivate();
            c.SetVisibility(false, true);
            c.SetHiddenInGame(true, true);
        });
    };

    if (compProp) {
        stopComp(safeCall(() => udw[compProp], null));
    }

    // Also sweep ALL NiagaraComponents on UDW so any dynamically created duplicate/orphan
    // Rain/Snow/Dust components (e.g. from Make*Component) are guaranteed to stop!
    const comps = safeCall(() => udw.K2_GetComponentsByClass(UE.NiagaraComponent.StaticClass()), null);
    if (comps && typeof comps.Num === "function") {
        for (let i = 0; i < comps.Num(); i++) {
            const c = safeCall(() => comps.Get(i), null);
            if (!c || !isValid(c)) continue;
            const cName = safeCall(() => String(c.GetName()).toLowerCase(), "");
            const asset = safeCall(() => c.GetAsset(), null);
            const aName = asset && isValid(asset) ? safeCall(() => String(asset.GetName()).toLowerCase(), "") : "";
            if (keywords.some((kw) => cName.includes(kw) || aName.includes(kw))) {
                stopComp(c);
            }
        }
    }
}

function ensureNiagaraParticleActive(udw, compProp, assetPath, fallbackAssetProp, makeFnName, staticFnName, spawnFlagProp) {
    let comp = safeCall(() => udw[compProp], null);
    let curAsset = comp && isValid(comp) ? safeCall(() => comp.GetAsset(), null) : null;

    // CRITICAL: Only call Make*Component when the component or its asset is genuinely missing!
    // Calling Make*Component repeatedly spawns duplicate orphan NiagaraComponents that never stop!
    if (!comp || !isValid(comp) || !curAsset || !isValid(curAsset)) {
        if (spawnFlagProp) setProp(udw, spawnFlagProp, false);
        if (makeFnName) safeCall(() => udw[makeFnName]());
        comp = safeCall(() => udw[compProp], null);
        curAsset = comp && isValid(comp) ? safeCall(() => comp.GetAsset(), null) : null;
    }

    if (!comp || !isValid(comp)) {
        log(`Particle component ${compProp} not found after ${makeFnName}`);
        return;
    }

    if (!curAsset || !isValid(curAsset)) {
        let sys = (fallbackAssetProp && safeCall(() => udw[fallbackAssetProp], null)) || null;
        if (!sys || !isValid(sys)) {
            sys = safeCall(() => UE.NiagaraSystem.Load(assetPath), null)
                || safeCall(() => UE.Object.Load(assetPath), null);
        }
        if (sys && isValid(sys)) {
            safeCall(() => comp.SetAsset(sys, true));
            curAsset = safeCall(() => comp.GetAsset(), null);
        }
    }

    safeCall(() => udw["Static Properties - Shared Particles"]());
    if (staticFnName) safeCall(() => udw[staticFnName]());
    safeCall(() => udw["Set Shared Weather Particle Parameters"]());

    safeCall(() => {
        comp.SetComponentTickEnabled(true);
        comp.SetVisibility(true, true);
        comp.SetHiddenInGame(false, true);
        if (!comp.IsActive()) comp.Activate(true);
    });
    log(`Activated ${compProp}: asset=${curAsset ? safeCall(() => String(curAsset.GetName()), "?") : "null"}, active=${safeCall(() => comp.IsActive(), "?")}`);
}

function deactivateNiagaraParticle(udw, compProp) {
    const comp = safeCall(() => udw[compProp], null);
    if (comp && isValid(comp)) {
        safeCall(() => {
            comp.Deactivate();
            comp.SetVisibility(false, true);
            comp.SetHiddenInGame(true, true);
        });
    }
}

function applyWeather(ctx, udw, uds) {
    if (!udw || !isValid(udw)) return;

    if (config.weatherPreset === "default") {
        // Restore only weather fields & Global Weather State to original
        restoreUdwOriginal(ctx, udw, uds);
        return;
    }

    const preset = WEATHER_PRESETS[config.weatherPreset];
    if (!preset) return;

    // 1. Load official UDS_Weather_Settings asset & call INSTANT Change Weather (0.0s)
    //    Using 0.0s prevents lingering UDW transition timers from locking weather back into heavy rain!
    const assetPath = `${PRESET_BASE}${preset.asset}.${preset.asset}`;
    const presetObj = safeCall(() => UE.Object.Load(assetPath), null);
    if (presetObj && isValid(presetObj)) {
        setProp(udw, "Override with New Changes", true);
        safeCall(() => udw["Change Weather"](presetObj, 0.0));
        setProp(udw, "Transition Active", false);
        setProp(udw, "Transition Alpha", 1.0);
        setProp(udw, "Transition Timer", 0.0);
    }

    // 2. Override manual state flags so map-specific manual overrides (like Pangzhen's Fog=1 / Cloud=5)
    //    never lock the weather back to overcast/rainy!
    setProp(udw, "Cloud Coverage - Manual Override", true);
    setProp(udw, "Cloud Coverage", preset.cloud);

    setProp(udw, "Fog - Manual Override", true);
    setProp(udw, "Fog", preset.fog * config.fogScale);

    setProp(udw, "Rain - Manual Override", true);
    setProp(udw, "Rain", preset.rain);

    setProp(udw, "Snow - Manual Override", true);
    setProp(udw, "Snow", preset.snow);

    setProp(udw, "Dust - Manual Override", true);
    setProp(udw, "Dust", preset.dust);

    setProp(udw, "Wind Intensity - Manual Override", true);
    setProp(udw, "Wind Intensity", preset.wind);

    setProp(udw, "Thunder/Lightning - Manual Override", true);

    // 3. Clear stale material coverage (e.g. leftover snow when switching Blizzard -> Sandstorm)
    safeCall(() => udw["Clear All Material Parameters to Zero Coverage"]());

    // 4. Enable required particle systems & sweep/deactivate any inactive ones cleanly
    if (preset.rain > 0) {
        setProp(udw, "Enable Rain Particles", true);
        setProp(udw, "Max Material Wetness", Math.max(origUdwState?.["Max Material Wetness"] ?? 0.7, 1.0));
        ensureNiagaraParticleActive(
            udw, "Rain_Particles",
            "/Weather/OurWeather/Pariticles/Rain.Rain",
            "Rain Particle Niagara System",
            "Make Rain Component", "Static Properties - Rain",
            "Rain System Spawning"
        );
    } else {
        setProp(udw, "Enable Rain Particles", false);
        setProp(udw, "Rain System Spawning", false);
        setProp(udw, "Old Rain", 0.0);
        deactivateAllMatchingNiagara(udw, "Rain_Particles", ["rain"]);
    }

    if (preset.snow > 0) {
        setProp(udw, "Enable Snow Particles", true);
        setProp(udw, "Max Material Snow Coverage", 1.0);
        setProp(udw, "Material Snow Coverage - Manual Override", true);
        setProp(udw, "Material Snow Coverage", preset.matSnow);
        ensureNiagaraParticleActive(
            udw, "Snow_Particles",
            "/Weather/OurWeather/Pariticles/Snow.Snow",
            "Snow Particle Niagara System",
            "Make Snow Component", "Static Properties - Snow",
            "Snow System Spawning"
        );
    } else {
        setProp(udw, "Enable Snow Particles", false);
        setProp(udw, "Snow System Spawning", false);
        setProp(udw, "Old Snow", 0.0);
        setProp(udw, "Max Material Snow Coverage", 0.0);
        setProp(udw, "Material Snow Coverage - Manual Override", true);
        setProp(udw, "Material Snow Coverage", 0.0);
        setProp(udw, "Shared Material Parameter Snowy", 0.0);
        setProp(udw, "Dynamic Snow/Dust", 0.0);
        setProp(udw, "NeedToUpdateSnowNormal", true);
        deactivateAllMatchingNiagara(udw, "Snow_Particles", ["snow"]);
    }

    if (preset.dust > 0) {
        setProp(udw, "Enable Dust Particles", true);
        setProp(udw, "Max Dust Coverage", 1.0);
        setProp(udw, "Enable Wind Debris", true);
        setProp(udw, "Enable Post Process Wind Fog", true);
        setProp(udw, "Material Dust Coverage - Manual Override", true);
        setProp(udw, "Material Dust Coverage", preset.matDust);
        ensureNiagaraParticleActive(
            udw, "Dust_Particles",
            "/Weather/OurWeather/Pariticles/Dust.Dust",
            "Dust Particle Niagara System",
            "Make Dust Component", "Static Properties - Dust",
            "Dust System Spawning"
        );
    } else {
        setProp(udw, "Enable Dust Particles", false);
        setProp(udw, "Dust System Spawning", false);
        setProp(udw, "Wind Debris System Spawning", false);
        setProp(udw, "Max Dust Coverage", 0.0);
        setProp(udw, "Material Dust Coverage - Manual Override", true);
        setProp(udw, "Material Dust Coverage", 0.0);
        setProp(udw, "Shared Material Parameter Dusty", 0.0);
        if (origUdwState && origUdwState["Enable Post Process Wind Fog"] !== undefined) {
            setProp(udw, "Enable Post Process Wind Fog", origUdwState["Enable Post Process Wind Fog"]);
        }
        deactivateAllMatchingNiagara(udw, "Dust_Particles", ["dust", "debris"]);
    }

    // 5. Dry ground / wetness handling
    if (preset.dry && config.dryGround) {
        setProp(udw, "Material Wetness - Manual Override", true);
        setProp(udw, "Material Wetness", 0.0);
        setProp(udw, "Base Wetness when Clear", 0.0);
        setProp(udw, "Render Raindrop Decals", false);
        setProp(udw, "Rain Volume", 0.0);
        setRainDripActorsHidden(ctx, true);
    } else {
        setProp(udw, "Material Wetness - Manual Override", true);
        setProp(udw, "Material Wetness", preset.wet);
        setProp(udw, "Render Raindrop Decals", !preset.dry);
        setProp(udw, "Rain Volume", preset.dry ? 0.0 : 1.0);
        setRainDripActorsHidden(ctx, preset.dry);
    }

    // Also sync UDS cloud coverage & fog directly so Clear/Partly Cloudy/Cloudy/Overcast visibly change clouds
    if (uds && isValid(uds)) {
        // UDS legacy cloud coverage range is 0..3; UDW cloud coverage is 0..10
        const udsCloud = Math.min(3.0, Math.max(0.0, (preset.cloud / 10.0) * 3.0));
        setProp(uds, "Cloud Coverage", udsCloud);
        setProp(uds, "Weather Cloud Coverage", udsCloud);
        setProp(uds, "Weather Fog", preset.fog * config.fogScale);
    }

    // Sync UDW + Wwise rain/thunder audio so rain sound stops cleanly in sunny/dry weather
    syncUdwAudio(ctx, udw, preset.rain, preset.wind, preset.asset === "Rain_Thunderstorm");

    refreshUdw(udw);
}

function applyLighting(uds) {
    if (!uds || !isValid(uds) || !origUdsState) return;

    // 1. Time of Day
    let targetTod = origUdsState["Time of Day"];
    if (config.timePreset !== "default") {
        const parsed = Number(config.timePreset);
        if (Number.isFinite(parsed)) targetTod = parsed;
    }

    if (targetTod !== undefined) {
        setProp(uds, "Time of Day", targetTod);
        setProp(uds, "Internal Time of Day", targetTod);
        setProp(uds, "Replicated Time of Day", targetTod);
        const udsFuncsCls = safeCall(() => UE.Class.Load(UDS_FUNCS_PATH), null);
        if (udsFuncsCls) {
            const jsFuncs = safeCall(() => puerts.blueprint.tojs(udsFuncsCls), null);
            const setTodFn = jsFuncs && jsFuncs["Set Time of Day · 𝖴𝖣𝖲"];
            if (typeof setTodFn === "function") {
                safeCall(() => setTodFn(uds, targetTod));
            }
        }
    }

    // 2. Sun & Sky Light Intensity multipliers
    if (origUdsState["Sun Light Intensity"] !== undefined) {
        setProp(uds, "Sun Light Intensity", origUdsState["Sun Light Intensity"] * config.sunIntensity);
    }
    if (origUdsState["Sky Light Intensity"] !== undefined) {
        setProp(uds, "Sky Light Intensity", origUdsState["Sky Light Intensity"] * config.skyIntensity);
    }
    if (origUdsState["Overall Intensity"] !== undefined) {
        // Gentle blend with sun/sky average so overall lighting responds naturally
        const avgMul = (config.sunIntensity + config.skyIntensity) * 0.5;
        setProp(uds, "Overall Intensity", origUdsState["Overall Intensity"] * avgMul);
    }

    // 3. Fog density scale
    if (origUdsState["Scale Total Fog Density"] !== undefined) {
        setProp(uds, "Scale Total Fog Density", origUdsState["Scale Total Fog Density"] * config.fogScale);
    }
    if (origUdsState["Scale Fog Density"] !== undefined) {
        setProp(uds, "Scale Fog Density", origUdsState["Scale Fog Density"] * config.fogScale);
    }
    if (origUdsState["Height Fog Density"] !== undefined) {
        setProp(uds, "Height Fog Density", origUdsState["Height Fog Density"] * config.fogScale);
    }

    // 4. Saturation
    if (origUdsState["Saturation"] !== undefined) {
        setProp(uds, "Saturation", origUdsState["Saturation"] * config.saturation);
    }

    // 5. Sun angle / North yaw offset
    if (origUdsState["North Yaw"] !== undefined) {
        setProp(uds, "North Yaw", origUdsState["North Yaw"] + config.sunAngleOffset);
    }

    refreshUds(uds);
}

function isAllDefault() {
    return (
        config.weatherPreset === "default" &&
        config.timePreset === "default" &&
        Math.abs(config.sunIntensity - 1.0) < 0.001 &&
        Math.abs(config.skyIntensity - 1.0) < 0.001 &&
        Math.abs(config.fogScale - 1.0) < 0.001 &&
        Math.abs(config.saturation - 1.0) < 0.001 &&
        Math.abs(config.sunAngleOffset) < 0.001
    );
}

function hasStateDrifted(udw, uds) {
    if (!config.enabled || isAllDefault()) return false;
    if (udw && isValid(udw) && config.weatherPreset !== "default") {
        const preset = WEATHER_PRESETS[config.weatherPreset];
        if (preset) {
            const curRain = safeCall(() => Number(udw["Rain"]), preset.rain);
            const curSnow = safeCall(() => Number(udw["Snow"]), preset.snow);
            const curDust = safeCall(() => Number(udw["Dust"]), preset.dust);
            const curCloud = safeCall(() => Number(udw["Cloud Coverage"]), preset.cloud);
            if (Math.abs(curRain - preset.rain) > 0.25 ||
                Math.abs(curSnow - preset.snow) > 0.25 ||
                Math.abs(curDust - preset.dust) > 0.25 ||
                Math.abs(curCloud - preset.cloud) > 0.4) {
                return true;
            }
        }
    }
    if (uds && isValid(uds) && config.timePreset !== "default") {
        const targetTod = Number(config.timePreset);
        const curTod = safeCall(() => Number(uds["Time of Day"]), targetTod);
        if (Number.isFinite(targetTod) && Math.abs(curTod - targetTod) > 15) {
            return true;
        }
    }
    return false;
}

function getConfigSig() {
    return JSON.stringify(config);
}

function applyAll(force = false) {
    const ctx = getWorldContext();
    if (!ctx) return;

    const levelName = safeCall(() => String(UE.GameplayStatics.GetCurrentLevelName(ctx, false)), "");
    if (!levelName || /Entry|Login|Title|Start|MainMenu/i.test(levelName)) return;

    const { udw, uds } = findUdwAndUds(ctx);
    if (!udw && !uds) return;

    const udwPath = udw ? safeCall(() => String(UE.KismetSystemLibrary.GetPathName(udw)), "") : "";
    const udsPath = uds ? safeCall(() => String(UE.KismetSystemLibrary.GetPathName(uds)), "") : "";
    const levelKey = `${levelName}|${udwPath}|${udsPath}`;

    if (levelKey !== currentLevelKey) {
        currentLevelKey = levelKey;
        currentUdw = udw;
        currentUds = uds;
        dripActorsHidden = false;
        hasOverridden = false;
        captureSnapshot(udw, uds);
        lastAppliedSig = "";
        force = true;
    } else {
        currentUdw = udw;
        currentUds = uds;
    }

    const sig = getConfigSig();
    if (!force && sig === lastAppliedSig) {
        // Drift Guard: if a map trigger or UDW transition pushed rain/clouds/time back, re-apply!
        if (hasStateDrifted(udw, uds)) {
            log(`Drift detected on ${levelName} (likely map weather trigger); re-applying user settings`);
        } else {
            return;
        }
    }
    lastAppliedSig = sig;

    if (!config.enabled || isAllDefault()) {
        if (hasOverridden) {
            restoreOriginal(ctx);
            hasOverridden = false;
        }
        return;
    }

    applyWeather(ctx, udw, uds);
    applyLighting(uds);
    hasOverridden = true;
    log(`Applied settings on ${levelName}: weather=${config.weatherPreset}, time=${config.timePreset}, sun=${config.sunIntensity}x, sky=${config.skyIntensity}x, fog=${config.fogScale}x, sat=${config.saturation}x, dry=${config.dryGround}, yaw=${config.sunAngleOffset}`);
}

// ---------------------------------------------------------------------------
// PBZModsMenu Registration
// ---------------------------------------------------------------------------

function label(en, zh) {
    return { en, "zh-Hans": zh, "zh-Hant": zh };
}

function registerMenu() {
    const menu = globalThis.PBZModsMenu || (globalThis.PBZModsMenu = []);
    menu.push({
        id: MOD_ID,
        title: label("Weather & Lighting", "天气与光照控制"),
        description: label(
            "Change weather, time of day, sunlight, sky light, and fog in any map in real time.",
            "在任意当前地图实时切换天气、时间段、阳光/环境光照、雾效与地面湿度，支持随时恢复地图原版。"
        ),
        version: VERSION,
        file: SETTINGS_FILE,
        settings: [
            {
                key: "enabled",
                type: "toggle",
                label: label("Enable Weather Control", "启用天气与光照覆盖"),
                default: DEFAULT_CONFIG.enabled,
                help: label(
                    "Turn off to immediately restore the current map's original weather and lighting.",
                    "关闭后立即无损恢复当前地图的原版天气与光照。"
                ),
            },
            {
                key: "weatherPreset",
                type: "choice",
                label: label("Weather Preset", "天气预设"),
                default: DEFAULT_CONFIG.weatherPreset,
                options: [
                    { value: "default",           label: label("Map Default", "地图原版") },
                    { value: "Clear_Skies",       label: label("Clear Skies", "晴空万里") },
                    { value: "Partly_Cloudy",     label: label("Partly Cloudy", "晴间多云") },
                    { value: "Cloudy",            label: label("Cloudy", "多云") },
                    { value: "Overcast",          label: label("Overcast", "阴天") },
                    { value: "Foggy",             label: label("Foggy", "浓雾") },
                    { value: "Rain_Light",        label: label("Light Rain", "小雨") },
                    { value: "Rain",              label: label("Rain", "中雨") },
                    { value: "Rain_Thunderstorm", label: label("Thunderstorm", "雷暴雨") },
                    { value: "Snow_Light",        label: label("Light Snow", "小雪") },
                    { value: "Snow",              label: label("Snow", "大雪") },
                    { value: "Snow_Blizzard",     label: label("Blizzard", "暴风雪") },
                    { value: "Sand_Dust_Calm",    label: label("Dusty", "扬沙") },
                    { value: "Sand_Dust_Storm",   label: label("Sandstorm", "沙尘暴") },
                ],
                help: label(
                    "Switch the current map's weather in real time (e.g. Clear Skies in Pangzhen).",
                    "实时切换当前地图天气（例如将庞镇改为晴空万里或飘雪）。"
                ),
            },
            {
                key: "timePreset",
                type: "choice",
                label: label("Time of Day / Lighting", "时间段 / 光照氛围"),
                default: DEFAULT_CONFIG.timePreset,
                options: [
                    { value: "default", label: label("Map Default", "地图原版") },
                    { value: "580",     label: label("Dawn (05:48)", "黎明破晓 (05:48)") },
                    { value: "800",     label: label("Morning (08:00)", "清晨阳光 (08:00)") },
                    { value: "1200",    label: label("Noon (12:00)", "正午烈日 (12:00)") },
                    { value: "1550",    label: label("Afternoon (15:30)", "午后暖阳 (15:30)") },
                    { value: "1760",    label: label("Sunset (17:36)", "黄昏夕阳 (17:36)") },
                    { value: "1900",    label: label("Dusk (19:00)", "暮色微光 (19:00)") },
                    { value: "2250",    label: label("Night (22:30)", "深夜月光 (22:30)") },
                ],
                help: label(
                    "Quickly switch sun elevation and lighting mood for the current map.",
                    "一键切换当前地图的太阳高度与整体光照氛围。"
                ),
            },
            {
                key: "sunIntensity",
                type: "number",
                label: label("Sunlight Intensity", "阳光强度倍率"),
                min: 0,
                max: 4,
                step: 0.1,
                default: DEFAULT_CONFIG.sunIntensity,
                help: label(
                    "Multiplier on the map's directional sunlight intensity (1.0 = default).",
                    "调节主阳光亮度倍率（1.0 = 地图原版，调高更通透明亮）。"
                ),
            },
            {
                key: "skyIntensity",
                type: "number",
                label: label("Sky / Ambient Light", "环境天光倍率"),
                min: 0,
                max: 4,
                step: 0.1,
                default: DEFAULT_CONFIG.skyIntensity,
                help: label(
                    "Multiplier on ambient sky light intensity (brightens dark shadows).",
                    "调节环境天光倍率（1.0 = 地图原版，调高可提亮阴影暗部）。"
                ),
            },
            {
                key: "fogScale",
                type: "number",
                label: label("Fog Density Scale", "雾效浓度倍率"),
                min: 0,
                max: 2,
                step: 0.1,
                default: DEFAULT_CONFIG.fogScale,
                help: label(
                    "0.0 removes heavy fog for clear visibility; 1.0 keeps default fog density.",
                    "设为 0.0 可去除浓雾让远景通透，1.0 为原版浓度。"
                ),
            },
            {
                key: "saturation",
                type: "number",
                label: label("Color Saturation", "色彩饱和度"),
                min: 0.2,
                max: 2.0,
                step: 0.05,
                default: DEFAULT_CONFIG.saturation,
                help: label(
                    "Adjusts UDS lighting color saturation (1.0 = default).",
                    "调节天气光照色彩饱和度（1.0 = 原版）。"
                ),
            },
            {
                key: "dryGround",
                type: "toggle",
                label: label("Dry Ground in Clear Weather", "晴朗天气自动烘干地面"),
                default: DEFAULT_CONFIG.dryGround,
                help: label(
                    "Removes ground wetness and hides eaves rain-drip particles when switching to non-rainy weather.",
                    "切换至晴天/多云等无雨天气时，同步消除地面潮湿反光并隐藏房檐滴水粒子。"
                ),
            },
            {
                key: "sunAngleOffset",
                type: "number",
                label: label("Sun Direction Offset (°)", "太阳方位角偏移（度）"),
                min: -180,
                max: 180,
                step: 15,
                default: DEFAULT_CONFIG.sunAngleOffset,
                help: label(
                    "Rotates sun direction horizontally to change shadow and rim-lighting angles.",
                    "水平旋转太阳光照方向，改变建筑投影与逆光/顺光角度。"
                ),
            },
        ],
        onChange: (key, value) => {
            applyConfigValue(key, value);
            applyAll(true);
        },
    });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function stop() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    const ctx = getWorldContext();
    if (ctx) {
        safeCall(() => restoreOriginal(ctx));
    }
    exports.ready = false;
}

exports.stop = stop;
exports.ready = false;

log(`=== ${MOD_ID} ${VERSION} starting ===`);
loadSettingsFromDisk();
registerMenu();

pollTimer = setInterval(() => {
    try { applyAll(false); } catch (e) { log("Poll error: " + e); }
}, 1500);

exports.ready = true;
