// Extract file extension from a single file, byte-for-byte matches Vue2 mixins/mixin.js getFileExt:
//   name.substring(name.lastIndexOf('.') + 1) — returns whole name if no dot (Dockerfile→dockerfile),
//   dotfile returns segment after dot (.gitignore→gitignore). Only implementation in entire codebase, do not duplicate.
export function fileExt(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}
