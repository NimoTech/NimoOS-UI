import { storeToRefs } from 'pinia'
import { useHomeUiStore } from '../stores/homeUi'
export function useEditMode() {
  const store = useHomeUiStore()
  const { editing } = storeToRefs(store)
  return { editing, toggleEdit: store.toggleEdit }
}
