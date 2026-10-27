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
import { ENTRIES_PART_09 } from './part-09.js';
import { ENTRIES_PART_10 } from './part-10.js';
import { ENTRIES_PART_11 } from './part-11.js';

/** 上游版本（commit sha），改数据后必须一并更新 */
export const REFERENCE_SOURCE_SHA = '41451be6091363e37ed066aaf04416decbf0127f';

/** 抓取时间（ISO） */
export const REFERENCE_FETCHED_AT = '2026-10-27T16:57:06.893Z';

/** 全部指令条目，按 id 排序 */
export const REFERENCE_ENTRIES: readonly ReferenceEntry[] = [
	...ENTRIES_PART_01,
	...ENTRIES_PART_02,
	...ENTRIES_PART_03,
	...ENTRIES_PART_04,
	...ENTRIES_PART_05,
	...ENTRIES_PART_06,
	...ENTRIES_PART_07,
	...ENTRIES_PART_08,
	...ENTRIES_PART_09,
	...ENTRIES_PART_10,
	...ENTRIES_PART_11,
];

/** 条目数（Reference 页 + Emuera 规格页切段 + tutorial 页） */
export const REFERENCE_ENTRY_COUNT = 404;

/** 可检索的名字总数（一个页可能覆盖多个名字，如 SETCOLOR / RESETCOLOR） */
export const REFERENCE_NAME_COUNT = 725;
