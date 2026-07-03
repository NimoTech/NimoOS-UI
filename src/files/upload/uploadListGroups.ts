import type { UploadItem } from './types'

export interface UploadQueueGroups {
  problemItems: UploadItem[]
  activeItems: UploadItem[]
  doneItems: UploadItem[]
}

export function groupUploadQueue(queue: UploadItem[]): UploadQueueGroups {
  const problemItems: UploadItem[] = []
  const activeItems: UploadItem[] = []
  const doneItems: UploadItem[] = []

  for (const item of queue) {
    if (['error', 'needs_file', 'conflict'].includes(item.status)) {
      problemItems.push(item)
    } else if (item.status === 'done') {
      doneItems.push(item)
    } else if (['uploading', 'pending'].includes(item.status)) {
      activeItems.push(item)
    }
  }

  // Sort active items: uploading first, then pending
  activeItems.sort((a, b) => {
    if (a.status === 'uploading' && b.status !== 'uploading') return -1
    if (a.status !== 'uploading' && b.status === 'uploading') return 1
    return 0
  })

  // Sort done items by doneAt ?? createdAt ascending
  doneItems.sort((a, b) => {
    const aTime = a.doneAt ?? a.createdAt
    const bTime = b.doneAt ?? b.createdAt
    return aTime - bTime
  })

  return { problemItems, activeItems, doneItems }
}
