<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/SemanticSearchCard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import SearchImageLightbox from './SearchImageLightbox.vue'
import SearchFileDrawer from './SearchFileDrawer.vue'
import SearchFullResults from './SearchFullResults.vue'
import { openPhotoSetInNewTab, openFileInNewTab } from '../../services/openInApp'

interface SemImage { name?: string; path?: string; score?: number; thumbUrl?: string; assetId?: string | number; takenAt?: string }
interface SemFile { name?: string; path?: string; kind?: string; score?: number; snippet?: string | null }
interface SemPassage { name?: string; source?: string; kind?: string; score?: number; snippet?: string }

const props = withDefaults(
  defineProps<{
    query?: string
    terms?: string[]
    model?: string
    scope?: string[]
    corpus?: number | null
    durationMs?: number | null
    total?: number
    fileindexStatus?: string
    images?: SemImage[]
    files?: SemFile[]
    passages?: SemPassage[]
    warnings?: string[]
  }>(),
  {
    query: '',
    terms: () => [],
    model: 'bge-m3 · CLIP',
    scope: () => [],
    corpus: null,
    durationMs: null,
    total: 0,
    fileindexStatus: 'ready',
    images: () => [],
    files: () => [],
    passages: () => [],
    warnings: () => [],
  },
)
const { t } = useI18n()

// Generative, seed-indexed placeholder mosaic (same exception
// category as VideoCard/ImageGridCard/SearchFullResults; see tokens.scss header).
const PALETTES = [
  ['#FF9A8B', '#FF6A88'], ['#A1C4FD', '#C2E9FB'],
  ['#FBC2EB', '#A6C1EE'], ['#84FAB0', '#8FD3F4'],
  ['#FAD0C4', '#FFD1FF'], ['#A18CD1', '#FBC2EB'],
]

const activeTab = ref('all')
const lightboxPhoto = ref<{ id: string | number; title?: string } | null>(null)
const lightboxPhotoIdx = ref(0)
const detailFile = ref<SemFile | SemPassage | null>(null)
const showFullResults = ref(false)

const tabs = computed(() => {
  const tt = [{
    id: 'all',
    label: t('aiAll'),
    icon: 'layers',
    color: 'var(--grad-iri)',
    count: props.total || (props.images.length + props.files.length + props.passages.length),
  }]
  if (props.images.length) tt.push({ id: 'image', label: t('aiPhotosLabel'), icon: 'image', color: 'var(--grad-photo)', count: props.images.length })
  if (props.files.length) tt.push({ id: 'file', label: t('aiFilesLabel'), icon: 'file', color: 'var(--grad-file)', count: props.files.length })
  if (props.passages.length) tt.push({ id: 'semantic', label: t('aiSemanticLabel'), icon: 'sparkle', color: 'var(--grad-iri)', count: props.passages.length })
  return tt
})

const lightboxPhotos = computed(() =>
  (props.images || []).filter((img) => !!img.assetId).map((img) => ({
    id: img.assetId as string | number,
    title: img.name,
    date: img.takenAt || '',
    time: '',
    fav: false,
    filePath: img.path,
  })),
)

const activeWarnings = computed(() => {
  const w = props.warnings || []
  const msgs: string[] = []
  if (w.includes('images_unavailable')) msgs.push(t('aiPhotoSearchUnavailable'))
  if (w.includes('filenames_unavailable')) msgs.push(t('aiFilenameSearchUnavailable'))
  if (w.includes('semantic_unavailable')) msgs.push(t('aiSemanticSearchUnavailable'))
  return msgs
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
function openImage(rawIdx: number) {
  const imgs = props.images || []
  const img = imgs[rawIdx]
  if (!img || !img.assetId) return
  const photos = lightboxPhotos.value
  if (!photos || !photos.length) return
  const filteredIdx = photos.findIndex((p) => p.id === img.assetId)
  if (filteredIdx < 0) return
  lightboxPhotoIdx.value = filteredIdx
  lightboxPhoto.value = photos[filteredIdx]
}
function navLightbox(delta: number) {
  const photos = lightboxPhotos.value
  if (!photos || !photos.length) return
  const newIdx = Math.max(0, Math.min(photos.length - 1, lightboxPhotoIdx.value + delta))
  lightboxPhotoIdx.value = newIdx
  lightboxPhoto.value = photos[newIdx]
}
function openFile(f: SemFile | SemPassage) {
  detailFile.value = f
}
function openInPhotos() {
  openPhotoSetInNewTab(lightboxPhotos.value.map((p) => p.id), null)
}
function openImageInPhotos(img: SemImage) {
  if (img && img.assetId) openPhotoSetInNewTab(lightboxPhotos.value.map((p) => p.id), img.assetId)
}
function openFileInManager(f: SemFile) {
  if (f && f.path) openFileInNewTab(f.path)
}
function onFullImageClick(img: SemImage) {
  showFullResults.value = false
  if (!img || !img.assetId) return
  const rawIdx = (props.images || []).findIndex((x) => x.assetId === img.assetId && x.name === img.name)
  if (rawIdx >= 0) openImage(rawIdx)
}
function onFullFileClick(f: SemFile | SemPassage) {
  showFullResults.value = false
  detailFile.value = f
}
</script>

<template>
  <div>
    <div class="semcard">
      <!-- ── Header ── -->
      <div class="semcard-head">
        <div class="semcard-icon">
          <AgentIcon name="search" :size="15" color="var(--text-on-accent)" />
        </div>
        <div class="semcard-titles">
          <div class="semcard-title">{{ t('aiSemanticSearchTitle') }} · {{ total }} {{ t('aiMatchesLabel') }}</div>
          <div class="semcard-query">{{ t('aiQueryLabel') }} <b>"{{ query }}"</b></div>
        </div>
        <div class="semcard-model">
          <span class="dot-iri" />
          {{ model }}
        </div>
      </div>

      <!-- ── Meta strip ── -->
      <div class="semcard-meta">
        <span v-if="scope && scope.length > 0" class="semcard-meta-item">
          <AgentIcon name="folder" :size="12" /> {{ scope.join(' · ') }}
        </span>
        <span v-if="scope && scope.length > 0 && corpus != null" class="semcard-meta-sep">·</span>
        <span v-if="corpus != null" class="semcard-meta-item">
          <AgentIcon name="layers" :size="12" /> {{ t('aiVectorIndex') }} <code>{{ corpus.toLocaleString() }}</code> {{ t('aiItemsLabel') }}
        </span>
        <span v-if="(scope && scope.length > 0 || corpus != null) && durationMs" class="semcard-meta-sep">·</span>
        <span v-if="durationMs" class="semcard-meta-item">{{ (durationMs / 1000).toFixed(2) }}s</span>
      </div>

      <!-- scanning hint -->
      <div v-if="fileindexStatus === 'scanning'" class="semcard-scanning-hint">
        <AgentIcon name="refresh" :size="11" color="var(--text-tertiary)" />
        {{ t('aiFileindexBuilding') }}
      </div>

      <!-- warnings hint -->
      <div v-if="activeWarnings.length > 0" class="semcard-scanning-hint">
        <AgentIcon name="bell" :size="11" color="var(--text-tertiary)" />
        {{ activeWarnings.join(' · ') }}
      </div>

      <!-- ── Tab bar ── -->
      <div class="semcard-tabs">
        <button
          v-for="tb in tabs"
          :key="tb.id"
          class="semcard-tab-btn"
          :class="{ active: activeTab === tb.id }"
          @click="activeTab = tb.id"
        >
          <span class="semcard-tab-ic" :class="{ active: activeTab === tb.id }" :style="activeTab === tb.id ? { background: tb.color } : {}">
            <AgentIcon :name="tb.icon" :size="10" :stroke-width="2" :color="activeTab === tb.id ? 'var(--text-on-accent)' : 'var(--text-tertiary)'" />
          </span>
          {{ tb.label }}
          <span class="semcard-tab-count" :class="{ active: activeTab === tb.id }">{{ tb.count }}</span>
        </button>
      </div>

      <!-- ── Tab content ── -->
      <div class="semcard-body">
        <!-- "All" combined layout -->
        <div v-if="activeTab === 'all'" class="semcard-all-layout">
          <!-- Images strip -->
          <div v-if="images && images.length > 0" class="semcard-section">
            <div class="semcard-section-head">
              <span class="col-ic" data-c="img"><AgentIcon name="image" :size="10" color="var(--text-on-accent)" /></span>
              {{ t('aiPhotosLabel') }} <span class="count">{{ images.length }}</span>
            </div>
            <div class="semcard-img-strip">
              <div
                v-for="(img, i) in images.slice(0, 4)"
                :key="i"
                class="semcard-img-thumb"
                :title="img.name"
                @click="openImage(i)"
              >
                <img v-if="img.thumbUrl" :src="img.thumbUrl" :alt="img.name" class="semcard-thumb-real" />
                <div v-else class="semcard-thumb-placeholder" :style="placeholderStyle(i)" />
                <div class="semcard-img-thumb-score">{{ Math.round((img.score || 0) * 100) }}%</div>
                <div class="semcard-img-thumb-name">{{ img.name }}</div>
              </div>
              <div
                v-if="images.length > 4"
                class="semcard-img-more"
                @click="activeTab = 'image'"
              >
                +{{ images.length - 4 }}
              </div>
            </div>
          </div>

          <!-- Files list -->
          <div v-if="files && files.length > 0" class="semcard-section">
            <div class="semcard-section-head">
              <span class="col-ic" data-c="file"><AgentIcon name="file" :size="10" color="var(--text-on-accent)" /></span>
              {{ t('aiFilesLabel') }} <span class="count">{{ files.length }}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1px">
              <div
                v-for="(f, i) in files.slice(0, 3)"
                :key="i"
                class="semcard-filerow-v2"
                @click="openFile(f)"
              >
                <div class="semcard-fileicon-v2">
                  <div class="semcard-filecorner" />
                  <span class="semcard-filekind" :style="{ background: kindColor((f.kind || '').toLowerCase()) }">
                    {{ (f.kind || '').toUpperCase() }}
                  </span>
                </div>
                <div style="flex: 1; min-width: 0">
                  <div class="semcard-fname">{{ f.name }}</div>
                  <div class="semcard-fsnippet">{{ f.snippet ? (f.snippet.length > 50 ? f.snippet.slice(0, 50) + '…' : f.snippet) : f.path }}</div>
                </div>
                <span class="semcard-fscore" :style="{ color: scoreColor(f.score) }">{{ (f.score || 0).toFixed(2) }}</span>
                <button class="semcard-frow-open" :title="t('aiOpenInFileManager')" @click.stop="openFileInManager(f)">
                  <AgentIcon name="folder" :size="13" color="var(--text-tertiary)" />
                </button>
                <div class="semcard-fchev">
                  <AgentIcon name="chev" :size="11" color="var(--text-quaternary)" />
                </div>
              </div>
              <div
                v-if="files.length > 3"
                class="semcard-show-more"
                @click="activeTab = 'file'"
              >
                {{ t('aiViewAllFiles', { n: files.length }) }} <AgentIcon name="chev" :size="11" />
              </div>
            </div>
          </div>

          <!-- Passages preview in "all" tab (show up to 2) -->
          <div v-if="passages && passages.length > 0" class="semcard-section">
            <div class="semcard-section-head">
              <span class="col-ic" data-c="sem"><AgentIcon name="sparkle" :size="10" color="var(--text-on-accent)" /></span>
              {{ t('aiSemanticLabel') }} <span class="count">{{ passages.length }}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px">
              <div
                v-for="(p, i) in passages.slice(0, 2)"
                :key="i"
                class="semcard-passage-row"
                @click="openFile(p)"
              >
                <div class="semcard-passage-top">
                  <div class="semcard-passage-src">
                    <AgentIcon :name="kindIcon(p.kind)" :size="10" color="var(--text-tertiary)" />
                    <span>{{ p.name || p.source }}</span>
                  </div>
                  <span class="semcard-passage-score" :style="{ color: scoreColor(p.score) }">{{ (p.score || 0).toFixed(3) }}</span>
                </div>
                <div class="semcard-passage-text" v-html="highlightText(p.snippet)" />
                <div class="semcard-passage-bar">
                  <div class="semcard-passage-bar-fill" :style="{ width: `${(p.score || 0) * 100}%`, background: scoreColor(p.score) }" />
                </div>
              </div>
              <div v-if="passages.length > 2" class="semcard-show-more" @click="activeTab = 'semantic'">
                {{ t('aiViewAllSemanticPassages', { n: passages.length }) }} <AgentIcon name="chev" :size="11" />
              </div>
            </div>
          </div>
        </div>

        <!-- Image tab -->
        <div v-else-if="activeTab === 'image'">
          <div v-if="!images || images.length === 0" class="semcard-empty">{{ t('aiNoMatchingPhotos') }}</div>
          <div v-else class="semcard-image-grid">
            <div
              v-for="(img, i) in images"
              :key="i"
              class="semcard-image-cell"
              :title="img.name"
              @click="openImage(i)"
            >
              <img v-if="img.thumbUrl" :src="img.thumbUrl" :alt="img.name" class="semcard-cell-img" />
              <div v-else class="semcard-cell-placeholder" :style="placeholderStyle(i)" />
              <div class="semcard-img-thumb-score">{{ Math.round((img.score || 0) * 100) }}%</div>
              <div class="semcard-img-bottom-bar">
                <span class="semcard-img-bottom-name">{{ img.name }}</span>
              </div>
              <div class="semcard-img-hover-overlay">
                <AgentIcon name="search" :size="20" color="var(--text-on-accent)" />
                <span class="semcard-img-hover-hint">{{ t('aiClickToView') }}</span>
                <button class="semcard-img-open-photos" :title="t('aiOpenInPhotos')" @click.stop="openImageInPhotos(img)">
                  <AgentIcon name="image" :size="12" color="var(--text-on-accent)" />
                  {{ t('aiOpenInPhotos') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- File tab -->
        <div v-else-if="activeTab === 'file'">
          <div v-if="!files || files.length === 0" class="semcard-empty">{{ t('aiNoMatchingFiles') }}</div>
          <div v-else style="display: flex; flex-direction: column; gap: 1px">
            <div
              v-for="(f, i) in files"
              :key="i"
              class="semcard-filerow-full"
              @click="openFile(f)"
            >
              <div class="semcard-fileicon-v2">
                <div class="semcard-filecorner" />
                <span class="semcard-filekind" :style="{ background: kindColor((f.kind || '').toLowerCase()) }">
                  {{ (f.kind || '').toUpperCase() }}
                </span>
              </div>
              <div style="flex: 1; min-width: 0">
                <div class="semcard-fname">{{ f.name }}</div>
                <div class="semcard-fsnippet">{{ f.path }}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0">
                <span class="semcard-fscore" :style="{ color: scoreColor(f.score) }">{{ (f.score || 0).toFixed(2) }}</span>
                <button class="semcard-frow-open" :title="t('aiOpenInFileManager')" @click.stop="openFileInManager(f)">
                  <AgentIcon name="folder" :size="13" color="var(--text-tertiary)" />
                </button>
                <div class="semcard-fchev">
                  <AgentIcon name="chev" :size="12" color="var(--text-quaternary)" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Semantic tab -->
        <div v-else-if="activeTab === 'semantic'">
          <div v-if="!passages || passages.length === 0" class="semcard-empty">{{ t('aiNoMatchingSemanticPassages') }}</div>
          <div v-else style="display: flex; flex-direction: column; gap: 6px">
            <div
              v-for="(p, i) in passages"
              :key="i"
              class="semcard-passage-row"
              @click="openFile(p)"
            >
              <div class="semcard-passage-top">
                <div class="semcard-passage-src">
                  <AgentIcon :name="kindIcon(p.kind)" :size="10" color="var(--text-tertiary)" />
                  <span>{{ p.name || p.source }}</span>
                </div>
                <span class="semcard-passage-score" :style="{ color: scoreColor(p.score) }">{{ (p.score || 0).toFixed(3) }}</span>
              </div>
              <div class="semcard-passage-text" v-html="highlightText(p.snippet)" />
              <div class="semcard-passage-bar">
                <div class="semcard-passage-bar-fill" :style="{ width: `${(p.score || 0) * 100}%`, background: scoreColor(p.score) }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Footer ── -->
      <div class="semcard-foot">
        <AgentIcon name="sparkle" :size="13" color="var(--text-tertiary)" />
        {{ t('aiPhotosCount', { n: (images || []).length }) }} · {{ t('aiFilesCount', { n: (files || []).length }) }} · {{ t('aiSemanticPassagesCount', { n: (passages || []).length }) }}
        <span class="spacer" />
        <button v-if="images && images.length" class="semcard-foot-btn-photos" :title="t('aiOpenInPhotos')" @click="openInPhotos">
          <AgentIcon name="image" :size="11" />
          {{ t('aiOpenInPhotos') }}
        </button>
        <button class="semcard-foot-link" @click="showFullResults = true">
          {{ t('aiViewAllResults') }} <AgentIcon name="chev" :size="11" />
        </button>
      </div>
    </div>

    <!-- Lightbox — self-contained overlay (see SearchImageLightbox.vue) -->
    <SearchImageLightbox
      v-if="lightboxPhoto && lightboxPhotos.length > 0"
      :photos="lightboxPhotos"
      :index="lightboxPhotoIdx"
      @close="lightboxPhoto = null"
      @nav="navLightbox"
    />

    <!-- File detail drawer -->
    <SearchFileDrawer
      v-if="detailFile"
      :file="detailFile"
      :terms="terms"
      @close="detailFile = null"
    />

    <!-- Full results overlay -->
    <SearchFullResults
      v-if="showFullResults"
      :query="query"
      :terms="terms"
      :model="model"
      :scope="scope"
      :images="images || []"
      :files="files || []"
      :passages="passages || []"
      :total="total"
      @close="showFullResults = false"
      @image-click="onFullImageClick"
      @file-click="onFullFileClick"
    />
  </div>
</template>

<style scoped>
/* Import search-card.css rules verbatim as scoped styles */
.semcard {
  background: var(--bg-elevated);
  border: 1px solid var(--line-faint);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

/* --- Header --- */
.semcard-head {
  padding: 12px 14px;
  display: flex; align-items: center; gap: 11px;
  border-bottom: 1px solid var(--line-faint);
}
.semcard-icon {
  width: 30px; height: 30px;
  border-radius: 9px;
  display: grid; place-items: center;
  flex-shrink: 0;
  color: var(--text-on-accent);
  background: var(--grad-iri);
  box-shadow: var(--icon-tile-glow), var(--gloss-inset);
}
.semcard-titles { flex: 1; min-width: 0; }
.semcard-title { font-size: 13px; font-weight: 600; letter-spacing: -0.005em; }
.semcard-query {
  font-size: 12px; color: var(--text-secondary);
  margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.semcard-query b { color: var(--text-primary); font-weight: 600; }
.semcard-model {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 9px;
  border-radius: var(--r-pill);
  background: var(--bg-chip);
  border: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.semcard-model .dot-iri {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--grad-iri);
  flex-shrink: 0;
}

/* --- Meta strip --- */
.semcard-meta {
  display: flex; align-items: center; gap: 0;
  padding: 8px 14px;
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--line-faint);
  font-size: 11.5px;
  color: var(--text-tertiary);
  flex-wrap: wrap;
  min-height: 36px;
}
.semcard-meta-item { display: inline-flex; align-items: center; gap: 5px; }
.semcard-meta-sep { margin: 0 9px; color: var(--text-quaternary); }
.semcard-meta-item code {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: var(--bg-chip);
  padding: 1px 6px; border-radius: 5px;
  font-size: 11px;
}

/* scanning / warning hint */
.semcard-scanning-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 14px;
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--line-faint);
}

/* --- Tab bar --- */
.semcard-tabs {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-faint);
  background: var(--bg-canvas);
  overflow-x: auto;
}
.semcard-tab-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-tertiary);
  font-size: 12px; font-weight: 600;
  cursor: pointer;
  transition: all 140ms ease;
  font-family: var(--font-sans);
  white-space: nowrap;
}
.semcard-tab-btn.active {
  background: var(--bg-elevated);
  border-color: var(--line);
  box-shadow: var(--shadow-xs);
  color: var(--text-primary);
}
.semcard-tab-ic {
  width: 18px; height: 18px; border-radius: 5px;
  display: grid; place-items: center;
  background: var(--bg-chip);
  flex-shrink: 0;
  transition: all 140ms ease;
}
.semcard-tab-ic.active { /* background set inline via :style */ }
.semcard-tab-count {
  font-family: var(--font-mono);
  font-size: 11px; font-weight: 600;
  color: var(--text-quaternary);
  margin-left: 2px;
}
.semcard-tab-count.active { color: var(--text-secondary); }

/* --- Body --- */
.semcard-body {
  padding: 12px 13px 14px;
  min-height: 80px;
}
.semcard-body :deep(mark) {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
}

/* --- "All" layout --- */
.semcard-all-layout {
  display: flex; flex-direction: column; gap: 16px;
}
.semcard-section {}
.semcard-section-head {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.05em;
  margin-bottom: 10px;
  height: 16px;
}
.semcard-section-head .col-ic {
  width: 18px; height: 18px; border-radius: 5px;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.semcard-section-head .col-ic[data-c="img"] { background: var(--grad-photo); }
.semcard-section-head .col-ic[data-c="file"] { background: var(--grad-file); }
.semcard-section-head .col-ic[data-c="sem"] { background: var(--grad-iri); }
.semcard-section-head .count {
  margin-left: auto;
  font-family: var(--font-mono);
  letter-spacing: 0;
  color: var(--text-quaternary);
  text-transform: none;
  font-weight: 600;
}

/* Image strip */
.semcard-img-strip {
  display: flex; gap: 6px;
  overflow-x: auto;
}
.semcard-img-thumb {
  width: 100px; height: 100px;
  border-radius: var(--r-sm);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  background: var(--bg-chip);
  flex-shrink: 0;
  transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 180ms ease;
}
.semcard-img-thumb:hover {
  transform: scale(1.04);
  box-shadow: var(--shadow-md);
  z-index: 1;
}
.semcard-thumb-real {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.semcard-thumb-placeholder {
  position: absolute; inset: 0;
}
.semcard-img-thumb-score {
  position: absolute; top: 5px; left: 5px;
  background: var(--photo-caption-scrim);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: var(--text-on-accent); font-size: 9.5px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 1.5px 6px; border-radius: var(--r-pill);
}
.semcard-img-thumb-name {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 14px 6px 5px;
  background: linear-gradient(transparent, var(--photo-caption-scrim));
  color: var(--text-on-accent); font-size: 9px;
  font-family: var(--font-mono);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.semcard-img-more {
  width: 100px; height: 100px;
  border-radius: var(--r-sm);
  background: var(--bg-chip);
  border: 1px solid var(--line-faint);
  display: grid; place-items: center;
  font-size: 14px; font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms ease;
}
.semcard-img-more:hover { background: var(--bg-canvas); color: var(--accent); }

/* File rows */
.semcard-filerow-v2 {
  display: flex; gap: 9px; align-items: center;
  padding: 8px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background 120ms ease;
}
.semcard-filerow-v2:hover { background: var(--bg-canvas); }
.semcard-filerow-full {
  display: flex; gap: 9px; align-items: center;
  padding: 9px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background 120ms ease;
}
.semcard-filerow-full:hover { background: var(--bg-canvas); }
.semcard-fileicon-v2 {
  width: 26px; height: 31px;
  border-radius: 4px;
  position: relative;
  flex-shrink: 0;
  background: var(--paper-surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-xs);
}
.semcard-filecorner {
  position: absolute; top: 0; right: 0;
  width: 9px; height: 9px;
  border-bottom-left-radius: 3px;
  background: linear-gradient(225deg, transparent 50%, var(--line) 50%);
}
.semcard-filekind {
  position: absolute; bottom: 4px; left: 50%;
  transform: translateX(-50%);
  font-size: 7px; font-weight: 700;
  padding: 1px 3px; border-radius: 2px;
  color: var(--text-on-accent); letter-spacing: 0.02em;
  white-space: nowrap;
}
.semcard-fname {
  font-size: 12.5px; font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.semcard-fsnippet {
  font-size: 11px; color: var(--text-tertiary);
  margin-top: 1px; line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.semcard-fscore {
  font-family: var(--font-mono);
  font-size: 11px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.semcard-fchev {
  width: 20px; height: 20px;
  border-radius: 6px;
  background: var(--bg-chip);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.semcard-img-open-photos {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--photo-chip-border);
  background: var(--photo-chip-bg);
  color: var(--text-on-accent);
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  pointer-events: auto;
  font-family: var(--font-sans);
  transition: background 140ms ease;
}
.semcard-img-open-photos:hover { background: var(--photo-chip-bg-hover); }
.semcard-frow-open {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--bg-chip);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms ease;
}
.semcard-frow-open:hover { background: var(--line-faint); }

/* Show more */
.semcard-show-more {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 8px;
  font-size: 12px; font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  border-radius: var(--r-sm);
  transition: background 120ms ease;
}
.semcard-show-more:hover { background: var(--accent-soft); }

/* Image tab full grid */
.semcard-image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.semcard-image-cell {
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  background: var(--bg-chip);
  transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 180ms ease;
}
.semcard-image-cell:hover { transform: scale(1.03); box-shadow: var(--shadow-md); z-index: 1; }
.semcard-cell-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.semcard-cell-placeholder { position: absolute; inset: 0; }
.semcard-img-bottom-bar {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 16px 8px 6px;
  background: linear-gradient(transparent, var(--photo-caption-scrim));
  color: var(--text-on-accent); font-size: 10px;
  font-family: var(--font-mono);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.semcard-img-bottom-name { opacity: 0.9; }
.semcard-img-hover-overlay {
  position: absolute; inset: 0;
  background: var(--scrim-dark);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  opacity: 0;
  transition: opacity 160ms ease;
  pointer-events: none;
}
.semcard-image-cell:hover .semcard-img-hover-overlay { opacity: 1; }
.semcard-img-hover-hint {
  font-size: 11px;
  color: var(--photo-overlay-fg);
  font-weight: 500;
}

/* Passage rows */
.semcard-passage-row {
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--bg-sunken);
  border: 1px solid var(--line-faint);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}
.semcard-passage-row:hover { border-color: var(--line); background: var(--bg-canvas); }
.semcard-passage-top {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
}
.semcard-passage-src {
  display: flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 10.5px; color: var(--text-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1; min-width: 0;
}
.semcard-passage-score {
  font-family: var(--font-mono);
  font-size: 11px; font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.semcard-passage-text {
  font-size: 12.5px; line-height: 1.55;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.semcard-passage-bar {
  margin-top: 8px; height: 3px; border-radius: 999px;
  background: var(--bg-chip); overflow: hidden;
}
.semcard-passage-bar-fill { height: 100%; border-radius: 999px; }

/* Empty state */
.semcard-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-quaternary);
  font-size: 13px;
}

/* --- Footer --- */
.semcard-foot {
  padding: 10px 14px;
  display: flex; align-items: center; gap: 8px;
  border-top: 1px solid var(--line-faint);
  background: var(--bg-sunken);
  font-size: 12px;
  color: var(--text-tertiary);
}
.semcard-foot .spacer { flex: 1; }
.semcard-foot-link {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--accent);
  font-weight: 500;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-sans);
  transition: background 120ms ease;
}
.semcard-foot-link:hover { background: var(--accent-soft); }
.semcard-foot-btn-photos {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--text-secondary);
  font-weight: 500;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-sans);
  transition: background 120ms ease;
}
.semcard-foot-btn-photos:hover { background: var(--bg-chip); }

/* Responsive */
@media (max-width: 560px) {
  .semcard-tabs { gap: 2px; }
  .semcard-img-strip { flex-wrap: wrap; }
  .semcard-img-thumb { width: 80px; height: 80px; }
  .semcard-image-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
