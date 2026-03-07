import { execSync } from 'node:child_process';

let _cachedLocale: boolean | null = null;

/** @internal 仅用于测试 */
export function resetLocaleCache(): void {
  _cachedLocale = null;
}

export function isZhLocale(): boolean {
  if (_cachedLocale !== null) return _cachedLocale;

  // 1. 用户显式设置 CODETRUST_LANG=zh 优先级最高
  if (process.env.CODETRUST_LANG?.startsWith('zh')) {
    _cachedLocale = true;
    return true;
  }
  if (process.env.CODETRUST_LANG && !process.env.CODETRUST_LANG.startsWith('zh')) {
    _cachedLocale = false;
    return false;
  }

  // 2. 标准环境变量
  const envVars = [
    process.env.LANG,
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANGUAGE,
  ];
  for (const v of envVars) {
    if (v?.startsWith('zh')) {
      _cachedLocale = true;
      return true;
    }
  }

  // 3. macOS: 读取 AppleLocale（LANG 可能是 C.UTF-8 但系统实际是中文）
  if (process.platform === 'darwin') {
    try {
      const appleLocale = execSync('defaults read -g AppleLocale 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 1000,
      }).trim();
      if (appleLocale.startsWith('zh')) {
        _cachedLocale = true;
        return true;
      }
    } catch {
      // ignore
    }
  }

  _cachedLocale = false;
  return false;
}

export function t(en: string, zh: string): string {
  return isZhLocale() ? zh : en;
}
