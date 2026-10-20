// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
import type { ReferenceEntry } from '../types.js';
import { ENTRIES_PART_01 } from './part-01.js';
import { ENTRIES_PART_02 } from './part-02.js';
import { ENTRIES_PART_03 } from './part-03.js';
import { ENTRIES_PART_04 } from './part-04.js';
import { ENTRIES_PART_05 } from './part-05.js';
import { ENTRIES_PART_06 } from './part-06.js';
import { ENTRIES_PART_07 } from './part-07.js';
import { ENTRIES_PART_08 } from './part-08.js';

/** 上游版本（commit sha），改数据后必须一并更新 */
export const REFERENCE_SOURCE_SHA = '606670cd78b58f5d9a050013d1d3f41db5a87a1b';

/** 抓取时间（ISO） */
export const REFERENCE_FETCHED_AT = '2026-10-20T04:53:43.987Z';

/** 全部指令条目，按页面文件名排序 */
export const REFERENCE_ENTRIES: readonly ReferenceEntry[] = [
	...ENTRIES_PART_01,
	...ENTRIES_PART_02,
	...ENTRIES_PART_03,
	...ENTRIES_PART_04,
	...ENTRIES_PART_05,
	...ENTRIES_PART_06,
	...ENTRIES_PART_07,
	...ENTRIES_PART_08,
];

/** 条目数（≈ 上游 Reference 页数） */
export const REFERENCE_ENTRY_COUNT = 312;

/** 可检索的名字总数（一个页可能覆盖多个名字，如 SETCOLOR / RESETCOLOR） */
export const REFERENCE_NAME_COUNT = 653;
