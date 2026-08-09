import { defineStore } from 'pinia'
import { useUploadConflicts } from '../composables/useUploadConflicts'

/**
 * App-lifetime holder for the upload-conflict orchestration.
 *
 * The composable itself is unchanged and still takes injectable deps -- its own
 * tests keep calling it directly. What this store adds is a single instance
 * whose lifetime is the app's rather than one view's, which is the whole point
 * of SP12 Plan B ticket E:
 *
 * The dialog used to be owned by Files.vue. Navigating away tore it down while
 * `run()` was still awaiting an answer, and `onScopeDispose` could only rescue
 * the ONE batch that had already registered a resolver -- anything queued behind
 * it in the serial chain, or still waiting on its own listFolder call, reached
 * `ask()` afterwards with no dialog on screen and hung forever. The user saw
 * their dropped files quietly do nothing at all.
 *
 * A Pinia setup store is the smallest thing that fixes it: its effect scope
 * belongs to the pinia instance, so the composable's dispose hook now fires at
 * app teardown instead of at every navigation, and tests still get a fresh
 * instance from each `setActivePinia(createPinia())`.
 *
 * Note the unwrapping: `dialog` is a ref inside the composable, so store
 * consumers read `store.dialog.open`, not `store.dialog.value.open`.
 */
export const useUploadConflictsStore = defineStore('uploadConflicts', () => useUploadConflicts())
