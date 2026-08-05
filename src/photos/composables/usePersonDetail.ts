// 详情页数据编排。Ported from Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:596(watch)、:728-759(loadPerson/groupByMonth)。
// 偏离登记 6:Vue2 没有任何竞态守卫,快速连点共现横条/关系图跳转别人时,慢的旧响应会覆盖新页面数据。
// 这里用 useLightbox.hydrateDetail(useLightbox.ts:100-124)的同款 seq:每次 load 自增,回写前比对,过期直接丢弃。
import { ref, shallowRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
import { toPerson, monthKeyLabel, type Person } from '../util/peopleView'

// Vue2 :741 硬编码 limit:300 / offset:0,无分页。照搬(改分页是新功能,记账留后续)。
// P8a-T10 挂账登记(只登记不改):这个 300 上限目前仍是唯一实现,没有"加载更多"/滚动分页——
// 人物资产超过 300 张时,详情页只会显示前 300 张(与 Vue2 行为一致,不是本次回归)。
const ASSET_LIMIT = 300

export interface PersonRelation { personId: string | number; name?: string; coverFaceId?: string | number | null; count: number }
export interface PersonPlace { placeName?: string | null; latitude?: number | null; longitude?: number | null }

// 照 Vue2 groupByMonth :749-759:按 takenAt 的**前 7 位字符串**分桶(不解析 Date),
// 键降序,'unknown' 桶靠稳定排序挪到末位。
// 注意:**不复用 util/groupPhotosByMonth.ts** —— 那个用 new Date() 解析后取本地时区的年月,
// 与字符串切片在跨时区/脏数据上结果不同;人物页保真走 Vue2 的字符串切片。
export function groupPersonAssets(photos: Photo[]): Month[] {
  const map: Record<string, Photo[]> = {}
  for (const p of photos) {
    const raw = typeof p.takenAt === 'string' ? p.takenAt : ''
    const key = raw ? raw.slice(0, 7) : 'unknown'
    ;(map[key] = map[key] ?? []).push(p)
  }
  return Object.keys(map)
    .sort()
    .reverse()
    .sort((a, b) => Number(a === 'unknown') - Number(b === 'unknown'))
    .map((key) => ({ key, title: monthKeyLabel(key), loc: '', photos: map[key] }))
}

export function usePersonDetail() {
  const person = ref<Person | null>(null)
  const relations = shallowRef<PersonRelation[]>([])
  const places = shallowRef<PersonPlace[]>([])
  const months = shallowRef<Month[]>([])
  const loading = ref(false)
  const failed = ref(false)
  let seq = 0
  // 评审 Important 3:seq 只保护 load() **自己**的回写(过期响应丢弃);容器方向的九条动作
  // 回写(patchPerson)此前完全没有对应机制。currentId 是"这个 composable 现在装着谁"的
  // 唯一事实,load() 一进门就同步置位(不等响应),所以路由一变、watch 一调 load(),
  // 上一位人物在途的 PATCH 就立刻被认成过期。
  let currentId: string | null = null

  // 铁律:id 比较一律 String() 归一。
  function isCurrent(id: string | number): boolean {
    return currentId !== null && String(id) === currentId
  }

  async function load(id: string | number): Promise<void> {
    const mine = ++seq
    currentId = String(id)
    loading.value = true
    failed.value = false
    // 照 Vue2 :731-734 —— 先清空再拉,避免旧人物的数据残留在新页面上。
    person.value = null
    relations.value = []
    places.value = []
    months.value = []
    try {
      const d = (await service.photos.getPerson(id)) as
        { person?: Record<string, unknown>; relations?: unknown } | undefined
      if (mine !== seq) return                                   // 过期响应,丢弃
      person.value = d?.person ? toPerson(d.person) : null
      relations.value = Array.isArray(d?.relations) ? (d?.relations as PersonRelation[]) : []

      const [pl, assets] = await Promise.all([
        service.photos.personPlaces(id),
        service.photos.getPersonAssets(id, ASSET_LIMIT, 0),
      ])
      if (mine !== seq) return                                   // 同上
      places.value = Array.isArray(pl) ? (pl as PersonPlace[]) : []
      const list = Array.isArray(assets) ? (assets as Record<string, unknown>[]) : []
      months.value = groupPersonAssets(list.map((a) => assetToPhoto(a)))
    } catch (e) {
      if (mine !== seq) return
      console.error('[photos-people] loadPerson', e)
      failed.value = true                                        // New-UI 补:让视图能区分「加载失败」与「没有这个人」
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  // 合一:Vue2 :510-512 与 :591-593 是逐字节重复的两个 computed(偏离登记 11)。
  function flatPhotos(): Photo[] { return months.value.flatMap((m) => m.photos) }

  // 评审 Important 3:**expectId 是必填的**,不是可选便利参数 —— 类型系统强制每个回写点
  // 声明"我以为自己在写谁",不声明就编译不过,未来新增动作也不可能绕过这道校验。
  //
  // 确定复现路径(评审给出,已用回归测试钉住):人物 A 页 → 改名 → PATCH 在途 → 按浏览器
  // 后退 → route watch 加载 B → B 就绪 → A 的 PATCH 才 resolve → 无校验时
  // patchPerson({name}) 命中的是 **B**,B 的 hero 姓名/顶栏/建相册默认名全变成 A 输入的名字,
  // 刷新才恢复。收藏/关系分组的**失败回滚**同理会把 A 的旧值写到 B 上。
  //
  // 返回值语义:true = "仍是同一个人物"(可能因 person.value 尚为 null 而实际没写,但调用方
  // 该继续走它的 toast);false = "已经切到别人了",调用方应连 toast 一起放弃 —— 属于 A 的
  // "重命名失败"弹在 B 的页面上同样是缺陷。
  function patchPerson(patch: Partial<Person>, expectId: string | number): boolean {
    if (!isCurrent(expectId)) return false
    if (person.value) person.value = { ...person.value, ...patch }
    return true
  }
  function removePhotosLocally(ids: Array<string | number>): void {
    const kill = new Set(ids.map((x) => String(x)))
    months.value = months.value
      .map((m) => ({ ...m, photos: m.photos.filter((p) => !kill.has(String(p.id))) }))
      .filter((m) => m.photos.length > 0)
  }

  return { person, relations, places, months, loading, failed, load, flatPhotos, isCurrent, patchPerson, removePhotosLocally }
}
