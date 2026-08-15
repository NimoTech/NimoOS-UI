import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SettingsRail from './SettingsRail.vue'
import zh from '../../../i18n/zh_cn'

// SP8-P2a Task 7 —— 部分移植自 Vue2
// `src/views/AI/Settings/__tests__/SettingsRail.spec.js`。
// 该文件里针对 GROUPS 的三条断言已由 sections.test.ts(Task 3)承接;
// 这里承接它的 methods 断言(onSelect / toggleGroup / 初始展开),并把 Vue2 的
// `.call(ctx)` 写法升级成真挂载 —— 判别力只增不减。
//
// 用真 zh_cn locale(不手写 i18n 子集):P1c-2 记账过,手写子集会让组件里
// 拼错的键名抓不到。

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountRail(props: Record<string, unknown> = {}) {
  return mount(SettingsRail, {
    props: { activeId: 'models', ...props },
    global: { plugins: [i18n] },
  })
}

describe('SettingsRail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('渲染四个分组头', () => {
    const w = mountRail()
    expect(w.findAll('.set-nav-grouphead')).toHaveLength(4)
  })

  it('初始只展开 activeId 所在的组', () => {
    const w = mountRail({ activeId: 'search' })   // groupOf('search') === 'agent'
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads.map((h) => h.attributes('data-open')))
      .toEqual(['false', 'true', 'false', 'false'])
  })

  it('点分区 emit select', async () => {
    const w = mountRail({ activeId: 'search' })
    // ⚠️ 必须在该组的 groupbody 内取项,不能用全局 findAll 的下标 ——
    // 折叠用 v-show(照 Vue2 :22),13 项始终在 DOM 里,
    // 全局 [0] 取到的是 model 组的 'models' 而不是 agent 组的 'blacklist'。
    const agentBody = w.findAll('.set-nav-groupbody')[1]   // agent 组
    await agentBody.findAll('.set-nav-item')[0].trigger('click')
    expect(w.emitted('select')![0]).toEqual(['blacklist'])
  })

  it('skills / mcp 也只是 emit select(不自己跳路由)', async () => {
    const w = mountRail({ activeId: 'skills' })
    const skills = w.findAll('.set-nav-item').find((n) => n.text().includes('技能'))!
    await skills.trigger('click')
    expect(w.emitted('select')![0]).toEqual(['skills'])
  })

  it('点组头折叠/展开该组', async () => {
    const w = mountRail({ activeId: 'models' })
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads[0].attributes('data-open')).toBe('true')
    await heads[0].trigger('click')
    expect(w.findAll('.set-nav-grouphead')[0].attributes('data-open')).toBe('false')
    await w.findAll('.set-nav-grouphead')[0].trigger('click')
    expect(w.findAll('.set-nav-grouphead')[0].attributes('data-open')).toBe('true')
  })

  it('activeId 变到别的组时,自动展开新组(且不收起旧组)', async () => {
    const w = mountRail({ activeId: 'models' })
    await w.setProps({ activeId: 'memory' })    // → agent 组
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads[0].attributes('data-open')).toBe('true')   // model 组仍开着
    expect(heads[1].attributes('data-open')).toBe('true')   // agent 组被展开
  })

  it('高亮当前分区', () => {
    const w = mountRail({ activeId: 'providers' })
    const active = w.findAll('.set-nav-item').filter((n) => n.attributes('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('云端提供商')
  })

  it('modelCount 非零时在 models 项上渲染徽标', () => {
    const w = mountRail({ activeId: 'models', modelCount: 3 })
    expect(w.find('.set-nav-badge').text()).toBe('3')
  })

  it('modelCount 为 0 / null 时不渲染徽标(Vue2 :29 用的是真值判断)', () => {
    expect(mountRail({ modelCount: 0 }).find('.set-nav-badge').exists()).toBe(false)
    expect(mountRail({ modelCount: null }).find('.set-nav-badge').exists()).toBe(false)
  })

  it('返回按钮 emit back', async () => {
    const w = mountRail()
    await w.find('.set-rail-back').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('头像 URL 带共享 store 的版本号,bump 后变化', async () => {
    localStorage.setItem('access_token', 'tok')
    const { useUserProfile } = await import('../../../stores/userProfile')
    const w = mountRail()
    const before = w.find('.set-foot img').attributes('src')
    expect(before).toContain('v=1')
    useUserProfile().bumpAvatarVersion()
    await w.vm.$nextTick()
    expect(w.find('.set-foot img').attributes('src')).toContain('v=2')
  })

  it('无 token 时回落到自带默认头像', () => {
    const w = mountRail()
    expect(w.find('.set-foot img').attributes('src')).not.toContain('token=')
  })

  it('折叠的组其导航项仍留在 DOM 里(窄屏 CSS 靠 display:flex!important 平铺,v-if 会让它失效)', () => {
    const w = mountRail({ activeId: 'models' })
    // model 组展开、其余三组折叠;14 项应当全部渲染(Task 21 新增
    // 'mcpapprovals' 后从 13 变 14)
    expect(w.findAll('.set-nav-item')).toHaveLength(14)
    const bodies = w.findAll('.set-nav-groupbody')
    expect(bodies).toHaveLength(4)
  })
})
