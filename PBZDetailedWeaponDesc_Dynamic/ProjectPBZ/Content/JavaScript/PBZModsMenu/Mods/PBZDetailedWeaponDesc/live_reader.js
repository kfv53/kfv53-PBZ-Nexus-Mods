"use strict";

// live_reader.js — Lazy on-demand runtime reader for PBZDetailedWeaponDesc (Dynamic Edition)
// Reads live BulletData.DamageData, UpLevelData.GEUIDataArray, and upgrade GEComponents directly
// from game memory whenever a weapon is viewed, so changes from other weapon/combat rebalance mods
// are reflected automatically. Falls back seamlessly to static weapon_data.js on any miss.

const UE = require("ue");
const puerts = require("puerts");

const PK = "Damage.Attack.Target.PhysicalDamage";
const AK = "Damage.Attack.Target.AngerDamage";
const EK = "Damage.Attack.Target.ElementDamage";

const BULLET_ROOT = "/PBZCombatAsset/ActorData/Players/Hun/BulletData/";
const SKIP_RE = /(OldTimeline|_Old$|_Old_|Test|Temp|Archive|Backup|Debug|Unused|Copy|Deprecated|ForWuXuan|Alert$|Spawner$)/i;

// equipDescKey -> { dirs, elemZh, elemEn, isRanged, isShaChi }
const WEAPON_DIR_MAP = {
    // Main weapons
    WeaponDes_000: { dirs: ["TangBlade/WoodenSword"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_001: { dirs: ["TangBlade/Default"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_002: { dirs: ["Iron/Default"], elemZh: "流血", elemEn: "Bleed", isRanged: false },
    WeaponDes_003: { dirs: ["LuanYing"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_004: { dirs: ["ChaosBlade"], elemZh: "元素", elemEn: "Elem", isRanged: false },
    WeaponDes_005: { dirs: ["HeiMoShang"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_007: { dirs: ["BronzeSword"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_008: { dirs: ["ChiZheCanJian/Use"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_009: { dirs: ["SlitheringSword/Attack"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_010: { dirs: ["BaiShanFengLeiJian"], elemZh: "风雷", elemEn: "Elem", isRanged: false },
    WeaponDes_011: { dirs: ["ZiMingJian"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_012: { dirs: ["LongBlade/Default"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_013: { dirs: ["ZhanMaBlade"], elemZh: "流血", elemEn: "Bleed", isRanged: false },
    WeaponDes_014: { dirs: ["LongBlade/ChiRen"], elemZh: "燃烧", elemEn: "Ignite", isRanged: false },
    WeaponDes_015: { dirs: ["LongBlade/Jigsaw"], elemZh: "流血", elemEn: "Bleed", isRanged: false },
    WeaponDes_016: { dirs: ["BaiYing"], elemZh: "冰冻", elemEn: "Frost", isRanged: false },
    WeaponDes_017: { dirs: ["LongBlade/GuiTouBlade"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_018: { dirs: ["PoJun"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_019: { dirs: ["Horizontal"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_020: { dirs: ["YanYueDao"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_022: { dirs: ["DoubleBlade/AAAAAA", "DoubleBlade/AB", "DoubleBlade/BBBB", "DoubleBlade/CCC", "DoubleBlade/Air", "DoubleBlade/PerfectDodge"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_023: { dirs: ["DoubleBlade/YuuBlade"], elemZh: "妖气", elemEn: "YaoQi", isRanged: false },
    WeaponDes_024: { dirs: ["DoubleBlade/JueYing", "JueYing"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_026: { dirs: ["ShuangYue"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_027: { dirs: ["SnakeDual/Attack", "SnakeDual/ReleaseAttack", "SnakeDual/Snake"], elemZh: "中毒", elemEn: "Poison", isRanged: false },
    WeaponDes_028: { dirs: ["DualHook"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_029: { dirs: ["DoubleBlade/Jade", "Jade"], elemZh: null, elemEn: null, isRanged: false },
    WeaponDes_031: { dirs: ["XieShan"], elemZh: "元素", elemEn: "Elem", isRanged: false },
    // Shadow weapons
    PhantomEdgesDes_001: { dirs: ["ShachiWeapon/BrutalAxe"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_002: { dirs: ["ShachiWeapon/JinGua", "ShachiAbility/JinGua"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_004: { dirs: ["ShachiWeapon/ZhuoBiDun"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_005: { dirs: ["ShachiAbility/TanLang"], elemZh: "流血", elemEn: "Bleed", isRanged: false, isShaChi: true },
    PhantomEdgesDes_006: { dirs: ["ShachiWeapon/TigerCannon"], elemZh: "燃烧", elemEn: "Ignite", isRanged: true, isShaChi: true },
    PhantomEdgesDes_008: { dirs: ["ShachiWeapon/HuangJinHuoChong"], elemZh: null, elemEn: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_009: { dirs: ["ShachiWeapon/Bow"], elemZh: null, elemEn: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_010: { dirs: ["MiaoShouFeiDao"], elemZh: null, elemEn: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_011: { dirs: ["ShachiWeapon/YouLongHead"], elemZh: "潮湿", elemEn: "Water", isRanged: true, isShaChi: true },
    PhantomEdgesDes_012: { dirs: ["ShachiWeapon/LionHead"], elemZh: "燃烧", elemEn: "Ignite", isRanged: true, isShaChi: true },
    PhantomEdgesDes_014: { dirs: ["ShachiWeapon/ShachiHook", "ShachiAbility/ShachiHook"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_015: { dirs: ["ShachiWeapon/HuoLiuXing"], elemZh: "燃烧", elemEn: "Ignite", isRanged: false, isShaChi: true },
    PhantomEdgesDes_016: { dirs: ["YouLongCha"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_017: { dirs: ["ShachiAbility/TieKuangQuanTao"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_018: { dirs: ["ShachiWeapon/MoJian"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_019: { dirs: ["ShachiWeapon/LeiTingQiang"], elemZh: "感电", elemEn: "Elec", isRanged: false, isShaChi: true },
    PhantomEdgesDes_020: { dirs: ["ShachiAbility/XueDiZi"], elemZh: "流血", elemEn: "Bleed", isRanged: false, isShaChi: true },
    PhantomEdgesDes_022: { dirs: ["NiTouChe"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_023: { dirs: ["ShachiAbility/XuKongHuaShan"], elemZh: null, elemEn: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_024: { dirs: ["ShachiWeapon/Lute", "ShachiAbility/Lute"], elemZh: null, elemEn: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_109: { dirs: ["DuYanBow"], elemZh: null, elemEn: null, isRanged: true, isShaChi: true },
};

const WEAPON_NAME_TOKENS = new Set([
    "Hun", "BulletData", "BD", "B", "EB", "YuuBlade", "YaoJu", "HeiMoShang", "TangBlade", "Tang",
    "DoubleBlade", "DoubleBalde", "Double", "LongBlade", "Long", "Iron", "IronBlade", "LuanYing",
    "ChaosBlade", "Chaos", "BronzeSword", "ChiZheCanJian", "SlitheringSword", "BaiShanFengLeiJian",
    "FengLeiJian", "ZiMingJian", "ZhanMaBlade", "ZhanMa", "ChiRen", "XieHuo", "Jigsaw", "JigSaw",
    "BaiYing", "GuiTouBlade", "PoJun", "Horizontal", "HorizontalBlade", "YanYueDao", "MoQie",
    "JueYing", "ShuangYue", "SnakeDual", "DualHook", "Jade", "JadeDualChakram", "XieShan",
    "WoodenSword", "HuangJinHuoChong", "BrutalAxe", "JinGua", "ZhuoBiDun", "TanLang", "TigerCannon",
    "Bow", "UnnamedBow", "MiaoShouFeiDao", "YouLongHead", "LionHead", "ShachiHook", "HuoLiuXing",
    "YouLongCha", "TieKuangQuanTao", "MoJian", "LeiTingQiang", "ThunderSpear", "XueDiZi",
    "NiTouChe", "XuKongHuaShan", "Lute", "DuYanBow", "ShachiWeapon", "ShachiAbility", "Default",
    "New", "V2", "V1", "Use", "Common", "Global", "GA", "GE", "BP"
]);

const TOKEN_MAP = {
    BreakActCharge: ["蓄力破防追击", "Charged Break Finisher"],
    BreakAct: ["破防追击", "Break Finisher"],
    BChargeAttack: ["蓄力斩", "Charged Slash"],
    ChargeAttack: ["蓄力攻击", "Charged Attack"],
    FastLightAttack: ["蓄势轻击", "Charged Light"],
    FastHeavyAttack: ["蓄势重击", "Charged Heavy"],
    DeflectCounter: ["格挡反击", "Deflect Counter"],
    PerfectDeflect: ["完美格挡反击", "Perfect Deflect"],
    PerfectDodge: ["完美闪避反击", "Perfect Dodge Counter"],
    Gunstock: ["枪托", "Gunstock"],
    Perfect: ["完美", "Perfect"],
    Normal: ["普通", "Normal"],
    Heavy: ["重击", "Heavy"],
    Light: ["轻击", "Light"],
    DashDraw: ["疾跑拔刀", "Dash Draw"],
    DashSnap: ["闪避突进", "Dodge Strike"],
    Dash: ["冲刺", "Dash"],
    Draw: ["拔刀", "Draw"],
    Snap: ["闪避攻击", "Dodge Strike"],
    BuffAtk: ["强化斩击", "Buffed Slash"],
    Buff: ["强化斩击", "Buffed Attack"],
    SWT: ["切武器攻击", "Switch Attack"],
    Air: ["空中攻击", "Air Attack"],
    Charge: ["蓄力", "Charge"],
    Hold: ["蓄力", "Hold"],
    FireBall: ["火球", "Fireball"],
    DoubleFireBall: ["双火球", "Twin Fireball"],
    FireGround: ["火海", "Fire Ground"],
    Fire: ["烈焰", "Fire"],
    Flame: ["火焰", "Flame"],
    Ice: ["寒冰", "Ice"],
    Frost: ["冰霜", "Frost"],
    Lightning: ["落雷", "Lightning"],
    Thunder: ["雷霆", "Thunder"],
    Wind: ["疾风", "Wind"],
    WaterCannon: ["高压水炮", "Water Cannon"],
    Water: ["水柱", "Water Jet"],
    BloodSaw: ["血锯", "Blood Saw"],
    BloodArrow: ["血箭", "Blood Arrow"],
    BladeWave: ["刀波", "Blade Wave"],
    Wave: ["剑气", "Wave"],
    Tornado: ["旋风", "Tornado"],
    Slide: ["滑铲", "Slide"],
    Rush: ["冲锋", "Rush"],
    Sprint: ["疾冲", "Sprint"],
    TurnAttack: ["回旋撞击", "Turn Slam"],
    Turn: ["回旋", "Turn"],
    SitDown: ["坐弹", "Seated Play"],
    HookMove: ["钩索拉近", "Hook Pull"],
    Hook: ["钩索", "Hook"],
    Stab: ["突刺", "Stab"],
    Throw: ["投掷", "Throw"],
    Shoot: ["射击", "Shot"],
    Aim: ["瞄准射击", "Aimed Shot"],
    Spin: ["旋斩", "Spin"],
    Slam: ["重砸", "Slam"],
    Sweep: ["横扫", "Sweep"],
    Jump: ["跳劈", "Jump"],
    Assault: ["突袭", "Assault"],
    Pursue: ["追击", "Pursue"],
    Combo: ["连击", "Combo"],
    Counter: ["反击", "Counter"],
    SpecialAttack: ["特殊技", "Special"],
    Special: ["特殊技", "Special"],
    Skill: ["技能", "Skill"],
    Release: ["释放", "Release"],
    Explode: ["引爆", "Detonate"],
    Explosion: ["爆发", "Explosion"],
    ExtraAttack: ["追击", "Follow-up"],
    Extra: ["额外", "Extra"],
    FreeStrike: ["御剑连击", "Free Strike"],
    CriticalStrike: ["御剑重击", "Critical Strike"],
    GhostDash: ["鬼步", "Ghost Dash"],
    Afterimage: ["残影", "Afterimage"],
    Ring: ["飞环", "Chakram"],
    Arrow: ["箭矢", "Arrow"],
    Bullet: ["弹丸", "Bullet"],
    Cannon: ["炮击", "Cannon"],
    Shield: ["盾击", "Shield"],
    Underwater: ["水下突刺", "Underwater"],
    Final: ["终结", "Finisher"],
    Aura: ["余波", "Aura"],
    Enhanced: ["强化", "Enhanced"],
    FullCharge: ["满蓄", "Full Charge"],
    Lv1: ["一段", "Lv1"],
    Lv2: ["二段", "Lv2"],
    Lv3: ["三段", "Lv3"],
    Lv4: ["四段", "Lv4"],
    F: ["前", "Fwd"],
    B: ["后", "Back"],
    L: ["左", "Left"],
    R: ["右", "Right"],
};

const S2T_FROM = "伤杀气连段变招冲拔闪避轻重击蓄势强剑波异状流血燃烧冰冻感电妖满级预期升减防破韧弹枪托侧进退悬空飞环斩击势术灵影处决持续时间层数回复消耗额外基础派生攻击特殊技武装体扇锤斧盾弓刀剑双单手持反追踪爆诱饮酒微醺醉态钢刃烈焰寒霜风雷护佑印记穿透格挡过载";
const S2T_TO   = "傷殺氣連段變招衝拔閃避輕重擊蓄勢強劍波異狀流血燃燒冰凍感電妖滿級預期升減防破韌彈槍托側進退懸空飛環斬擊勢術靈影處決持續時間層數回復消耗額外基礎派生攻擊特殊技武裝體扇錘斧盾弓刀劍雙單手持反追蹤爆誘飲酒微醺醉態鋼刃烈焰寒霜風雷護佑印記穿透格擋過載";
const S2T_MAP = {};
for (let i = 0; i < S2T_FROM.length; i++) S2T_MAP[S2T_FROM[i]] = S2T_TO[i];

function toHant(s) {
    return s.split(/(<[^>]+>)/g).map((part) => {
        if (part.startsWith("<")) return part;
        let out = "";
        for (let i = 0; i < part.length; i++) out += S2T_MAP[part[i]] || part[i];
        return out;
    }).join("");
}

function L(zh, en) {
    return { "zh-Hans": zh, "zh-Hant": toHant(zh), en };
}

function N(s) { return `<WeaponDes_Num_Green>${s}</>`; }

function fmtPct(v) {
    const p = v * 100.0;
    if (Math.abs(p - Math.round(p)) < 0.05) return `${Math.round(p)}%`;
    return `${p.toFixed(1)}%`;
}

function safeCall(fn, fb = undefined) {
    try { return fn(); } catch (e) { return fb; }
}

function isValid(o) {
    if (!o) return false;
    try { return !!UE.KismetSystemLibrary.IsValid(o); } catch (e) { return true; }
}

function translateTokens(core, isRanged) {
    if (core === "Dash_F") return isRanged ? ["前冲射击", "Fwd Dash Shot"] : ["前冲攻击", "Fwd Dash Attack"];
    if (core === "Dash_B") return isRanged ? ["后撤射击", "Back Dash Shot"] : ["后撤攻击", "Back Dash Attack"];
    if (core === "Dash_L") return isRanged ? ["左闪射击", "Left Dash Shot"] : ["左闪攻击", "Left Dash Attack"];
    if (core === "Dash_R") return isRanged ? ["右闪射击", "Right Dash Shot"] : ["右闪攻击", "Right Dash Attack"];
    if (core === "DeflectCounter_Gunstock") return ["枪托反击", "Gunstock Counter"];
    if (core === "DeflectCounter_Gunstock_Perfect") return ["完美枪托反击", "Perfect Gunstock Counter"];
    if (core === "DeflectCounter_Normal") return ["格挡反击", "Deflect Counter"];
    if (core === "DeflectCounter_Perfect") return ["完美格挡反击", "Perfect Deflect Counter"];
    if (core === "BChargeAttack_Lv1") return ["一段蓄力斩", "Charged Slash Lv1"];
    if (core === "BChargeAttack_Lv2") return ["二段蓄力斩", "Charged Slash Lv2"];
    if (core === "BChargeAttack_Lv3") return ["三段蓄力斩", "Charged Slash Lv3"];

    const rawParts = core.split(/[_\-]+/).filter(Boolean);
    const zh = [], en = [];
    for (const p of rawParts) {
        if (WEAPON_NAME_TOKENS.has(p) || /^\d+$/.test(p)) continue;
        if (TOKEN_MAP[p]) {
            zh.push(TOKEN_MAP[p][0]);
            en.push(TOKEN_MAP[p][1]);
            continue;
        }
        if (/^[AB]{2,}$/.test(p)) {
            const xy = p.replace(/A/g, "X").replace(/B/g, "Y");
            zh.push(xy); en.push(xy);
            continue;
        }
        const subs = p.match(/[A-Z][a-z0-9]*|[a-z0-9]+/g) || [];
        for (const sp of subs) {
            if (WEAPON_NAME_TOKENS.has(sp) || /^\d+$/.test(sp)) continue;
            if (TOKEN_MAP[sp]) {
                zh.push(TOKEN_MAP[sp][0]);
                en.push(TOKEN_MAP[sp][1]);
            }
        }
    }
    const dedup = (arr) => arr.filter((x, i) => i === 0 || arr[i - 1] !== x);
    const dz = dedup(zh), de = dedup(en);
    if (dz.length === 0) return ["特殊招式", "Special Move"];
    let zStr = dz.join("").replace(/前冲冲刺/g, "前冲").replace(/后撤冲刺/g, "后撤").replace(/攻击攻击/g, "攻击").replace(/射击射击/g, "射击");
    let eStr = de.join(" ");
    if (isRanged && (zStr === "普通" || zStr === "蓄力" || zStr === "满蓄")) {
        zStr += "射击"; eStr += " Shot";
    }
    return [zStr, eStr];
}

function cleanBulletCore(relPath) {
    const name = relPath.split("/").pop() || "";
    let core = name.replace(/^(BulletData|BD|B|EB)_(Hun_)?/, "");
    const parts = core.split("_");
    while (parts.length > 0 && WEAPON_NAME_TOKENS.has(parts[0])) parts.shift();
    core = parts.join("_");
    core = core.replace(/(_Spawner|_New|_Hit\d*|_Final|_End|_L\d+|_R\d+|_\d+)+$/, "");
    core = core.replace(/^([AB]{1,6})_[LR]$/, "$1");
    core = core.replace(/(Dash|Draw|Snap|Dodge)_[LR]\d+$/, "$1");
    core = core.replace(/^(Enhanced|Wave|Fire|Ice|Physics|FengLeiState)_/, "");
    return core;
}

function extractMove(relPath, isRanged) {
    if (SKIP_RE.test(relPath)) return null;
    const name = relPath.split("/").pop() || "";
    if (/\/(ExE|SimpleExE|EXE)\/|SimpleExecution|_BEx_|_BEd_/.test(relPath)) return null;

    let subZh = "", subEn = "", cat = "combo";
    if (relPath.includes("/Enhanced/") || name.includes("_Enhanced_")) { subZh = "强化·"; subEn = "Enhanced "; cat = "enhanced"; }
    else if (relPath.includes("/Wave/") || name.includes("_Wave_")) { subZh = "剑气·"; subEn = "Wave "; cat = "enhanced"; }
    else if (relPath.includes("/Fire/")) { subZh = "烈焰·"; subEn = "Fire "; }
    else if (relPath.includes("/Ice/")) { subZh = "寒冰·"; subEn = "Ice "; }
    else if (relPath.includes("/Physics/")) { subZh = "钢刃·"; subEn = "Steel "; }
    else if (relPath.includes("/FengLeiState/")) { subZh = "风雷·"; subEn = "Storm "; cat = "enhanced"; }
    else if (relPath.includes("/ReleaseAttack/")) { subZh = "释放·"; subEn = "Release "; cat = "enhanced"; }
    else if (relPath.includes("/Snake/")) { subZh = "蛇灵·"; subEn = "Serpent "; cat = "enhanced"; }

    let core = cleanBulletCore(relPath);
    if (!core) return null;
    core = core.replace("A_Dash_Draw", "A_DashDraw").replace("B_Dash_Draw", "B_DashDraw");

    if (/^A+$/.test(core)) { const n = core.length; return { cat: "basic", zh: `${subZh}轻${n} (${"X".repeat(n)})`, en: `${subEn}Light ${n} (${"X".repeat(n)})`, sort: 100 + n }; }
    if (/^B+$/.test(core)) { const n = core.length; return { cat: "basic", zh: `${subZh}重${n} (${"Y".repeat(n)})`, en: `${subEn}Heavy ${n} (${"Y".repeat(n)})`, sort: 200 + n }; }
    if (/^[AB]+$/.test(core)) { const xy = core.replace(/A/g, "X").replace(/B/g, "Y"); return { cat: "variant", zh: `${subZh}${xy}`, en: `${subEn}${xy}`, sort: 300 + core.length }; }
    if (/^(C|CA|CB|CC|CCC|Skill|Special|SpecialAttack)$/.test(core)) {
        const cm = { CA: ["特殊轻派生", "Special Light"], CB: ["特殊重派生", "Special Heavy"], CC: ["特殊二连斩", "Special Combo 2"], CCC: ["特殊三连斩", "Special Combo 3"] };
        const pair = cm[core] || ["特殊技", "Special"];
        return { cat: "skill", zh: `${subZh}${pair[0]}`, en: `${subEn}${pair[1]}`, sort: 400 + core.length };
    }
    if (core === "A_Dash") return { cat: "special", zh: `${subZh}疾跑轻击`, en: `${subEn}Sprint Light`, sort: 510 };
    if (core === "B_Dash") return { cat: "special", zh: `${subZh}疾跑重击`, en: `${subEn}Sprint Heavy`, sort: 511 };
    if (core === "A_Draw") return { cat: "special", zh: `${subZh}拔刀轻击`, en: `${subEn}Draw Light`, sort: 512 };
    if (core === "B_Draw") return { cat: "special", zh: `${subZh}拔刀重击`, en: `${subEn}Draw Heavy`, sort: 513 };
    if (core === "A_DashDraw") return { cat: "special", zh: `${subZh}疾跑拔刀轻击`, en: `${subEn}Sprint Draw Light`, sort: 514 };
    if (core === "B_DashDraw") return { cat: "special", zh: `${subZh}疾跑拔刀重击`, en: `${subEn}Sprint Draw Heavy`, sort: 515 };
    if (core === "A_Snap" || core === "A_DashSnap") return { cat: "special", zh: `${subZh}闪避轻击`, en: `${subEn}Dodge Light`, sort: 516 };
    if (core === "B_Snap" || core === "B_DashSnap") return { cat: "special", zh: `${subZh}闪避重击`, en: `${subEn}Dodge Heavy`, sort: 517 };
    if (core === "SWT") return { cat: "special", zh: `${subZh}切武器攻击`, en: `${subEn}Switch Attack`, sort: 518 };
    if (relPath.includes("PerfectDodge") || core === "PerfectDodge") return { cat: "special", zh: `${subZh}完美闪避反击`, en: `${subEn}Perfect Dodge Counter`, sort: 520 };

    const [zLbl, eLbl] = translateTokens(core, isRanged);
    return { cat: cat === "combo" ? "special" : cat, zh: `${subZh}${zLbl}`, en: `${subEn}${eLbl}`, sort: 600 };
}

function readDamageDataMap(bulletObj) {
    const dd = safeCall(() => bulletObj.DamageData, null);
    if (!dd || typeof dd.GetMaxIndex !== "function" || typeof dd.GetKey !== "function") return null;
    let phys = 0, anger = 0, elem = 0;
    const maxIdx = safeCall(() => dd.GetMaxIndex(), 0);
    for (let i = 0; i < Math.min(maxIdx, 64); i++) {
        if (typeof dd.IsValidIndex === "function" && !safeCall(() => dd.IsValidIndex(i), false)) continue;
        const k = safeCall(() => dd.GetKey(i), null);
        if (!k) continue;
        const tag = String(k.TagName !== undefined ? k.TagName : k);
        const v = Number(safeCall(() => dd.Get(k), 0)) || 0;
        if (tag === PK) phys = v;
        else if (tag === AK) anger = v;
        else if (tag === EK) elem = v;
    }
    if (phys <= 0 && anger <= 0 && elem <= 0) return null;
    return { phys, anger, elem };
}

function fmtLine(g, elemZh, elemEn) {
    const zhHits = g.hits > 1 ? `(${N(String(g.hits))}段)` : "";
    const enHits = g.hits > 1 ? ` (${N(String(g.hits))} hits)` : "";
    const zp = [], ep = [];
    if (g.phys > 0) { zp.push(`伤害 ${N(fmtPct(g.phys))}`); ep.push(`DMG ${N(fmtPct(g.phys))}`); }
    if (g.anger > 0) { zp.push(`杀气 ${N(fmtPct(g.anger))}`); ep.push(`Sha-Chi ${N(fmtPct(g.anger))}`); }
    if (elemZh && g.elem > 0) { zp.push(`${elemZh} ${N(fmtPct(g.elem))}`); ep.push(`${elemEn} ${N(fmtPct(g.elem))}`); }
    else if (g.elem > 0 && Math.abs(g.elem - g.phys) > 0.01) { zp.push(`异常 ${N(fmtPct(g.elem))}`); ep.push(`Status ${N(fmtPct(g.elem))}`); }
    return [`${g.zh}${zhHits}：${zp.join(" / ")}`, `${g.en}${enHits}: ${ep.join(" / ")}`];
}

// Cache: equipDescKey -> { entries, skillPatch, upgradePatches }
const liveCache = new Map();

function clearCache() {
    liveCache.clear();
}

function readLiveWeaponBullets(equipKey, logFn) {
    const spec = WEAPON_DIR_MAP[equipKey];
    if (!spec) return null;
    const registry = safeCall(() => UE.AssetRegistryHelpers.GetAssetRegistry(), null);
    if (!registry) return null;

    const groups = new Map();
    const seenPkg = new Set();

    for (const subDir of spec.dirs) {
        const fullDir = BULLET_ROOT + subDir;
        const outAssets = puerts.$ref(UE.NewArray(UE.AssetData));
        safeCall(() => registry.GetAssetsByPath(fullDir, outAssets, true, false));
        const arr = puerts.$unref(outAssets);
        if (!arr || typeof arr.Num !== "function") continue;
        const n = arr.Num();
        for (let i = 0; i < n; i++) {
            const ad = arr.Get(i);
            const pkg = safeCall(() => String(ad.PackageName), "");
            const name = safeCall(() => String(ad.AssetName), "");
            if (!pkg || !name || seenPkg.has(pkg)) continue;
            seenPkg.add(pkg);
            const rel = pkg.replace(BULLET_ROOT, "");
            const parsed = extractMove(rel, !!spec.isRanged);
            if (!parsed) continue;
            const obj = safeCall(() => UE.Object.Load(`${pkg}.${name}`), null);
            if (!obj || !isValid(obj)) continue;
            const dmg = readDamageDataMap(obj);
            if (!dmg) continue;
            const gKey = `${parsed.cat}|${parsed.zh}`;
            let g = groups.get(gKey);
            if (!g) {
                g = { cat: parsed.cat, zh: parsed.zh, en: parsed.en, sort: parsed.sort, hits: 0, phys: 0, anger: 0, elem: 0 };
                groups.set(gKey, g);
            }
            g.hits += 1;
            g.phys += dmg.phys;
            g.anger += dmg.anger;
            g.elem += dmg.elem;
        }
    }

    if (groups.size === 0) return null;
    const all = Array.from(groups.values());

    // Build skill patch for main weapons (Weapon_FunctionDes_XXX_Skill)
    let skillPatch = null;
    if (!spec.isShaChi) {
        const skills = all.filter((g) => g.cat === "skill").sort((a, b) => a.sort - b.sort);
        if (skills.length > 0) {
            const m = equipKey.match(/WeaponDes_(\d+)/);
            if (m) {
                const zItems = [], eItems = [];
                for (const g of skills) {
                    const [zl, el] = fmtLine(g, spec.elemZh, spec.elemEn);
                    zItems.push(zl); eItems.push(el);
                }
                skillPatch = {
                    key: `Weapon_FunctionDes_${m[1]}_Skill`,
                    patch: { kind: "skill", append: L(`（${zItems.join("；")}）`, ` (${eItems.join("; ")})`) },
                };
            }
        }
    }

    // Build bottom entries
    const entries = [];
    if (spec.isShaChi) {
        all.sort((a, b) => a.sort - b.sort || a.zh.localeCompare(b.zh));
        const zLines = [], eLines = [];
        for (const g of all.slice(0, 20)) {
            const [zl, el] = fmtLine(g, spec.elemZh, spec.elemEn);
            zLines.push(zl); eLines.push(el);
        }
        if (zLines.length > 0) {
            entries.push({ title: L("影之武装招式倍率", "Shadow Weapon Move Multipliers"), desc: L(zLines.join("\n"), eLines.join("\n")) });
        }
    } else {
        const cats = [
            ["basic", "基础连段倍率", "Basic Combo Multipliers"],
            ["variant", "派生变招倍率", "Combo Variant Multipliers"],
            ["special", "冲刺 / 拔刀 / 特殊派生倍率", "Dash / Draw / Special Multipliers"],
            ["enhanced", "强化 / 剑气派生倍率", "Enhanced / Wave Multipliers"],
        ];
        for (const [ck, tz, te] of cats) {
            const items = all.filter((g) => g.cat === ck).sort((a, b) => a.sort - b.sort || a.zh.localeCompare(b.zh));
            if (items.length === 0) continue;
            const zLines = [], eLines = [];
            for (const g of items.slice(0, 26)) {
                const [zl, el] = fmtLine(g, spec.elemZh, spec.elemEn);
                zLines.push(zl); eLines.push(el);
            }
            entries.push({ title: L(tz, te), desc: L(zLines.join("\n"), eLines.join("\n")) });
        }
    }

    if (logFn) logFn(`[LiveRead] ${equipKey}: ${seenPkg.size} bullets -> ${entries.length} sections`);
    return { entries, skillPatch };
}

// Read live Lv10/20/30 GEUIDataArray values if another mod altered weapon UpLevelData
function readLiveUpgradeValues(weaponID, isMain, backpackSubsystem, liveLocPatches) {
    try {
        const wd = isMain
            ? backpackSubsystem.GetMainWeaponTableData(weaponID)
            : backpackSubsystem.GetShaqiWeaponTableData(weaponID);
        if (!wd) return;
        const upArr = isMain ? wd.WeaponUpLevelDatas : wd.ShaChiWeaponUpLevelData;
        if (!upArr || typeof upArr.IsValidIndex !== "function" || !upArr.IsValidIndex(8)) {
            if (isMain) void wd.WeaponUpLevelDatas; else void wd.ShaChiWeaponUpLevelData;
            return;
        }
        const lv10 = safeCall(() => upArr.Get(8), null);
        const lv20 = upArr.IsValidIndex(18) ? safeCall(() => upArr.Get(18), null) : null;
        const lv30 = upArr.IsValidIndex(28) ? safeCall(() => upArr.Get(28), null) : null;
        if (isMain) void wd.WeaponUpLevelDatas; else void wd.ShaChiWeaponUpLevelData;
        if (!lv10 || !lv10.GEDatas || lv10.GEDatas.Num() === 0) return;

        const descKey = safeCall(() => String(lv10.GEDatas.Get(0)?.FlowLocText?.Key || ""), "");
        if (!descKey || descKey === "None") return;

        const readFirstUIVal = (ld) => {
            if (!ld || !ld.GEUIDataArray || ld.GEUIDataArray.Num() === 0) return null;
            const item = ld.GEUIDataArray.Get(0);
            if (!item) return null;
            return { tag: String(item.GETag?.TagName || ""), val: Number(item.GEValue) };
        };
        const u1 = readFirstUIVal(lv10);
        const u2 = readFirstUIVal(lv20);
        const u3 = readFirstUIVal(lv30);
        if (!u1 || !u2 || !u3 || !Number.isFinite(u1.val)) return;

        const t = u1.tag;
        const makeTier3 = (zhLbl, enLbl, f1, f2, f3) => {
            liveLocPatches[descKey] = {
                kind: "upgrade",
                append: L(
                    `（${zhLbl} {&${N(f1)}|${N(f2)}|${N(f3)}}，满级 ${N(f3)}）`,
                    ` (${enLbl} {&${N(f1)}|${N(f2)}|${N(f3)}}, Max ${N(f3)})`
                ),
            };
        };

        if (t.endsWith("BleedIncrement")) makeTier3("流血积累速度提升", "Bleed Buildup", `+${fmtPct(u1.val)}`, `+${fmtPct(u2.val)}`, `+${fmtPct(u3.val)}`);
        else if (t.endsWith("ChargeAttackMultiplier")) makeTier3("蓄力攻击伤害提升", "Charged Attack DMG", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
        else if (t.endsWith("ComboMultiplier")) makeTier3("每段伤害增幅", "DMG Ramp per Hit", `+${fmtPct(u1.val)}`, `+${fmtPct(u2.val)}`, `+${fmtPct(u3.val)}`);
        else if (t.endsWith("StrongDefense")) makeTier3("蓄力受伤害降低", "Charge DMG Taken", `-${fmtPct(1 - u1.val)}`, `-${fmtPct(1 - u2.val)}`, `-${fmtPct(1 - u3.val)}`);
        else if (t.endsWith("BleedAttack")) makeTier3("对异常状态敌人伤害提升", "DMG vs Status Targets", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
        else if (t.endsWith("GreenFireAttackMultiplier")) makeTier3("磷火降低敌人攻击力", "Enemy ATK Reduction", `-${fmtPct(1 - u1.val)}`, `-${fmtPct(1 - u2.val)}`, `-${fmtPct(1 - u3.val)}`);
        else if (t.endsWith("SummonLifeTime")) makeTier3("召唤物在场时间", "Summon Duration", `${u1.val}秒`, `${u2.val}秒`, `${u3.val}秒`);
        else if (t.endsWith("ProjectileDuration")) makeTier3("光轮剑持续时间", "Halo Blade Duration", `${u1.val}秒`, `${u2.val}秒`, `${u3.val}秒`);
        else if (t.endsWith("Time")) makeTier3("场域持续时间", "Field Duration", `${u1.val}秒`, `${u2.val}秒`, `${u3.val}秒`);
        else if (t.endsWith("FlameDamage")) makeTier3("地面火焰伤害倍率", "Fire Ground DMG", fmtPct(u1.val), fmtPct(u2.val), fmtPct(u3.val));
        else if (t.endsWith("BlueBulletDamage")) makeTier3("蓝/红音刃伤害提升", "Blue/Red Note DMG", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
        else if (t.endsWith("Physical") && descKey.includes("010_10")) makeTier3("最佳射程伤害/杀气/削韧提升", "Sweet-spot DMG/Sha-Chi/Poise", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
    } catch (e) {}
}

function getLiveWeaponData(equipKey, weaponID, isMain, backpackSubsystem, liveLocPatches, logFn) {
    if (liveCache.has(equipKey)) return liveCache.get(equipKey);
    const bulletRes = safeCall(() => readLiveWeaponBullets(equipKey, logFn), null);
    if (bulletRes && bulletRes.skillPatch) {
        liveLocPatches[bulletRes.skillPatch.key] = bulletRes.skillPatch.patch;
    }
    readLiveUpgradeValues(weaponID, isMain, backpackSubsystem, liveLocPatches);
    const result = bulletRes ? bulletRes.entries : null;
    liveCache.set(equipKey, result);
    return result;
}

exports.getLiveWeaponData = getLiveWeaponData;
exports.clearCache = clearCache;
