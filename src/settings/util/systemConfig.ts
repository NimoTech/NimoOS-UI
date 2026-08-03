import { service } from '@nimotech/nimoos-service'

/** 服务端自定义存储的 key。与 Vue2(SettingsPanel.vue 的 systemConfigName)和 stores/locale.ts 同一个。 */
export const SYSTEM_KEY = 'system'

/**
 * Vue2 `barData`(SettingsPanel.vue L938-946)的服务端形态。
 * 索引签名不是偷懒 —— 读改写必须把不认识的字段原样带回去,
 * 否则新 UI 一次保存就把旧 UI / 将来版本写进去的字段洗掉了。
 */
export interface SystemBlob {
  lang?: string
  timezone?: string
  search_switch?: boolean
  recommend_switch?: boolean
  /**
   * Vue2 有这个字段,但对应的「显示其他 Docker 容器应用」开关行恒不渲染
   * (notImportList 永远是空数组,SET_NOTIMPORT_LIST 从没被 commit)。
   * 本期不做那一行(债务 D15),但字段要保留,避免读改写把它丢了。
   */
  existing_apps_switch?: boolean
  rss_switch?: boolean
  disk_standby?: string
  [k: string]: unknown
}

/**
 * 默认值照 Vue2 L938-946,**但故意不含 `lang`** ——
 * Vue2 默认 en_us,New-UI 默认 zh_cn,语言归 stores/locale.ts 管,
 * 这里给默认值会在读取时把用户语言错误地"纠正"掉。
 */
export const SYSTEM_DEFAULTS: Readonly<SystemBlob> = Object.freeze({
  timezone: 'America/New_York',
  search_switch: true,
  recommend_switch: true,
  existing_apps_switch: true,
  rss_switch: false,
  disk_standby: 'never',
})

function coerce(raw: unknown): Record<string, unknown> {
  let data = raw
  // 后端会把这块当字符串存回来,不是总是对象(stores/locale.ts 早有这个兼容分支)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

/** 读原始整块(不合默认值)—— 只给 patch 内部用,保证写回去的是服务端真实全量。 */
async function readRaw(): Promise<Record<string, unknown>> {
  return coerce(await service.users.getCustomStorage(SYSTEM_KEY))
}

/**
 * 读配置(已合并默认值)。**失败不抛** —— 设置页拿不到配置也得能显示,
 * 显示默认值 + 用户一改就写,比整页白屏好。
 */
export async function readSystemConfig(): Promise<SystemBlob> {
  try {
    return { ...SYSTEM_DEFAULTS, ...(await readRaw()) }
  } catch (e) {
    console.warn('[systemConfig] read failed, using defaults', e)
    return { ...SYSTEM_DEFAULTS }
  }
}

/**
 * 串行队列。Vue2 的 saveData() 是整块覆写,而本仓库有多个入口
 * (general 页 4 个控件 + stores/locale.ts 的语言)都在同一个 key 上读改写 ——
 * 不串行的话并发保存会互相覆盖(移植纪律 #3)。
 * 队列**内部**重新读一次服务端,所以不依赖调用方手里的旧快照。
 */
let queue: Promise<unknown> = Promise.resolve()

export async function patchSystemConfig(patch: SystemBlob): Promise<SystemBlob> {
  // 无论上一环成功还是失败都接着排,单次失败不能卡死整条队列
  const run = queue.then(
    () => apply(patch),
    () => apply(patch),
  )
  queue = run.catch(() => undefined)
  return run
}

async function apply(patch: SystemBlob): Promise<SystemBlob> {
  const current = await readRaw()
  const next = { ...current, ...patch }
  await service.users.setCustomStorage(SYSTEM_KEY, next)
  return { ...SYSTEM_DEFAULTS, ...next }
}

/** 仅测试用:清空队列,避免用例间互相串。 */
export function __resetSystemConfigQueue(): void {
  queue = Promise.resolve()
}
