// SP8-P1b Task 4 —— provide/inject 座(seam)。
//
// 目的:让未来的 Photos 内嵌场景在自己的根组件 provide 一个受限 profile 的
// store(`useAgentStore('photos')`),而深层子组件(如 Task 8 的确认卡片、
// Task 11 的 UserMessage)不再硬编码 `useAgentStore()`('general' 默认),
// 改用 `useProvidedAgentStore()` 去解析——有祖先 provide 时拿祖先的实例,
// 独立使用(无祖先 provide,如当前 shell 根 AgentPage.vue 本身)时回退到
// 默认 'general' store。
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
