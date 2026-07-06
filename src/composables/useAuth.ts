import { service } from '@nimotech/nimoos-service'
import { useSessionStore } from '../stores/session'

export function useAuth() {
  const session = useSessionStore()

  async function login(username: string, password: string): Promise<void> {
    const { token, user } = await service.users.login(username, password)
    session.setTokens(token.access_token, token.refresh_token, token.expires_at)
    session.setUser(user)
    session.setVersion('local')
  }

  async function registerAndLogin(username: string, password: string, key: string): Promise<void> {
    await service.users.register(username, password, key)
    const { token, user } = await service.users.login(username, password)
    session.setTokens(token.access_token, token.refresh_token, token.expires_at)
    session.setUser(user)
    let version = 'local'
    try { version = (await service.sys.getVersion()).current_version } catch { /* 降级 local */ }
    session.setVersion(version)
    sessionStorage.setItem('fromWelcome', 'true')
    await service.users.setCustomStorage('app_order', { data: ['App Store', 'Files'] })
  }

  function logout(): void {
    session.clear()
  }

  function checkStatus() {
    return service.users.getStatus()
  }

  return { login, registerAndLogin, logout, checkStatus }
}
