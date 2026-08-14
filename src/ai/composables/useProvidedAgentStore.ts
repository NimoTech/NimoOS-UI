// SP8-P1b Task 4 — provide/inject seam.
//
// Purpose: in future Photos embed scenario, allow the root component to provide a
// restricted profile store (`useAgentStore('photos')`), so deep child components (e.g.
// Task 8's confirm card, Task 11's UserMessage) no longer hardcode `useAgentStore()`
// ('general' default), but use `useProvidedAgentStore()` to resolve — when ancestor provides,
// gets that instance; when used standalone (no ancestor provides, like current shell root
// AgentPage.vue), falls back to default 'general' store.
import { inject, provide, type InjectionKey } from 'vue'
import { useAgentStore } from '../stores/agentStore'

type Store = ReturnType<typeof useAgentStore>

const AGENT_STORE_KEY: InjectionKey<Store> = Symbol('agentStore')

export function provideAgentStore(store: Store) {
  provide(AGENT_STORE_KEY, store)
}

// Falls back to the default 'general' store if no ancestor provided one (standalone use).
export function useProvidedAgentStore(): Store {
  return inject(AGENT_STORE_KEY, null) ?? useAgentStore()
}
