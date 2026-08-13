// Both `UpdateDialog.vue` and `UpdateRow.vue` need this type, but `export` is not
// allowed inside a `<script setup>` block -- split into a tiny standalone module,
// imported in both places (brief, step 5 footnote).
export type UpdateKind = 'os' | 'app'
