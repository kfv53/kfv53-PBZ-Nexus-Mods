# Changelog — PBZEnemyStatusBars（敌人/Boss 异常状态圆环）

## v1.3.4
- 正式发布精简版：移除临时抓图与探测代码，保留全部 7 种异常状态与三阶原版毒瓶图标，支持在 `PBZ Mods Menu` 中一键实时切换「原版图标 / 汉字模式」。

## v1.3.1 ~ v1.3.3
- 补读 `GA_Player_BuffTracker` 的 `btChargeRows`，成功命中中毒三阶毒瓶（`T_BuffUI_5/6/7`）与感电（`T_BuffUI_13`）。
- 修复在主菜单停留过久导致扫描尝试次数在进图前耗尽的问题（改为仅在主角 `Pawn` 存活进图后才计数）。
- 导出全部 9 张原生透明 PNG 贴图用于制作对比封面图。

## v1.3.0
- 新增 `PBZ Mods Menu` 实时开关 `useGameIcons`（使用游戏原版异常图标替代汉字），自动从玩家 `DT_BuffStatus` 读取并异步加载原版贴图。

## v1.2.3
- 中毒新增 1/2/3 阶视觉区分（1 阶嫩绿 `毒1` / 2 阶毒绿 `毒2` / 3 阶紫环毒绿字 `毒3` + `1.12×` 强调缩放）。

## v1.2.2
- 修复中毒结束后因底层残留 `Poison_Accumulation` 导致圆环常驻不消失的问题：改为严格以 `CharacterState.StatusInfliction.Poison` 标签存在与否控制显隐。

## v1.2.1
- 彻底移除每 800ms 遍历全游戏控件的 `WidgetTree.GetAllWidgets()` 字体扫描逻辑，消除 GC/销毁期间卡死隐患。

## v1.2.0
- 过滤 `resistance` / `cooldown` / `immune` / `hasaccumulation` / `decrement` 等非异常倒计时 GE（修复 60 秒抗性 GE 劫持 3 秒感电麻痹条的问题）。
- 感电圆环改为仅追踪 `Electrified_Accumulation`（不再混入 `Thunder_Accumulation`）。
- 加入 `250ms` GAS GE 查询缓存，优化轮询与刷新周期（`800ms` / `66ms`）并移除战斗高频写盘日志。

## v1.1.0
- 扩展覆盖游戏内全部 7 种底层异常状态（新增冰冻、感电、潮湿、混沌）并增加各自独立开关。

## v1.0.4
- 普通敌人状态圆环默认改为置于血条上方，并在 `PBZ Mods Menu` 新增 `enemyBarAbove` 开关支持实时切换上/下方。

## v1.0.3
- 将 Boss 状态圆环调整至 Boss 血条正上方，解决遮挡下方 Boss 名称的问题，并随圆圈尺寸自动调整上移间距。

## v1.0.2
- 改用按目标独立读取 `Infliction_Max`（避免 Boss 与小怪上限串值），扩展 DoT GE 匹配关键词并加入诊断日志。

## v1.0.1
- 修复圆环材质被误解包到母材质 `M_UI_CdBar_003` 的问题，保留原版实例材质 `MI_UI_CdBar_Debuff_001`。
- 接入 `Infliction_Max` 真实上限属性，同时支持 `Bleed_Accumulation` 与 `BloodBurst_Accumulation`。
- 移除可能误拦截 `WidgetComponent` 的 `IsVisible()` 提前跳过。

## v1.0.0
- 初始原型：实现出血、中毒、燃烧三类异常的圆形进度环与 DoT 倒计时，挂载至敌人与 Boss 血条并接入 `PBZ Mods Menu`。
