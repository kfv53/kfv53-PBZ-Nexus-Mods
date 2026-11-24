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

// equipDescKey -> { dirs, elemZh, elemEn, elemKo, isRanged, isShaChi }
const WEAPON_DIR_MAP = {
    // Main weapons
    WeaponDes_000: { dirs: ["TangBlade/WoodenSword"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_001: { dirs: ["TangBlade/Default"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_002: { dirs: ["Iron/Default"], elemZh: "流血", elemEn: "Bleed", elemKo: "출혈", isRanged: false },
    WeaponDes_003: { dirs: ["LuanYing"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_004: { dirs: ["ChaosBlade"], elemZh: "元素", elemEn: "Elem", elemKo: "속성", isRanged: false },
    WeaponDes_005: { dirs: ["HeiMoShang"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_007: { dirs: ["BronzeSword"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_008: { dirs: ["ChiZheCanJian/Use"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_009: { dirs: ["SlitheringSword/Attack"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_010: { dirs: ["BaiShanFengLeiJian"], elemZh: "风雷", elemEn: "Elem", elemKo: "풍뢰", isRanged: false },
    WeaponDes_011: { dirs: ["ZiMingJian"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_012: { dirs: ["LongBlade/Default"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_013: { dirs: ["ZhanMaBlade"], elemZh: "流血", elemEn: "Bleed", elemKo: "출혈", isRanged: false },
    WeaponDes_014: { dirs: ["LongBlade/ChiRen"], elemZh: "燃烧", elemEn: "Ignite", elemKo: "연소", isRanged: false },
    WeaponDes_015: { dirs: ["LongBlade/Jigsaw"], elemZh: "流血", elemEn: "Bleed", elemKo: "출혈", isRanged: false },
    WeaponDes_016: { dirs: ["BaiYing"], elemZh: "冰冻", elemEn: "Frost", elemKo: "빙결", isRanged: false },
    WeaponDes_017: { dirs: ["LongBlade/GuiTouBlade"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_018: { dirs: ["PoJun"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_019: { dirs: ["Horizontal"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_020: { dirs: ["YanYueDao"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_022: { dirs: ["DoubleBlade/AAAAAA", "DoubleBlade/AB", "DoubleBlade/BBBB", "DoubleBlade/CCC", "DoubleBlade/Air", "DoubleBlade/PerfectDodge"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_023: { dirs: ["DoubleBlade/YuuBlade"], elemZh: "妖气", elemEn: "YaoQi", elemKo: "요기", isRanged: false },
    WeaponDes_024: { dirs: ["DoubleBlade/JueYing", "JueYing"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_026: { dirs: ["ShuangYue"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_027: { dirs: ["SnakeDual/Attack", "SnakeDual/ReleaseAttack", "SnakeDual/Snake"], elemZh: "中毒", elemEn: "Poison", elemKo: "중독", isRanged: false },
    WeaponDes_028: { dirs: ["DualHook"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_029: { dirs: ["DoubleBlade/Jade", "Jade"], elemZh: null, elemEn: null, elemKo: null, isRanged: false },
    WeaponDes_031: { dirs: ["XieShan"], elemZh: "元素", elemEn: "Elem", elemKo: "속성", isRanged: false },
    // Shadow weapons
    PhantomEdgesDes_001: { dirs: ["ShachiWeapon/BrutalAxe"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_002: { dirs: ["ShachiWeapon/JinGua", "ShachiAbility/JinGua"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_004: { dirs: ["ShachiWeapon/ZhuoBiDun"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_005: { dirs: ["ShachiAbility/TanLang"], elemZh: "流血", elemEn: "Bleed", elemKo: "출혈", isRanged: false, isShaChi: true },
    PhantomEdgesDes_006: { dirs: ["ShachiWeapon/TigerCannon"], elemZh: "燃烧", elemEn: "Ignite", elemKo: "연소", isRanged: true, isShaChi: true },
    PhantomEdgesDes_008: { dirs: ["ShachiWeapon/HuangJinHuoChong"], elemZh: null, elemEn: null, elemKo: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_009: { dirs: ["ShachiWeapon/Bow"], elemZh: null, elemEn: null, elemKo: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_010: { dirs: ["MiaoShouFeiDao"], elemZh: null, elemEn: null, elemKo: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_011: { dirs: ["ShachiWeapon/YouLongHead"], elemZh: "潮湿", elemEn: "Water", elemKo: "침수", isRanged: true, isShaChi: true },
    PhantomEdgesDes_012: { dirs: ["ShachiWeapon/LionHead"], elemZh: "燃烧", elemEn: "Ignite", elemKo: "연소", isRanged: true, isShaChi: true },
    PhantomEdgesDes_014: { dirs: ["ShachiWeapon/ShachiHook", "ShachiAbility/ShachiHook"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_015: { dirs: ["ShachiWeapon/HuoLiuXing"], elemZh: "燃烧", elemEn: "Ignite", elemKo: "연소", isRanged: false, isShaChi: true },
    PhantomEdgesDes_016: { dirs: ["YouLongCha"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_017: { dirs: ["ShachiAbility/TieKuangQuanTao"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_018: { dirs: ["ShachiWeapon/MoJian"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_019: { dirs: ["ShachiWeapon/LeiTingQiang"], elemZh: "感电", elemEn: "Elec", elemKo: "마비", isRanged: false, isShaChi: true },
    PhantomEdgesDes_020: { dirs: ["ShachiAbility/XueDiZi"], elemZh: "流血", elemEn: "Bleed", elemKo: "출혈", isRanged: false, isShaChi: true },
    PhantomEdgesDes_022: { dirs: ["NiTouChe"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_023: { dirs: ["ShachiAbility/XuKongHuaShan"], elemZh: null, elemEn: null, elemKo: null, isRanged: false, isShaChi: true },
    PhantomEdgesDes_024: { dirs: ["ShachiWeapon/Lute", "ShachiAbility/Lute"], elemZh: null, elemEn: null, elemKo: null, isRanged: true, isShaChi: true },
    PhantomEdgesDes_109: { dirs: ["DuYanBow"], elemZh: null, elemEn: null, elemKo: null, isRanged: true, isShaChi: true },
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
    BreakActCharge: ["蓄力破防追击", "Charged Break Finisher", "차지 방어 파괴 추격"],
    BreakAct: ["破防追击", "Break Finisher", "방어 파괴 추격"],
    BChargeAttack: ["蓄力斩", "Charged Slash", "차지 베기"],
    ChargeAttack: ["蓄力攻击", "Charged Attack", "차지 공격"],
    FastLightAttack: ["蓄势轻击", "Charged Light", "축세 약공격"],
    FastHeavyAttack: ["蓄势重击", "Charged Heavy", "축세 강공격"],
    DeflectCounter: ["格挡反击", "Deflect Counter", "방어 반격"],
    PerfectDeflect: ["完美格挡反击", "Perfect Deflect", "완벽 방어 반격"],
    PerfectDodge: ["完美闪避反击", "Perfect Dodge Counter", "완벽 회피 반격"],
    Gunstock: ["枪托", "Gunstock", "개머리판"],
    Perfect: ["完美", "Perfect", "완벽"],
    Normal: ["普通", "Normal", "일반"],
    Heavy: ["重击", "Heavy", "강공격"],
    Light: ["轻击", "Light", "약공격"],
    DashDraw: ["疾跑拔刀", "Dash Draw", "질주 발도"],
    DashSnap: ["闪避突进", "Dodge Strike", "회피 돌진"],
    Dash: ["冲刺", "Dash", "대시"],
    Draw: ["拔刀", "Draw", "발도"],
    Snap: ["闪避攻击", "Dodge Strike", "회피 공격"],
    BuffAtk: ["强化斩击", "Buffed Slash", "강화 참격"],
    Buff: ["强化斩击", "Buffed Attack", "강화 공격"],
    SWT: ["切武器攻击", "Switch Attack", "무기 전환 공격"],
    Air: ["空中攻击", "Air Attack", "공중 공격"],
    Charge: ["蓄力", "Charge", "차지"],
    Hold: ["蓄力", "Hold", "차지"],
    FireBall: ["火球", "Fireball", "화구"],
    DoubleFireBall: ["双火球", "Twin Fireball", "이중 화구"],
    FireGround: ["火海", "Fire Ground", "화염 지대"],
    Fire: ["烈焰", "Fire", "화염"],
    Flame: ["火焰", "Flame", "불꽃"],
    Ice: ["寒冰", "Ice", "한빙"],
    Frost: ["冰霜", "Frost", "서리"],
    Lightning: ["落雷", "Lightning", "낙뢰"],
    Thunder: ["雷霆", "Thunder", "뇌정"],
    Wind: ["疾风", "Wind", "질풍"],
    WaterCannon: ["高压水炮", "Water Cannon", "고압 수포"],
    Water: ["水柱", "Water Jet", "물기둥"],
    BloodSaw: ["血锯", "Blood Saw", "혈톱"],
    BloodArrow: ["血箭", "Blood Arrow", "혈전"],
    BladeWave: ["刀波", "Blade Wave", "도파"],
    Wave: ["剑气", "Wave", "검기"],
    Tornado: ["旋风", "Tornado", "회오리"],
    Slide: ["滑铲", "Slide", "슬라이딩"],
    Rush: ["冲锋", "Rush", "돌격"],
    Sprint: ["疾冲", "Sprint", "질주"],
    TurnAttack: ["回旋撞击", "Turn Slam", "회전 강타"],
    Turn: ["回旋", "Turn", "회전"],
    SitDown: ["坐弹", "Seated Play", "앉아 연주"],
    HookMove: ["钩索拉近", "Hook Pull", "갈고리 당기기"],
    Hook: ["钩索", "Hook", "갈고리"],
    Stab: ["突刺", "Stab", "찌르기"],
    Throw: ["投掷", "Throw", "투척"],
    Shoot: ["射击", "Shot", "사격"],
    Aim: ["瞄准射击", "Aimed Shot", "조준 사격"],
    Spin: ["旋斩", "Spin", "회전 베기"],
    Slam: ["重砸", "Slam", "내려찍기"],
    Sweep: ["横扫", "Sweep", "횡베기"],
    Jump: ["跳劈", "Jump", "도약 베기"],
    Assault: ["突袭", "Assault", "기습"],
    Pursue: ["追击", "Pursue", "추격"],
    Combo: ["连击", "Combo", "연격"],
    Counter: ["反击", "Counter", "반격"],
    SpecialAttack: ["特殊技", "Special", "특수기"],
    Special: ["特殊技", "Special", "특수기"],
    Skill: ["技能", "Skill", "기술"],
    Release: ["释放", "Release", "해방"],
    Explode: ["引爆", "Detonate", "기폭"],
    Explosion: ["爆发", "Explosion", "폭발"],
    ExtraAttack: ["追击", "Follow-up", "추격"],
    Extra: ["额外", "Extra", "추가"],
    FreeStrike: ["御剑连击", "Free Strike", "어검 연격"],
    CriticalStrike: ["御剑重击", "Critical Strike", "어검 강공격"],
    GhostDash: ["鬼步", "Ghost Dash", "귀보"],
    Afterimage: ["残影", "Afterimage", "잔영"],
    Ring: ["飞环", "Chakram", "비환"],
    Arrow: ["箭矢", "Arrow", "화살"],
    Bullet: ["弹丸", "Bullet", "탄환"],
    Cannon: ["炮击", "Cannon", "포격"],
    Shield: ["盾击", "Shield", "방패 치기"],
    Underwater: ["水下突刺", "Underwater", "수중 찌르기"],
    Final: ["终结", "Finisher", "마무리"],
    Aura: ["余波", "Aura", "여파"],
    Enhanced: ["强化", "Enhanced", "강화"],
    FullCharge: ["满蓄", "Full Charge", "최대 차지"],
    Lv1: ["一段", "Lv1", "1단계"],
    Lv2: ["二段", "Lv2", "2단계"],
    Lv3: ["三段", "Lv3", "3단계"],
    Lv4: ["四段", "Lv4", "4단계"],
    F: ["前", "Fwd", "전방"],
    B: ["后", "Back", "후방"],
    L: ["左", "Left", "좌측"],
    R: ["右", "Right", "우측"],
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

function L(zh, en, ko) {
    return { "zh-Hans": zh, "zh-Hant": toHant(zh), en, ko: ko || en };
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
    if (core === "Dash_F") return isRanged ? ["前冲射击", "Fwd Dash Shot", "전방 대시 사격"] : ["前冲攻击", "Fwd Dash Attack", "전방 대시 공격"];
    if (core === "Dash_B") return isRanged ? ["后撤射击", "Back Dash Shot", "후방 대시 사격"] : ["后撤攻击", "Back Dash Attack", "후방 대시 공격"];
    if (core === "Dash_L") return isRanged ? ["左闪射击", "Left Dash Shot", "좌측 회피 사격"] : ["左闪攻击", "Left Dash Attack", "좌측 회피 공격"];
    if (core === "Dash_R") return isRanged ? ["右闪射击", "Right Dash Shot", "우측 회피 사격"] : ["右闪攻击", "Right Dash Attack", "우측 회피 공격"];
    if (core === "DeflectCounter_Gunstock") return ["枪托反击", "Gunstock Counter", "개머리판 반격"];
    if (core === "DeflectCounter_Gunstock_Perfect") return ["完美枪托反击", "Perfect Gunstock Counter", "완벽 개머리판 반격"];
    if (core === "DeflectCounter_Normal") return ["格挡反击", "Deflect Counter", "방어 반격"];
    if (core === "DeflectCounter_Perfect") return ["完美格挡反击", "Perfect Deflect Counter", "완벽 방어 반격"];
    if (core === "BChargeAttack_Lv1") return ["一段蓄力斩", "Charged Slash Lv1", "1단계 차지 베기"];
    if (core === "BChargeAttack_Lv2") return ["二段蓄力斩", "Charged Slash Lv2", "2단계 차지 베기"];
    if (core === "BChargeAttack_Lv3") return ["三段蓄力斩", "Charged Slash Lv3", "3단계 차지 베기"];

    const rawParts = core.split(/[_\-]+/).filter(Boolean);
    const zh = [], en = [], ko = [];
    for (const p of rawParts) {
        if (WEAPON_NAME_TOKENS.has(p) || /^\d+$/.test(p)) continue;
        if (TOKEN_MAP[p]) {
            zh.push(TOKEN_MAP[p][0]);
            en.push(TOKEN_MAP[p][1]);
            ko.push(TOKEN_MAP[p][2] || TOKEN_MAP[p][1]);
            continue;
        }
        if (/^[AB]{2,}$/.test(p)) {
            const xy = p.replace(/A/g, "X").replace(/B/g, "Y");
            zh.push(xy); en.push(xy); ko.push(xy);
            continue;
        }
        const subs = p.match(/[A-Z][a-z0-9]*|[a-z0-9]+/g) || [];
        for (const sp of subs) {
            if (WEAPON_NAME_TOKENS.has(sp) || /^\d+$/.test(sp)) continue;
            if (TOKEN_MAP[sp]) {
                zh.push(TOKEN_MAP[sp][0]);
                en.push(TOKEN_MAP[sp][1]);
                ko.push(TOKEN_MAP[sp][2] || TOKEN_MAP[sp][1]);
            }
        }
    }
    const dedup = (arr) => arr.filter((x, i) => i === 0 || arr[i - 1] !== x);
    const dz = dedup(zh), de = dedup(en), dk = dedup(ko);
    if (dz.length === 0) return ["特殊招式", "Special Move", "특수 기술"];
    let zStr = dz.join("").replace(/前冲冲刺/g, "前冲").replace(/后撤冲刺/g, "后撤").replace(/攻击攻击/g, "攻击").replace(/射击射击/g, "射击");
    let eStr = de.join(" ");
    let kStr = dk.join(" ").replace(/공격 공격/g, "공격").replace(/사격 사격/g, "사격");
    if (isRanged && (zStr === "普通" || zStr === "蓄力" || zStr === "满蓄")) {
        zStr += "射击"; eStr += " Shot"; kStr += " 사격";
    }
    return [zStr, eStr, kStr];
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

    let subZh = "", subEn = "", subKo = "", cat = "combo";
    if (relPath.includes("/Enhanced/") || name.includes("_Enhanced_")) { subZh = "强化·"; subEn = "Enhanced "; subKo = "강화·"; cat = "enhanced"; }
    else if (relPath.includes("/Wave/") || name.includes("_Wave_")) { subZh = "剑气·"; subEn = "Wave "; subKo = "검기·"; cat = "enhanced"; }
    else if (relPath.includes("/Fire/")) { subZh = "烈焰·"; subEn = "Fire "; subKo = "화염·"; }
    else if (relPath.includes("/Ice/")) { subZh = "寒冰·"; subEn = "Ice "; subKo = "한빙·"; }
    else if (relPath.includes("/Physics/")) { subZh = "钢刃·"; subEn = "Steel "; subKo = "강철·"; }
    else if (relPath.includes("/FengLeiState/")) { subZh = "风雷·"; subEn = "Storm "; subKo = "풍뢰·"; cat = "enhanced"; }
    else if (relPath.includes("/ReleaseAttack/")) { subZh = "释放·"; subEn = "Release "; subKo = "해방·"; cat = "enhanced"; }
    else if (relPath.includes("/Snake/")) { subZh = "蛇灵·"; subEn = "Serpent "; subKo = "사령·"; cat = "enhanced"; }

    let core = cleanBulletCore(relPath);
    if (!core) return null;
    core = core.replace("A_Dash_Draw", "A_DashDraw").replace("B_Dash_Draw", "B_DashDraw");

    if (/^A+$/.test(core)) { const n = core.length; return { cat: "basic", zh: `${subZh}轻${n} (${"X".repeat(n)})`, en: `${subEn}Light ${n} (${"X".repeat(n)})`, ko: `${subKo}약공격 ${n} (${"X".repeat(n)})`, sort: 100 + n }; }
    if (/^B+$/.test(core)) { const n = core.length; return { cat: "basic", zh: `${subZh}重${n} (${"Y".repeat(n)})`, en: `${subEn}Heavy ${n} (${"Y".repeat(n)})`, ko: `${subKo}강공격 ${n} (${"Y".repeat(n)})`, sort: 200 + n }; }
    if (/^[AB]+$/.test(core)) { const xy = core.replace(/A/g, "X").replace(/B/g, "Y"); return { cat: "variant", zh: `${subZh}${xy}`, en: `${subEn}${xy}`, ko: `${subKo}${xy}`, sort: 300 + core.length }; }
    if (/^(C|CA|CB|CC|CCC|Skill|Special|SpecialAttack)$/.test(core)) {
        const cm = {
            CA: ["特殊轻派生", "Special Light", "특수 약공격 파생"],
            CB: ["特殊重派生", "Special Heavy", "특수 강공격 파생"],
            CC: ["特殊二连斩", "Special Combo 2", "특수 2연격"],
            CCC: ["特殊三连斩", "Special Combo 3", "특수 3연격"],
        };
        const triple = cm[core] || ["特殊技", "Special", "특수기"];
        return { cat: "skill", zh: `${subZh}${triple[0]}`, en: `${subEn}${triple[1]}`, ko: `${subKo}${triple[2]}`, sort: 400 + core.length };
    }
    if (core === "A_Dash") return { cat: "special", zh: `${subZh}疾跑轻击`, en: `${subEn}Sprint Light`, ko: `${subKo}질주 약공격`, sort: 510 };
    if (core === "B_Dash") return { cat: "special", zh: `${subZh}疾跑重击`, en: `${subEn}Sprint Heavy`, ko: `${subKo}질주 강공격`, sort: 511 };
    if (core === "A_Draw") return { cat: "special", zh: `${subZh}拔刀轻击`, en: `${subEn}Draw Light`, ko: `${subKo}발도 약공격`, sort: 512 };
    if (core === "B_Draw") return { cat: "special", zh: `${subZh}拔刀重击`, en: `${subEn}Draw Heavy`, ko: `${subKo}발도 강공격`, sort: 513 };
    if (core === "A_DashDraw") return { cat: "special", zh: `${subZh}疾跑拔刀轻击`, en: `${subEn}Sprint Draw Light`, ko: `${subKo}질주 발도 약공격`, sort: 514 };
    if (core === "B_DashDraw") return { cat: "special", zh: `${subZh}疾跑拔刀重击`, en: `${subEn}Sprint Draw Heavy`, ko: `${subKo}질주 발도 강공격`, sort: 515 };
    if (core === "A_Snap" || core === "A_DashSnap") return { cat: "special", zh: `${subZh}闪避轻击`, en: `${subEn}Dodge Light`, ko: `${subKo}회피 약공격`, sort: 516 };
    if (core === "B_Snap" || core === "B_DashSnap") return { cat: "special", zh: `${subZh}闪避重击`, en: `${subEn}Dodge Heavy`, ko: `${subKo}회피 강공격`, sort: 517 };
    if (core === "SWT") return { cat: "special", zh: `${subZh}切武器攻击`, en: `${subEn}Switch Attack`, ko: `${subKo}무기 전환 공격`, sort: 518 };
    if (relPath.includes("PerfectDodge") || core === "PerfectDodge") return { cat: "special", zh: `${subZh}完美闪避反击`, en: `${subEn}Perfect Dodge Counter`, ko: `${subKo}완벽 회피 반격`, sort: 520 };

    const [zLbl, eLbl, kLbl] = translateTokens(core, isRanged);
    return { cat: cat === "combo" ? "special" : cat, zh: `${subZh}${zLbl}`, en: `${subEn}${eLbl}`, ko: `${subKo}${kLbl}`, sort: 600 };
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

function fmtLine(g, elemZh, elemEn, elemKo) {
    const zhHits = g.hits > 1 ? `(${N(String(g.hits))}段)` : "";
    const enHits = g.hits > 1 ? ` (${N(String(g.hits))} hits)` : "";
    const koHits = g.hits > 1 ? ` (${N(String(g.hits))}타)` : "";
    const zp = [], ep = [], kp = [];
    if (g.phys > 0) { zp.push(`伤害 ${N(fmtPct(g.phys))}`); ep.push(`DMG ${N(fmtPct(g.phys))}`); kp.push(`피해 ${N(fmtPct(g.phys))}`); }
    if (g.anger > 0) { zp.push(`杀气 ${N(fmtPct(g.anger))}`); ep.push(`Sha-Chi ${N(fmtPct(g.anger))}`); kp.push(`살기 ${N(fmtPct(g.anger))}`); }
    if (elemZh && g.elem > 0) {
        zp.push(`${elemZh} ${N(fmtPct(g.elem))}`);
        ep.push(`${elemEn} ${N(fmtPct(g.elem))}`);
        kp.push(`${elemKo || elemEn} ${N(fmtPct(g.elem))}`);
    } else if (g.elem > 0 && Math.abs(g.elem - g.phys) > 0.01) {
        zp.push(`异常 ${N(fmtPct(g.elem))}`);
        ep.push(`Status ${N(fmtPct(g.elem))}`);
        kp.push(`상태이상 ${N(fmtPct(g.elem))}`);
    }
    return [
        `${g.zh}${zhHits}：${zp.join(" / ")}`,
        `${g.en}${enHits}: ${ep.join(" / ")}`,
        `${g.ko || g.en}${koHits}: ${kp.join(" / ")}`,
    ];
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
                g = { cat: parsed.cat, zh: parsed.zh, en: parsed.en, ko: parsed.ko, sort: parsed.sort, hits: 0, phys: 0, anger: 0, elem: 0 };
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
                const zItems = [], eItems = [], kItems = [];
                for (const g of skills) {
                    const [zl, el, kl] = fmtLine(g, spec.elemZh, spec.elemEn, spec.elemKo);
                    zItems.push(zl); eItems.push(el); kItems.push(kl);
                }
                skillPatch = {
                    key: `Weapon_FunctionDes_${m[1]}_Skill`,
                    patch: { kind: "skill", append: L(`（${zItems.join("；")}）`, ` (${eItems.join("; ")})`, ` (${kItems.join("; ")})`) },
                };
            }
        }
    }

    // Build bottom entries
    const entries = [];
    if (spec.isShaChi) {
        all.sort((a, b) => a.sort - b.sort || a.zh.localeCompare(b.zh));
        const zLines = [], eLines = [], kLines = [];
        for (const g of all.slice(0, 20)) {
            const [zl, el, kl] = fmtLine(g, spec.elemZh, spec.elemEn, spec.elemKo);
            zLines.push(zl); eLines.push(el); kLines.push(kl);
        }
        if (zLines.length > 0) {
            entries.push({
                title: L("影之武装招式倍率", "Shadow Weapon Move Multipliers", "그림자 무장 기술 배율"),
                desc: L(zLines.join("\n"), eLines.join("\n"), kLines.join("\n")),
            });
        }
    } else {
        const cats = [
            ["basic", "基础连段倍率", "Basic Combo Multipliers", "기본 콤보 배율"],
            ["variant", "派生变招倍率", "Combo Variant Multipliers", "파생 콤보 배율"],
            ["special", "冲刺 / 拔刀 / 特殊派生倍率", "Dash / Draw / Special Multipliers", "대시 / 발도 / 특수 파생 배율"],
            ["enhanced", "强化 / 剑气派生倍率", "Enhanced / Wave Multipliers", "강화 / 검기 파생 배율"],
        ];
        for (const [ck, tz, te, tk] of cats) {
            const items = all.filter((g) => g.cat === ck).sort((a, b) => a.sort - b.sort || a.zh.localeCompare(b.zh));
            if (items.length === 0) continue;
            const zLines = [], eLines = [], kLines = [];
            for (const g of items.slice(0, 26)) {
                const [zl, el, kl] = fmtLine(g, spec.elemZh, spec.elemEn, spec.elemKo);
                zLines.push(zl); eLines.push(el); kLines.push(kl);
            }
            entries.push({ title: L(tz, te, tk), desc: L(zLines.join("\n"), eLines.join("\n"), kLines.join("\n")) });
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
        const makeTier3 = (zhLbl, enLbl, koLbl, f1, f2, f3, isSec = false) => {
            const z1 = isSec ? `${f1}秒` : f1, z2 = isSec ? `${f2}秒` : f2, z3 = isSec ? `${f3}秒` : f3;
            const e1 = isSec ? `${f1}s` : f1, e2 = isSec ? `${f2}s` : f2, e3 = isSec ? `${f3}s` : f3;
            const k1 = isSec ? `${f1}초` : f1, k2 = isSec ? `${f2}초` : f2, k3 = isSec ? `${f3}초` : f3;
            liveLocPatches[descKey] = {
                kind: "upgrade",
                append: L(
                    `（${zhLbl} {&${N(z1)}|${N(z2)}|${N(z3)}}，满级 ${N(z3)}）`,
                    ` (${enLbl} {&${N(e1)}|${N(e2)}|${N(e3)}}, Max ${N(e3)})`,
                    ` (${koLbl} {&${N(k1)}|${N(k2)}|${N(k3)}}, 최대 ${N(k3)})`
                ),
            };
        };

        if (t.endsWith("BleedIncrement")) makeTier3("流血积累速度提升", "Bleed Buildup", "출혈 누적 속도 증가", `+${fmtPct(u1.val)}`, `+${fmtPct(u2.val)}`, `+${fmtPct(u3.val)}`);
        else if (t.endsWith("ChargeAttackMultiplier")) makeTier3("蓄力攻击伤害提升", "Charged Attack DMG", "차지 공격 피해 증가", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
        else if (t.endsWith("ComboMultiplier")) makeTier3("每段伤害增幅", "DMG Ramp per Hit", "타격당 피해 증가", `+${fmtPct(u1.val)}`, `+${fmtPct(u2.val)}`, `+${fmtPct(u3.val)}`);
        else if (t.endsWith("StrongDefense")) makeTier3("蓄力受伤害降低", "Charge DMG Taken", "차지 중 받는 피해 감소", `-${fmtPct(1 - u1.val)}`, `-${fmtPct(1 - u2.val)}`, `-${fmtPct(1 - u3.val)}`);
        else if (t.endsWith("BleedAttack")) makeTier3("对异常状态敌人伤害提升", "DMG vs Status Targets", "상태이상 적 대상 피해 증가", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
        else if (t.endsWith("GreenFireAttackMultiplier")) makeTier3("磷火降低敌人攻击力", "Enemy ATK Reduction", "인화 적 공격력 감소", `-${fmtPct(1 - u1.val)}`, `-${fmtPct(1 - u2.val)}`, `-${fmtPct(1 - u3.val)}`);
        else if (t.endsWith("SummonLifeTime")) makeTier3("召唤物在场时间", "Summon Duration", "소환물 지속 시간", `${u1.val}`, `${u2.val}`, `${u3.val}`, true);
        else if (t.endsWith("ProjectileDuration")) makeTier3("光轮剑持续时间", "Halo Blade Duration", "광륜검 지속 시간", `${u1.val}`, `${u2.val}`, `${u3.val}`, true);
        else if (t.endsWith("Time")) makeTier3("场域持续时间", "Field Duration", "영역 지속 시간", `${u1.val}`, `${u2.val}`, `${u3.val}`, true);
        else if (t.endsWith("FlameDamage")) makeTier3("地面火焰伤害倍率", "Fire Ground DMG", "지면 화염 피해 배율", fmtPct(u1.val), fmtPct(u2.val), fmtPct(u3.val));
        else if (t.endsWith("BlueBulletDamage")) makeTier3("蓝/红音刃伤害提升", "Blue/Red Note DMG", "푸른/붉은 음인 피해 증가", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
        else if (t.endsWith("Physical") && descKey.includes("010_10")) makeTier3("最佳射程伤害/杀气/削韧提升", "Sweet-spot DMG/Sha-Chi/Poise", "최적 사거리 피해/살기/강인도 증가", `+${fmtPct(u1.val - 1)}`, `+${fmtPct(u2.val - 1)}`, `+${fmtPct(u3.val - 1)}`);
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
