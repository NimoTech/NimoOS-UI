<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/SearchFileDrawer.vue -->
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { openFileInNewTab } from '../../services/openInApp'

interface DrawerFile {
  name?: string
  path?: string
  kind?: string
  score?: number
  snippet?: string | null
}

const props = withDefaults(
  defineProps<{ file: DrawerFile; terms?: string[] }>(),
  { terms: () => [] },
)
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

const fileKind = computed(() => ((props.file && props.file.kind) || '').toLowerCase())

const highlightedSnippet = computed(() => {
  if (!props.file || !props.file.snippet) return ''
  return highlightText(props.file.snippet, props.terms)
})

function scoreColor(score: number | null | undefined): string {
  if (!score) return 'var(--text-tertiary)'
  if (score >= 0.9) return 'var(--accent)'
  if (score >= 0.8) return 'var(--teal)'
  if (score >= 0.7) return 'var(--warning)'
  return 'var(--text-tertiary)'
}

function kindColor(kind: string): string {
  const map: Record<string, string> = {
    pdf: 'var(--kind-pdf)',
    doc: 'var(--kind-doc)',
    docx: 'var(--kind-doc)',
    xls: 'var(--kind-xls)',
    xlsx: 'var(--kind-xls)',
    md: 'var(--kind-md)',
    txt: 'var(--kind-txt)',
    zip: 'var(--kind-archive)',
    ppt: 'var(--kind-archive)',
    pptx: 'var(--kind-archive)',
  }
  return map[kind] || 'var(--kind-txt)'
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlightText(text: string, terms: string[]): string {
  if (!terms || !terms.length || !text) {
    return escapeHtml(text || '')
  }
  const escaped = terms.filter(Boolean)
    .map((t2) => t2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  if (!escaped.length) return escapeHtml(text)
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return escapeHtml(text).replace(re, '<mark>$1</mark>')
}

function openInFileManager() {
  // Open the Files page in a new tab, located to this file's directory and
  // highlighting it. The drawer stays open (user may still want the detail).
  openFileInNewTab(props.file.path || '')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="sfd-overlay" @click.self="emit('close')">
    <div class="sfd-modal" @click.stop>
      <!-- File icon header -->
      <div class="sfd-header">
        <div class="sfd-icon-big">
          <div class="sfd-corner" />
          <span class="sfd-kind-tag" :style="{ background: kindColor(fileKind) }">{{ fileKind.toUpperCase() }}</span>
        </div>
        <button class="sfd-close" @click="emit('close')">
          <AgentIcon name="x" :size="15" color="var(--text-secondary)" />
        </button>
      </div>

      <div class="sfd-body">
        <div class="sfd-name">{{ file.name }}</div>
        <div class="sfd-path">{{ file.path }}</div>

        <div v-if="file.snippet" class="sfd-snippet-box">
          <div class="sfd-snippet-label">
            <AgentIcon name="sparkle" :size="11" color="var(--accent)" /> {{ t('aiMatchedPassage') }}
          </div>
          <div class="sfd-snippet-text" v-html="highlightedSnippet" />
        </div>

        <div class="sfd-meta-grid">
          <div class="sfd-meta-item">
            <span class="sfd-meta-label">{{ t('aiSimilarity') }}</span>
            <span class="sfd-meta-value" :style="{ color: scoreColor(file.score) }">{{ (file.score || 0).toFixed(3) }}</span>
          </div>
          <div class="sfd-meta-item">
            <span class="sfd-meta-label">{{ t('aiTypeLabel') }}</span>
            <span class="sfd-meta-value">{{ (file.kind || '—').toUpperCase() }}</span>
          </div>
          <div class="sfd-meta-item" style="border-bottom: none">
            <span class="sfd-meta-label">{{ t('aiPathLabel') }}</span>
            <span class="sfd-meta-value sfd-path-value">{{ file.path }}</span>
          </div>
        </div>

        <button class="sfd-open-btn" @click="openInFileManager">
          <AgentIcon name="folder" :size="14" /> {{ t('aiOpenInFileManager') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sfd-overlay {
  position: fixed;
  inset: 0;
  /* Above SearchFullResults' modal (also z-index 9999): on the /search page the
     results modal stays mounted while this drawer opens over it. */
  z-index: 10000;
  background: var(--modal-scrim);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: grid;
  place-items: center;
  padding: 24px;
  animation: sfdFadeIn 180ms ease;
}
.sfd-modal {
  width: min(460px, 90vw);
  background: var(--bg-elevated);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  animation: sfdPopIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sfd-header {
  padding: 24px 18px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--line-faint);
}
.sfd-icon-big {
  width: 56px;
  height: 68px;
  border-radius: 6px;
  background: var(--paper-surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
  position: relative;
}
.sfd-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  border-bottom-left-radius: 5px;
  background: linear-gradient(225deg, transparent 50%, var(--line) 50%);
}
.sfd-kind-tag {
  position: absolute;
  bottom: 7px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--text-on-accent);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.sfd-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--bg-chip);
  border: none;
  transition: background 120ms ease;
}
.sfd-close:hover { background: var(--line-faint); }
.sfd-body { padding: 16px 18px 20px; }
.sfd-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: center;
  color: var(--text-primary);
}
.sfd-path {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 4px;
  word-break: break-all;
}
.sfd-snippet-box {
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--bg-sunken);
  border-radius: var(--r-sm);
  border: 1px solid var(--line-faint);
}
.sfd-snippet-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sfd-snippet-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.sfd-snippet-text :deep(mark) {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
}
.sfd-meta-grid {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--line-faint);
  border-radius: var(--r-sm);
  overflow: hidden;
}
.sfd-meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-faint);
  font-size: 12px;
  background: var(--bg-elevated);
}
.sfd-meta-label { color: var(--text-tertiary); }
.sfd-meta-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.sfd-path-value {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  text-align: right;
  word-break: break-all;
  max-width: 60%;
}
.sfd-open-btn {
  width: 100%;
  margin-top: 14px;
  padding: 9px 14px;
  border-radius: var(--r-sm);
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: none;
  cursor: pointer;
  transition: background 120ms ease;
  font-family: var(--font-sans);
}
.sfd-open-btn:hover { background: var(--accent-hover); }

@keyframes sfdFadeIn {
  from { backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
  to { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
}
@keyframes sfdPopIn {
  from { transform: scale(0.96) translateY(6px); }
  to { transform: scale(1) translateY(0); }
}
</style>
