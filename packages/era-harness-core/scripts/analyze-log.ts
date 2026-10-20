import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseLog } from '../src/log/parser.js';
import { summarizeDiagnostics } from '../src/log/taxonomy.js';

/** 用法：npm run analyze -- <日志文件路径> */
const file = process.argv[2];
if (!file) {
  console.error('usage: npm run analyze -- <log file path>');
  process.exit(1);
}

const text = await readFile(file, 'utf8');
const s = parseLog(text);
const sum = summarizeDiagnostics(s.diagnostics);

console.log(`== ${path.basename(file)} ==`);
console.log(`engine : ${s.engine?.raw ?? '(未识别)'}`);
console.log(`variant: ${s.variant ? `${s.variant.name} ${s.variant.version}` : '(未识别)'}`);
console.log(`session: lazyIndex=${s.session.lazyIndexCount ?? '-'} modified=${s.session.modifiedFileCount ?? '-'} load=${s.session.loadSeconds ?? '-'}s`);

if (s.fatalError) {
  console.log(`FATAL  : ${s.fatalError.exceptionClass}: ${s.fatalError.exceptionMessage}`);
  console.log(`         engine=${s.fatalError.engine}`);
}

console.log(`diagnostics: ${sum.total}`);
console.log('byKind:', JSON.stringify(sum.byKind));
console.log('bySeverity:', JSON.stringify(sum.bySeverity));

const byFile = new Map<string, number>();
for (const d of s.diagnostics) byFile.set(d.file, (byFile.get(d.file) ?? 0) + 1);
const topFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('topFiles:');
for (const [f, c] of topFiles) console.log(`  ${c}\t${f}`);

console.log('topIdentifiers:');
for (const { identifier, count } of sum.byIdentifier.slice(0, 8)) {
  console.log(`  ${count}\t${identifier}`);
}
