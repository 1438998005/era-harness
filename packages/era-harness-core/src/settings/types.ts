/**
 * 产品内嵌「设置自述」的运行时结构。
 *
 * 与 `knowledge/`（游戏侧纪律与机制）平行但**分离**：这里是插件自身的可设置项元数据，
 * 用于回答「这个开关有什么用 / 默认值是什么 / 关掉会怎样」。
 *
 * 三层来源：
 * 1. `data/*.generated.ts` —— 构建时从代码抽取（FeatureToggle 数组 / package.json），⛔ 不手改；
 * 2. `data/overrides.ts`   —— 手写补充（什么时候该关、与哪些设置联动、未覆盖项白名单）；
 * 3. `query.ts`            —— 按需检索（MCP `setting_help` / 扩展原生工具）。
 */

/** 记录来源：决定 key 的语义，以及该记录是从哪段代码生成的 */
export type SettingSource = 'feature-toggle' | 'vscode-config' | 'state-key';

/** 一条设置项 */
export interface SettingRecord {
  /** 稳定键：feature 用 FeatureToggle.id；config 用完整键名；state 用 STATE_KEYS 的键 */
  key: string;
  /** 中文名（i18n 优先，缺失时回退英文 label） */
  title: string;
  /** 一句话：这个开关做什么 */
  summary: string;
  /** 默认值（序列化后的字面量）；源里读不到时省略，⛔ 不猜 */
  defaultValue?: string;
  /** 取值范围 / 类型提示，如 `boolean`、`"ask" | "always" | "never"` */
  valueType?: string;
  /** 分组：agent / editor / experimental / advanced / erabasic / terminal / api / auto-approve */
  category: string;
  /** 运行时存储位置：`state-key:<键>` / `vscode-config:<键>` / `nested:<父键>.<子键>` */
  storage: string;
  /** 关闭后会怎样（只来自 overrides；不确定时省略，⛔ 不猜） */
  whenOff?: string;
  /** 相关设置 / 联动说明 */
  related?: string[];
  source: SettingSource;
}

/** 检索命中 */
export interface SettingHit {
  record: SettingRecord;
  /** 命中位置：key > title > summary > whenOff > category */
  field: 'key' | 'title' | 'summary' | 'whenOff' | 'category';
  score: number;
}
