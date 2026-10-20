import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { DimConstant, ProjectProfile, VariableFamily } from './types.js';
import { configGet, configGetBoolean, configGetNumber, parseEmueraConfig } from './config.js';
import { parseDimFile } from './dim.js';
import { parseAlsEntries, parseCsvEntries } from './csv.js';
import { countFilesByExt, sampleErbEncodings, scanErbTree } from './scan.js';

export interface ProfileOptions {
  /** 编码探测取样文件数，默认 30 */
  encodingSampleCount?: number;
  /** 每个变量家族保留的枚举名样本数，默认 5 */
  maxSampleNames?: number;
}

/** eratw 标准目录名（era 系通用日文目录） */
const KOJO_DIR = '口上・メッセージ関連';
const PERSONAL_DIR = '個人口上';
const MODDING_DIR = '魔改内容';
const DIM_FILES = ['DIM.ERH', 'DIM_als.ERH'];

/** 不作为变量家族统计的 CSV 名 */
const CSV_DENYLIST = new Set(['VARIABLESIZE']);

async function pathExists(p: string): Promise<boolean> {
  try {
    await readdir(p);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 从 eratw 工程根目录提取结构化项目画像。
 * 纯只读；任何文件缺失都降级为空值，不抛异常（根目录不存在除外）。
 */
export async function profileProject(root: string, options: ProfileOptions = {}): Promise<ProjectProfile> {
  const rootAbs = path.resolve(root);
  if (!(await pathExists(rootAbs))) {
    throw new Error(`项目根目录不存在: ${rootAbs}`);
  }
  const encodingSampleCount = options.encodingSampleCount ?? 30;
  const maxSampleNames = options.maxSampleNames ?? 5;

  // ---- 引擎 exe ----
  const rootEntries = await readdir(rootAbs, { withFileTypes: true });
  const exeFiles = rootEntries
    .filter((e) => e.isFile() && /^emuera.*\.exe$/i.test(e.name))
    .map((e) => e.name)
    .sort()
    .reverse();

  // ---- emuera.config ----
  const configText = await readTextIfExists(path.join(rootAbs, 'emuera.config'));
  const config = configText !== null ? parseEmueraConfig(configText) : null;

  // ---- lazyloading.cfg ----
  const lazyCfgText = await readTextIfExists(path.join(rootAbs, 'lazyloading.cfg'));
  const lazyLoadingEntries = lazyCfgText
    ? lazyCfgText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith(';'))
    : [];

  // ---- DIM.ERH / DIM_als.ERH ----
  const erbRoot = path.join(rootAbs, 'ERB');
  const constants: DimConstant[] = [];
  for (const name of DIM_FILES) {
    const text = await readTextIfExists(path.join(erbRoot, name));
    if (text === null) continue;
    const parsed = parseDimFile(text, name);
    for (const c of parsed.constants) {
      if (!constants.some((x) => x.name === c.name)) constants.push(c);
    }
  }
  const findConst = (name: string): string | undefined =>
    constants.find((c) => c.name.toUpperCase() === name.toUpperCase())?.value;
  /** 去掉 FORM 字符串前缀 @ 与首尾引号，便于阅读 */
  const stripValue = (v: string | undefined): string | undefined =>
    v === undefined ? undefined : v.replace(/^@/, '').replace(/^"(.*)"$/, '$1');
  const variant =
    constants.length > 0
      ? {
          nowVersion: stripValue(findConst('NOW_VERSION')),
          eraVersion: stripValue(findConst('eraTW_Version')),
          subVersion: stripValue(findConst('eraTW_SubVersion')),
        }
      : null;

  // ---- ERB 树扫描 ----
  const tree = await scanErbTree(erbRoot);

  // ---- 编码采样 ----
  const encoding = await sampleErbEncodings(tree.files, encodingSampleCount);

  // ---- CSV 变量家族 ----
  const csvRoot = path.join(rootAbs, 'CSV');
  const csvEntries = await readdir(csvRoot, { withFileTypes: true }).catch(() => []);
  const alsByName = new Map<string, string>();
  const csvByName = new Map<string, string>();
  for (const e of csvEntries) {
    if (!e.isFile()) continue;
    const m = /^(.+)\.(als|csv)$/i.exec(e.name);
    if (!m) continue;
    const base = (m[1] ?? '').toUpperCase();
    if (base.startsWith('_') || CSV_DENYLIST.has(base)) continue;
    const target = (m[2] ?? '').toUpperCase() === 'ALS' ? alsByName : csvByName;
    if (!target.has(base)) target.set(base, e.name);
  }
  const families: VariableFamily[] = [];
  for (const base of new Set([...alsByName.keys(), ...csvByName.keys()])) {
    const alsName = alsByName.get(base);
    const csvName = csvByName.get(base);
    const alsText = alsName ? await readTextIfExists(path.join(csvRoot, alsName)) : null;
    const csvText = csvName ? await readTextIfExists(path.join(csvRoot, csvName)) : null;
    const alsEntries = alsText ? parseAlsEntries(alsText) : [];
    const csvEntriesParsed = csvText ? parseCsvEntries(csvText) : [];
    const names = (csvEntriesParsed.length > 0 ? csvEntriesParsed : alsEntries)
      .slice(0, maxSampleNames)
      .map((e) => e.name);
    families.push({
      name: base,
      alsEnumCount: alsEntries.length,
      csvEnumCount: csvEntriesParsed.length,
      sampleNames: names,
    });
  }
  families.sort((a, b) => b.csvEnumCount + b.alsEnumCount - (a.csvEnumCount + a.alsEnumCount));

  // ---- 角色 CSV ----
  const charaCsvCount = await countFilesByExt(path.join(csvRoot, 'Chara'), ['.CSV']);

  // ---- CSV 总数（递归） ----
  const csvFileCount = await countFilesByExt(csvRoot, ['.CSV']);

  // ---- 口上 / 魔改 ----
  const personalDir = path.join(erbRoot, KOJO_DIR, PERSONAL_DIR);
  const koujoPresent = await pathExists(path.join(erbRoot, KOJO_DIR));
  let personalDirCount = 0;
  if (koujoPresent) {
    const personalEntries = await readdir(personalDir, { withFileTypes: true }).catch(() => []);
    personalDirCount = personalEntries.filter((e) => e.isDirectory()).length;
  }
  const moddingDirPresent = await pathExists(path.join(erbRoot, MODDING_DIR));

  // ---- 派生提示 ----
  const hints: string[] = [];
  if (configGetBoolean(config, 'USELAZYLOADING') === true) {
    hints.push('懒加载已开启（USELAZYLOADING=YES）：未加载文件的诊断可能延迟，单次日志干净≠无问题');
  }
  if (configGetBoolean(config, 'ALLOW DEBUG COMMANDS') === true) {
    hints.push('调试指令已允许（ALLOW DEBUG COMMANDS=YES）');
  }
  if (configGetBoolean(config, 'USE ERD') === true) {
    hints.push('ERD 命名生效（USE ERD=YES）：标识符定义来自 ERD 文件');
  }
  if (
    configGetBoolean(config, 'USE _RENAME.CSV FILE') === true ||
    configGetBoolean(config, 'USE _REPLACE.CSV FILE') === true
  ) {
    hints.push('_Rename/_Replace 生效：启动时重命名/替换标识符，静态索引需还原后再匹配');
  }
  if (configGetNumber(config, 'MINIMUM WARNING LEVEL') === 0) {
    hints.push('最低警告等级 0：启动警告量大，勿为消警告改逻辑');
  }
  if (configGetBoolean(config, 'SEARCH SUBFOLDERS') === true) {
    hints.push('递归加载子目录（SEARCH SUBFOLDERS=YES）+ 按文件名排序，索引可依赖此顺序');
  }
  if (exeFiles.length > 1) {
    hints.push(`检测到 ${exeFiles.length} 个引擎 exe：实际行为以启动的那个为准，注意版本差异`);
  }
  if (koujoPresent) {
    hints.push(`口上系统存在（個人口上 ${personalDirCount} 个角色目录）`);
  }
  if (moddingDirPresent) {
    hints.push('魔改内容目录存在：自研代码集中地，改动归属需先判定本体/口上身份');
  }
  const dual = families.filter((f) => f.alsEnumCount > 0 && f.csvEnumCount > 0);
  if (dual.length > 0) {
    hints.push(`${dual.length} 个变量家族同时存在 .als/.csv：简繁双语命名并存（如 CFLAG），修标识符必须查证`);
  }
  if (encoding.cp932 > 0) {
    hints.push(`编码采样发现 ${encoding.cp932} 个 CP932 文件：读写必须做编码探测与还原`);
  }

  return {
    root: rootAbs,
    profiledAt: new Date().toISOString(),
    engine: { exeFiles, configFound: config !== null, lazyLoadingEntries },
    config,
    variant,
    scale: {
      erbFileCount: tree.files.length,
      csvFileCount,
      totalBytes: tree.totalBytes,
    },
    directories: tree.directories,
    variableFamilies: families,
    characters: { charaCsvCount },
    koujo: { present: koujoPresent, personalDirCount },
    modding: { moddingDirPresent },
    encoding,
    hints,
  };
}
