export interface ServiceConfig {
  getToken(): string | null
  getRefresh(): string | null
  setTokens(access: string, refresh: string, expiresAt?: string): void
  onAuthFail(): void
  getLang(): string
}

let current: ServiceConfig | null = null

export function setConfig(cfg: ServiceConfig): void { current = cfg }

export function getConfig(): ServiceConfig {
  if (!current) throw new Error('@nimotech/nimoos-service: initService() not called')
  return current
}
