// SP8-P3a Task 2 — align JSON tags byte-for-byte with backend DTO `NimoOS-AI/service/skills.go:10-32`.
// Field order and naming correspond one-to-one with the backend struct; no new fields, no omissions
// (`trigger_human` see separate explanation below). Backend `GET /v1/ai/skills` and
// `GET /v1/ai/skills/:id` both directly `c.JSON(200, out)` bare-serialize this struct (or its
// array) — no envelope; consumers single-layer fetch (public constraint §4).
//
// [P3b final review M4] The three path comments in this file were previously mistakenly written
// as `/v2/ai/skills` — now corrected to `/v1/ai/skills`. Actual prefix: Go side `route/v2.go:88`
// has `e.Group(common.V2APIPath)`, `common/constants.go:23` defines `V2APIPath = “/v1/ai”` (“v2”
// refers to this batch of handlers' code generation/package name, not a URL version), routes hung
// at `route/v2.go:207-215` (`g.GET(“/skills”, ...)` etc.) — assembled is `/v1/ai/skills`, pure
// doc drift, does not affect runtime behavior (actual requests go through shared package
// `@nimotech/nimoos-service`, don't read the path strings in this comment block).

/** Align with backend `SkillFile` (skills.go:29-32). `size` is a display string already formatted
 *  by the backend (e.g., `"12 B"` / `"1.0 KB"` / `"(3 files)"`), not raw byte count. */
export interface SkillFile {
  name: string
  size: string
}

/** Align with backend `Skill` (skills.go:10-27). */
export interface Skill {
  id: string
  name: string
  title: string
  description: string
  trigger: string
  /** Backend `manifestToSkill` (skills.go:191-199) populates this based on trigger enum:
   *  `"Automatic"` / `"/"+name` / `"Manual"`. **This repo deprecated this field; do not render it
   *  on the UI** — instead map `trigger` enum through `triggerLabel()` in `skillsFormat.ts` to
   *  localized i18n keys (public constraint §3 deviation 4). Field kept only to faithfully describe
   *  the backend contract. */
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

// SP8-P3b Task 8 — coordinator pre-disambiguates ① (p3b-task-8-brief.md "authorized deviations").
// Purely moved from `AddSkillModal.vue` (originally an unexported component-internal interface),
// fields unchanged. Reason for exporting here: `SkillsSection.vue`'s `onCreate` handler needs
// this type annotation for the `@save` event's payload; interface does not acquire implicit index
// signature, writing parameter type as `Record<string, unknown>` is judged incompatible by
// `vue-tsc` (TS2345).

/** Align with the shape of a single script file in the `POST /v1/ai/skills` request body
 *  (one `scripts/*` entry in the bundle). */
export interface SkillScript {
  path: string
  content: string
}

/** Align with the shape of the `save` payload emitted by `AddSkillModal.vue`'s `submit()`,
 *  and the shape of the `service.ai.createSkill()` request body (`POST /v1/ai/skills`). */
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
