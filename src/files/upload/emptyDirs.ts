import { service } from '@nimotech/nimoos-service'
import { joinPath } from '../util/pathOps'

// 为拖拽上传里的空目录补建文件夹。后端 POST /v1/folder 走 MkdirAll,父链自动补齐;
// 目录已存在时返回业务码 20001(unwrap 抛 Error{code:20001}),对"把文件夹合并进
// 已有同名文件夹"的上传语义而言就是成功,必须容忍。
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
