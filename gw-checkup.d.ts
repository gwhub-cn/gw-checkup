export type CheckLevel = 'ok' | 'warn';

export interface CheckItem {
  /** ok = 通过；warn = 建议复查 */
  level: CheckLevel;
  /** 检查项名称，如「文种结尾用语」 */
  title: string;
  /** 具体问题与建议改法 */
  detail: string;
}

export interface CheckResult {
  /** 0-100 综合评分 */
  score: number;
  items: CheckItem[];
}

/** 对一段公文纯文本做格式惯例自查（纯函数，不读写存储、不请求网络） */
export function check(text: string): CheckResult;

declare global {
  interface Window {
    GWCheckup?: { check: typeof check };
  }
}
