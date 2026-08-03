// `UpdateDialog.vue`/`UpdateRow.vue` 都需要这个类型,但 `export` 在 `<script setup>`
// 块里不允许 —— 拆到独立小模块,两处 import(brief §步骤 5 脚注)。
export type UpdateKind = 'os' | 'app'
