import path from 'node:path';
import { profileProject } from '../src/profile/profiler.js';
import { configGet } from '../src/profile/config.js';

/** 用法：npm run profile -- <项目根路径> [--json] */
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const root = args.find((a) => !a.startsWith('--'));

if (!root) {
  console.error('usage: npm run profile -- <项目根路径> [--json]');
  process.exit(1);
}

const p = await profileProject(root);

if (jsonMode) {
  console.log(JSON.stringify(p, null, 2));
} else {
  const mb = (p.scale.totalBytes / 1024 / 1024).toFixed(1);
  console.log(`== 项目画像：${p.root} ==`);
  console.log(`引擎 exe   : ${p.engine.exeFiles.join(', ') || '(未找到)'}`);
  console.log(
    `版本       : NOW_VERSION=${p.variant?.nowVersion ?? '-'}  eraTW=${p.variant?.eraVersion ?? '-'}`,
  );
  if (p.variant?.subVersion) console.log(`             ${p.variant.subVersion}`);
  console.log(`配置       : ${p.engine.configFound ? `emuera.config（${p.config?.entries.length ?? 0} 项）` : '(未找到)'}`);
  if (p.engine.lazyLoadingEntries.length > 0) {
    console.log(`懒加载目录 : ${p.engine.lazyLoadingEntries.join(' / ')}`);
  }
  console.log(`规模       : ERB ${p.scale.erbFileCount} 个 / CSV ${p.scale.csvFileCount} 个 / ${mb} MB`);
  console.log('ERB 顶层目录:');
  for (const d of p.directories.slice(0, 10)) {
    console.log(`  ${String(d.fileCount).padStart(5)}  ${d.name}（ERB ${d.erbCount}）`);
  }
  console.log('变量家族:');
  for (const f of p.variableFamilies.slice(0, 8)) {
    console.log(`  ${f.name.padEnd(12)} als=${f.alsEnumCount} csv=${f.csvEnumCount}  例: ${f.sampleNames.join('、')}`);
  }
  console.log(`角色 CSV   : ${p.characters.charaCsvCount}`);
  console.log(`口上       : ${p.koujo.present ? `個人口上 ${p.koujo.personalDirCount} 个角色目录` : '(未找到)'}`);
  console.log(`魔改       : ${p.modding.moddingDirPresent ? '魔改内容 存在' : '(未找到)'}`);
  console.log(
    `编码采样   : BOM ${p.encoding.utf8Bom} / UTF-8 ${p.encoding.utf8} / CP932 ${p.encoding.cp932} / 未知 ${p.encoding.unknown}（${p.encoding.sampledFiles} 个样本）`,
  );
  if (p.config) {
    const lang = configGet(p.config, 'EMUERA INTERFACE LANGUAGE');
    if (lang) console.log(`引擎界面语言: ${lang}`);
  }
  console.log('提示:');
  for (const h of p.hints) console.log(`  - ${h}`);
}
