import { joinPath } from './pathOps'

// Linux 限制:单个路径段 NAME_MAX = 255 字节;全路径 PATH_MAX = 4096 字节(含结尾 NUL,
// 可用 4095)。按 UTF-8 字节数算(中文 3 字节/字)。后端对 ENAMETOOLONG 一路丢 error、
// 只回字面 "Fail"(route/v1/file.go MkdirAll / service/system.go),tus 上传更是在异步
// ingest 里静默失败 —— 前端前置校验是唯一能给出明确文案的地方(bug.txt #2)。
const NAME_MAX = 255
const PATH_MAX = 4095
const bytes = (s: string) => new TextEncoder().encode(s).length

export function nameTooLong(name: string): boolean { return bytes(name) > NAME_MAX }
export function pathTooLong(path: string): boolean { return bytes(path) > PATH_MAX }

/** 在 dir 下以 name 新建是否会超限。'name' = 名字本身超长;'path' = 拼接后全路径超长。 */
export function createBlocked(dir: string, name: string): 'name' | 'path' | null {
  if (nameTooLong(name)) return 'name'
  if (pathTooLong(joinPath(dir, name))) return 'path'
  return null
}
