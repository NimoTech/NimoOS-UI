// SP8-P3a Task 2 —— 逐字照后端 DTO `NimoOS-AI/service/skills.go:10-32` 的 json tag。
// 字段顺序与命名与后端 struct 一一对应,不新增/不省略字段(`trigger_human` 见下方
// 单独说明)。后端 `GET /v1/ai/skills`、`GET /v1/ai/skills/:id` 均直接
// `c.JSON(200, out)` 裸序列化该 struct(或其数组)——无信封,消费端单层取数
// (公共约束 §4)。
//
// 【P3b 终审 M4】本文件三处路径注释此前误写成 `/v2/ai/skills`——已改成 `/v1/ai/skills`。
// 真实前缀:Go 侧 `route/v2.go:88` 是 `e.Group(common.V2APIPath)`,
// `common/constants.go:23` 定义 `V2APIPath = "/v1/ai"`(“v2” 指的是这批 handler 的
// 代码世代/包名,不是 URL 版本号),路由挂在 `route/v2.go:207-215`(`g.GET("/skills",
// ...)` 等)—— 拼起来是 `/v1/ai/skills`,纯文档漂移,不影响运行时行为(实际请求走
// 共享包 `@nimotech/nimoos-service`,不读这段注释里的路径字符串)。

/** 对齐后端 `SkillFile`(skills.go:29-32)。`size` 是后端已格式化好的展示串
 *  (如 `"12 B"` / `"1.0 KB"` / `"(3 files)"`),不是原始字节数。 */
export interface SkillFile {
  name: string
  size: string
}

/** 对齐后端 `Skill`(skills.go:10-27)。 */
export interface Skill {
  id: string
  name: string
  title: string
  description: string
  trigger: string
  /** 后端 `manifestToSkill`(skills.go:191-199)按 trigger 枚举现填
   *  `"Automatic"` / `"/"+name` / `"Manual"`。**本仓弃用这个字段,不得在界面上
   *  渲染** —— 改由 `trigger` 枚举经 `skillsFormat.ts` 的 `triggerLabel()` 映射到
   *  本地化 i18n 键(公共约束 §3 偏离 4)。留字段只是为了如实描述后端契约。 */
  trigger_human: string
  color: string
  icon: string
  enabled: boolean
  system: boolean
  author: string
  last_used: string
  calls: number
  files: SkillFile[]
  examples: string[]
  md: string
}

// SP8-P3b Task 8 —— 协调者预先解歧义①(p3b-task-8-brief.md「已授权的偏离」)。
// 纯搬移自 `AddSkillModal.vue`(原为未导出的组件内部 interface),字段一个字未改。
// 挪到这里导出的理由:`SkillsSection.vue` 的 `onCreate` 处理函数需要这个类型标注
// `@save` 事件的 payload;interface 不会获得隐式索引签名,把参数类型写成
// `Record<string, unknown>` 会被 `vue-tsc` 判为不兼容(TS2345)。

/** 对齐 `POST /v1/ai/skills` 请求体里单个脚本文件的形状(bundle 内一个 `scripts/*` 条目)。 */
export interface SkillScript {
  path: string
  content: string
}

/** 对齐 `AddSkillModal.vue` `submit()` emit 的 `save` payload 形状,也是
 *  `service.ai.createSkill()` 请求体的形状(`POST /v1/ai/skills`)。 */
export interface SkillFormPayload {
  name: string
  title: string
  description: string
  trigger: 'auto' | 'slash' | 'manual'
  color: string
  md: string
  examples: string[]
  scripts: SkillScript[]
}
