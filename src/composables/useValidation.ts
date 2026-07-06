// 轻量校验:返回 i18n 错误键或 null(通过)。不引 vee-validate。
export function useValidation() {
  const required = (v: string): string | null => (v && v.trim() ? null : 'validateRequired')
  const minLen = (n: number) => (v: string): string | null => (v && v.length >= n ? null : 'validateMin6')
  const sameAs = (other: () => string) => (v: string): string | null => (v === other() ? null : 'validateConfirm')
  return { required, minLen, sameAs }
}
