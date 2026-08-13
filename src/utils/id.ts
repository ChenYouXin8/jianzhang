/**
 * 生成全局唯一 id。
 * 优先用 crypto.randomUUID（安全上下文，如 https / localhost），
 * 否则回退时间戳 + 随机串 —— 保证部署在纯 http 环境也能工作。
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
