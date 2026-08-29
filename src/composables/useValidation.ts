// Lightweight validation: return i18n error key or null (pass). No vee-validate dependency.
export function useValidation() {
  const required = (v: string): string | null => (v && v.trim() ? null : 'validateRequired')
  const minLen = (n: number) => (v: string): string | null => (v && v.length >= n ? null : 'validateMin6')
  const sameAs = (other: () => string) => (v: string): string | null => (v === other() ? null : 'validateConfirm')
  return { required, minLen, sameAs }
}
