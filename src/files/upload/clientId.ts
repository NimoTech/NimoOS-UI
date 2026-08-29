import { safeRandomUUID } from './uuid'

export function getClientId(): string {
  const key = 'nimoos:upload-client-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = safeRandomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
