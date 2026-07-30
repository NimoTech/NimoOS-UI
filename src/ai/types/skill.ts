// SP8-P3a Task 2 —— 逐字照后端 DTO `NimoOS-AI/service/skills.go:10-32` 的 json tag。
// 字段顺序与命名与后端 struct 一一对应,不新增/不省略字段(`trigger_human` 见下方
// 单独说明)。后端 `GET /v2/ai/skills`、`GET /v2/ai/skills/:id` 均直接
// `c.JSON(200, out)` 裸序列化该 struct(或其数组)——无信封,消费端单层取数
// (公共约束 §4)。

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
