<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/SearchFullResults.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'

interface ResultImage { name?: string; path?: string; score?: number; thumbUrl?: string }
interface ResultFile { name?: string; path?: string; kind?: string; score?: number; snippet?: string | null }
interface ResultPassage { name?: string; source?: string; kind?: string; score?: number; snippet?: string }

const props = withDefaults(
  defineProps<{
    query?: string
    terms?: string[]
    model?: string
    scope?: string[]
    images?: ResultImage[]
    files?: ResultFile[]
    passages?: ResultPassage[]
    total?: number
    editableQuery?: boolean
  }>(),
  {
    query: '',
    terms: () => [],
    model: 'bge-m3 · CLIP',
    scope: () => [],
    images: () => [],
    files: () => [],
    passages: () => [],
    total: 0,
    editableQuery: false,
  },
)
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'search', q: string): void
  (e: 'image-click', img: ResultImage): void
  (e: 'file-click', f: ResultFile | ResultPassage): void
}>()
const { t } = useI18n()

// This PALETTES array is a generative, seed-indexed placeholder
// mosaic (matches VideoCard/ImageGridCard's exception; see tokens.scss header).
const PALETTES = [
  ['#FF9A8B', '#FF6A88'], ['#A1C4FD', '#C2E9FB'],
  ['#FBC2EB', '#A6C1EE'], ['#84FAB0', '#8FD3F4'],
  ['#FAD0C4', '#FFD1FF'], ['#A18CD1', '#FBC2EB'],
]

const activeSection = ref('all')
const queryDraft = ref(props.query)

watch(() => props.query, (v) => { queryDraft.value = v })

const sectionFilters = computed(() => {
  const filters = [{ id: 'all', label: t('aiAll'), count: props.images.length + props.files.length + props.passages.length }]
  if (props.images.length) filters.push({ id: 'image', label: t('aiPhotosLabel'), count: props.images.length })
  if (props.files.length) filters.push({ id: 'file', label: t('aiFilesLabel'), count: props.files.length })
  if (props.passages.length) filters.push({ id: 'semantic', label: t('aiSemanticPassagesLabel'), count: props.passages.length })
  return filters
})
const showImages = computed(() => activeSection.value === 'all' || activeSection.value === 'image')
const showFiles = computed(() => activeSection.value === 'all' || activeSection.value === 'file')
const showPassages = computed(() => activeSection.value === 'all' || activeSection.value === 'semantic')
const visibleCount = computed(() => {
  let n = 0
  if (showImages.value) n += props.images.length
  if (showFiles.value) n += props.files.length
  if (showPassages.value) n += props.passages.length
  return n
})

function submitQuery() {
  const q = (queryDraft.value || '').trim()
  if (!q) return
  emit('search', q)
}
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
function kindIcon(kind: string | undefined): string {
  const map: Record<string, string> = { pdf: 'file', doc: 'file', docx: 'file', xls: 'file', xlsx: 'file', md: 'edit', txt: 'file', zip: 'folder' }
  return map[(kind || '').toLowerCase()] || 'file'
}
function escapeHtml(str: string): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function highlightText(text: string | undefined): string {
  const terms = props.terms
  if (!terms || !terms.length || !text) return escapeHtml(text || '')
  const escaped = terms.filter(Boolean)
    .map((tm) => tm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  if (!escaped.length) return escapeHtml(text)
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return escapeHtml(text).replace(re, '<mark>$1</mark>')
}
function placeholderStyle(i: number) {
  const p = PALETTES[i % PALETTES.length]
  const angle = (i * 47) % 360
  return { background: `linear-gradient(${angle}deg, ${p.join(', ')})` }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="sfr-overlay" @click.self="emit('close')">
    <div class="sfr-modal" @click.stop>
      <!-- Title bar -->
      <div class="sfr-title-bar">
        <div class="sfr-title-left">
          <div class="sfr-title-icon">
            <AgentIcon name="search" :size="14" color="var(--text-on-accent)" />
          </div>
          <div>
            <div class="sfr-title-text">{{ t('aiAllSearchResults') }}</div>
            <input
              v-if="editableQuery"
              v-model="queryDraft"
              class="sfr-title-input"
              :placeholder="query"
              @keyup.enter="submitQuery"
            />
            <div v-else class="sfr-title-query">"{{ query }}"</div>
          </div>
        </div>
        <div class="sfr-title-meta">
          <span class="sfr-meta-chip">
            <span class="sfr-dot-iri" />
            {{ model }}
          </span>
        </div>
        <button class="sfr-close-btn" @click="emit('close')">
          <AgentIcon name="x" :size="15" color="var(--text-secondary)" />
        </button>
      </div>

      <!-- Section filter bar -->
      <div class="sfr-filter-bar">
        <button
          v-for="s in sectionFilters"
          :key="s.id"
          class="sfr-filter-btn"
          :class="{ active: activeSection === s.id }"
          @click="activeSection = s.id"
        >
          {{ s.label }}
          <span class="sfr-filter-count">{{ s.count }}</span>
        </button>
        <span style="flex: 1" />
        <span class="sfr-summary">{{ t('aiMatchesShowing', { total, visibleCount }) }}</span>
      </div>

      <!-- Results list -->
      <div class="sfr-results scroll">
        <!-- Images section -->
        <div v-if="showImages && images.length > 0" class="sfr-section">
          <div class="sfr-section-head">
            <span class="sfr-sec-ic sfr-sec-ic--img">
              <AgentIcon name="image" :size="10" color="var(--text-on-accent)" />
            </span>
            <span style="font-weight: 600">{{ t('aiPhotosLabel') }}</span>
            <span class="sfr-sec-count">{{ images.length }}</span>
          </div>
          <div class="sfr-image-grid">
            <div
              v-for="(img, i) in images"
              :key="i"
              class="sfr-image-card"
              @click="emit('image-click', img)"
            >
              <div class="sfr-image-thumb">
                <img v-if="img.thumbUrl" :src="img.thumbUrl" :alt="img.name" class="sfr-thumb-img" />
                <div v-else class="sfr-thumb-placeholder" :style="placeholderStyle(i)" />
                <div class="sfr-image-score">{{ Math.round((img.score || 0) * 100) }}%</div>
              </div>
              <div class="sfr-image-info">
                <div class="sfr-image-name">{{ img.name }}</div>
                <div class="sfr-image-path">{{ img.path }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Files section -->
        <div v-if="showFiles && files.length > 0" class="sfr-section">
          <div class="sfr-section-head">
            <span class="sfr-sec-ic sfr-sec-ic--file">
              <AgentIcon name="file" :size="10" color="var(--text-on-accent)" />
            </span>
            <span style="font-weight: 600">{{ t('aiFilesLabel') }}</span>
            <span class="sfr-sec-count">{{ files.length }}</span>
          </div>
          <div class="sfr-file-list">
            <div
              v-for="(f, i) in files"
              :key="i"
              class="sfr-file-item"
              @click="emit('file-click', f)"
            >
              <div class="sfr-file-icon">
                <div class="sfr-file-icon-corner" />
                <span class="sfr-file-kind-tag" :style="{ background: kindColor((f.kind || '').toLowerCase()) }">
                  {{ (f.kind || '').toUpperCase() }}
                </span>
              </div>
              <div style="flex: 1; min-width: 0">
                <div class="sfr-file-name">{{ f.name }}</div>
                <div class="sfr-file-path">{{ f.path }}</div>
                <div v-if="f.snippet" class="sfr-file-snippet" v-html="highlightText(f.snippet)" />
              </div>
              <div class="sfr-file-score-wrap">
                <span class="sfr-file-score" :style="{ color: scoreColor(f.score) }">{{ (f.score || 0).toFixed(3) }}</span>
                <div class="sfr-score-bar">
                  <div class="sfr-score-bar-fill" :style="{ width: `${(f.score || 0) * 100}%`, background: scoreColor(f.score) }" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Passages section -->
        <div v-if="showPassages && passages.length > 0" class="sfr-section">
          <div class="sfr-section-head">
            <span class="sfr-sec-ic sfr-sec-ic--sem">
              <AgentIcon name="sparkle" :size="10" color="var(--text-on-accent)" />
            </span>
            <span style="font-weight: 600">{{ t('aiSemanticPassagesLabel') }}</span>
            <span class="sfr-sec-count">{{ passages.length }}</span>
          </div>
          <div class="sfr-passage-list">
            <div
              v-for="(p, i) in passages"
              :key="i"
              class="sfr-passage-item"
              @click="emit('file-click', p)"
            >
              <div class="sfr-passage-top">
                <div class="sfr-passage-src">
                  <AgentIcon :name="kindIcon(p.kind)" :size="12" color="var(--text-tertiary)" />
                  <span>{{ p.name || p.source }}</span>
                </div>
                <span class="sfr-passage-score" :style="{ color: scoreColor(p.score) }">{{ (p.score || 0).toFixed(3) }}</span>
              </div>
              <div class="sfr-passage-text" v-html="highlightText(p.snippet)" />
              <div class="sfr-passage-bar">
                <div class="sfr-passage-bar-fill" :style="{ width: `${(p.score || 0) * 100}%`, background: scoreColor(p.score) }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="sfr-footer">
        <AgentIcon name="sparkle" :size="13" color="var(--text-tertiary)" />
        <span>{{ t('aiPhotosCount', { n: images.length }) }} · {{ t('aiFilesCount', { n: files.length }) }} · {{ t('aiSemanticCount', { n: passages.length }) }}</span>
        <span style="flex: 1" />
        <span v-if="scope && scope.length > 0" class="sfr-footer-scope">{{ scope.join(' · ') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sfr-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--modal-scrim);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: grid;
  place-items: center;
  padding: 20px;
  animation: sfrFadeIn 180ms ease;
}
.sfr-modal {
  width: min(780px, 95vw);
  max-height: min(680px, 90vh);
  background: var(--bg-elevated);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  animation: sfrPopIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sfr-title-bar {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--line-faint);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.sfr-title-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.sfr-title-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--grad-iri);
  box-shadow: var(--icon-tile-glow);
  flex-shrink: 0;
}
.sfr-title-text { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.sfr-title-query { font-size: 12px; color: var(--text-secondary); margin-top: 1px; }
.sfr-title-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.sfr-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg-chip);
  border: 1px solid var(--line-faint);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-tertiary);
  white-space: nowrap;
}
.sfr-dot-iri {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--grad-iri);
  display: inline-block;
}
.sfr-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--bg-chip);
  border: none;
  transition: background 120ms ease;
  flex-shrink: 0;
  margin-left: 4px;
}
.sfr-close-btn:hover { background: var(--line-faint); }
.sfr-filter-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line-faint);
  background: var(--bg-sunken);
  flex-shrink: 0;
}
.sfr-filter-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: var(--r-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 140ms ease;
  font-family: var(--font-sans);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-tertiary);
}
.sfr-filter-btn.active {
  background: var(--bg-elevated);
  border-color: var(--line);
  box-shadow: var(--shadow-xs);
  color: var(--text-primary);
}
.sfr-filter-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-quaternary);
}
.sfr-summary {
  font-size: 11px;
  color: var(--text-quaternary);
}
.sfr-results {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}
.sfr-section {}
.sfr-section-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-faint);
}
.sfr-sec-ic {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.sfr-sec-ic--img { background: var(--grad-photo); }
.sfr-sec-ic--file { background: var(--grad-file); }
.sfr-sec-ic--sem { background: var(--grad-iri); }
.sfr-sec-count {
  font-family: var(--font-mono);
  color: var(--text-quaternary);
  margin-left: auto;
  text-transform: none;
  letter-spacing: 0;
}
/* Image grid */
.sfr-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.sfr-image-card {
  border-radius: var(--r-sm);
  overflow: hidden;
  border: 1px solid var(--line-faint);
  cursor: pointer;
  transition: border-color 140ms ease, box-shadow 140ms ease;
  background: var(--bg-elevated);
}
.sfr-image-card:hover {
  border-color: var(--line);
  box-shadow: var(--shadow-sm);
}
.sfr-image-thumb {
  position: relative;
  aspect-ratio: 1;
  background: var(--bg-chip);
  overflow: hidden;
}
.sfr-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sfr-thumb-placeholder {
  position: absolute;
  inset: 0;
}
.sfr-image-score {
  position: absolute;
  top: 5px;
  left: 5px;
  background: var(--photo-caption-scrim);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text-on-accent);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  border-radius: 999px;
}
.sfr-image-info { padding: 7px 8px; }
.sfr-image-name {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sfr-image-path {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
/* File list */
.sfr-file-list { display: flex; flex-direction: column; gap: 2px; }
.sfr-file-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background 120ms ease;
}
.sfr-file-item:hover { background: var(--bg-canvas); }
.sfr-file-icon {
  width: 30px;
  height: 36px;
  border-radius: 4px;
  position: relative;
  flex-shrink: 0;
  background: var(--paper-surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-xs);
  margin-top: 2px;
}
.sfr-file-icon-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-bottom-left-radius: 3px;
  background: linear-gradient(225deg, transparent 50%, var(--line) 50%);
}
.sfr-file-kind-tag {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 7px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 2px;
  color: var(--text-on-accent);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.sfr-file-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sfr-file-path {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sfr-file-snippet {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sfr-file-snippet :deep(mark) {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
}
.sfr-file-score-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
.sfr-file-score {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.sfr-score-bar {
  width: 40px;
  height: 3px;
  border-radius: 999px;
  background: var(--bg-chip);
  overflow: hidden;
}
.sfr-score-bar-fill { height: 100%; border-radius: 999px; }
/* Passages */
.sfr-passage-list { display: flex; flex-direction: column; gap: 6px; }
.sfr-passage-item {
  padding: 12px 14px;
  border-radius: var(--r-sm);
  background: var(--bg-sunken);
  border: 1px solid var(--line-faint);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}
.sfr-passage-item:hover {
  border-color: var(--line);
  background: var(--bg-canvas);
}
.sfr-passage-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.sfr-passage-src {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sfr-passage-score {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.sfr-passage-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.sfr-passage-text :deep(mark) {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
}
.sfr-passage-bar {
  margin-top: 8px;
  height: 3px;
  border-radius: 999px;
  background: var(--bg-chip);
  overflow: hidden;
}
.sfr-passage-bar-fill { height: 100%; border-radius: 999px; }
/* Footer */
.sfr-footer {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line-faint);
  background: var(--bg-sunken);
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.sfr-footer-scope {
  font-size: 11px;
  color: var(--text-quaternary);
}

@keyframes sfrFadeIn {
  from { backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
  to { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
}
@keyframes sfrPopIn {
  from { transform: scale(0.96) translateY(6px); }
  to { transform: scale(1) translateY(0); }
}
.sfr-title-input {
  margin-top: 1px;
  width: 100%;
  background: var(--bg-sunken);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 3px 8px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}
.sfr-title-input:focus { border-color: var(--accent); }
</style>
