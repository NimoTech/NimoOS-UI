import { service } from '@nimotech/nimoos-service'
import { joinPath } from '../util/pathOps'

// Create directories for empty dirs in drag-drop uploads. Backend POST /v1/folder uses
// MkdirAll, parent paths auto-filled. When directory exists, returns code 20001 (unwrap
// throws Error{code:20001}). For upload semantics of 'merge folder into existing folder
// with same name', this is success and must be tolerated.
const DIR_ALREADY_EXISTS = 20001

export async function createEmptyDirs(
  relPaths: string[],
  targetPath: string,
): Promise<{ created: number; failed: string[] }> {
  let created = 0
  const failed: string[] = []
  for (const rel of relPaths) {
    try {
      await service.folder.create(joinPath(targetPath, rel))
      created++
    } catch (e) {
      if ((e as { code?: number }).code === DIR_ALREADY_EXISTS) created++
      else failed.push(rel)
    }
  }
  return { created, failed }
}
