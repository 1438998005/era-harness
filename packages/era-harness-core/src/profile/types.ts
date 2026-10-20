export interface ConfigEntry {
  key: string;
  value: string;
}

export interface EmueraConfig {
  entries: ConfigEntry[];
  /** 键名统一大写后的查找表（大小写不敏感） */
  lookup: Record<string, string>;
}

export interface DimConstant {
  name: string;
  value?: string;
}

export interface DimInfo {
  file: string;
  constants: DimConstant[];
  /** 所有 #DIM/#DIMS 行数（含非常量声明） */
  dimCount: number;
}

export interface AlsEntry {
  id: number | null;
  name: string;
}

export interface VariableFamily {
  name: string;
  alsEnumCount: number;
  csvEnumCount: number;
  /** 采样枚举名（优先取 .csv 中文名） */
  sampleNames: string[];
}

export interface DirectoryInfo {
  /** ERB/ 下的顶层段名 */
  name: string;
  fileCount: number;
  erbCount: number;
}

export type EncodingKind = 'utf8Bom' | 'utf8' | 'cp932' | 'unknown';

export interface EncodingSample {
  sampledFiles: number;
  utf8Bom: number;
  utf8: number;
  cp932: number;
  unknown: number;
}

export interface ErbTreeScan {
  /** 全部 .ERB 文件路径 */
  files: string[];
  directories: DirectoryInfo[];
  /** ERB/ 下全部文件字节数 */
  totalBytes: number;
}

export interface ProjectProfile {
  root: string;
  profiledAt: string;
  engine: {
    exeFiles: string[];
    configFound: boolean;
    lazyLoadingEntries: string[];
  };
  config: EmueraConfig | null;
  variant: {
    nowVersion?: string;
    eraVersion?: string;
    subVersion?: string;
  } | null;
  scale: {
    erbFileCount: number;
    csvFileCount: number;
    totalBytes: number;
  };
  directories: DirectoryInfo[];
  variableFamilies: VariableFamily[];
  characters: { charaCsvCount: number };
  koujo: { present: boolean; personalDirCount: number };
  modding: { moddingDirPresent: boolean };
  encoding: EncodingSample;
  hints: string[];
}
