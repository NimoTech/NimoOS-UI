export const PER_FILE_BLOB_CAP = 200 * 1024 * 1024
export const TOTAL_BLOB_BUDGET = 3 * 1024 * 1024 * 1024

export function canStoreBlob(size: number, used = 0): boolean {
  return size > 0 && size <= PER_FILE_BLOB_CAP && used + size <= TOTAL_BLOB_BUDGET
}
