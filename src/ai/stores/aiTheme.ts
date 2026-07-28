import { defineStore } from 'pinia'
import { ref } from 'vue'

// SP8-P2a Task 4 —— AI 区(Agent 页 + 设置页)共享的明暗主题。
//
// 【为什么要抽出来】Vue2 里 `Agent.vue` 与 `Settings.vue` 各持一份 theme,
// 靠同一个 localStorage key 对齐;因为 Vue2 路由切换会销毁并重建组件,
// data()/mounted 每次都重读 localStorage,用户感知是一致的。
//
// New-UI 的 Pinia store 是全局单例、切路由不销毁 —— 若两页各持一份 ref,
// 在设置页切成暗色、返回 /ai/agent 就不会变。这不是 Vue2 的 bug,是组件级
// store 换成单例 store 之后必然出现的行为差,必须在架构层解决。
//
// 做法与 SP8-P1c2 Task 7 的 `src/stores/userProfile.ts`(头像版本号上移)同款:
// 把状态提到它真正该在的层级,消费方各自读同一份。
//
// localStorage key 与 Vue2 逐字一致(`Agent.vue:80`、`Settings.vue:73`),
// 所以老应用与新应用的主题偏好互通。
const THEME_KEY = 'nimoos.ai.agent.theme'

export type AiTheme = 'light' | 'dark'

export const useAiTheme = defineStore('ai-theme', () => {
  const theme = ref<AiTheme>('light')

  /**
   * 装载一次持久化偏好。优先级与 Vue2 `Settings.vue:102-107` /
   * `Agent.vue:90-96` 一致:localStorage 合法值 → 系统 prefers-color-scheme →
   * 'light' 兜底。可重复调用(幂等)。
   */
  function hydrateTheme(): void {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') {
      theme.value = stored
      return
    }
    if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
      theme.value = 'dark'
      return
    }
    theme.value = 'light'
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, theme.value)
  }

  return { theme, toggleTheme, hydrateTheme }
})
