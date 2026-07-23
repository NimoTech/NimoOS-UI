<!-- 1:1 移植自 Vue2 src/views/AI/Agent/stream/UserMessage.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { isContinueChip, textOf, type UserMsgLike } from '../../util/userMessageView'
import KindIcon from '../shell/KindIcon.vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface Attachment {
  id?: string | number
  filename?: string
  kind?: string
  mime?: string
  url?: string
}

function extOf(name?: string): string {
  if (!name) return ''
  const i = name.lastIndexOf('.')
  return i < 1 ? '' : name.slice(i + 1).toLowerCase()
}

const props = defineProps<{ msg: UserMsgLike }>()
const { t } = useI18n()
// Vue2 版本通过 `inject: { agentStore: { default: null } }` 拿会话 id;
// Vue3 侧对应改用 useProvidedAgentStore()(SP8-P1b Task 11,债③已还)——
// 有祖先 provideAgentStore(如 Photos 受限 profile 嵌入)时解析到那个实例,
// 独立使用(当前 AgentPage 根)时回退到默认 'general' store,不再写死后者。
const store = useProvidedAgentStore()

const sessionId = computed(() => store.activeSessionId)
const textContent = computed(() => textOf(props.msg))
const chip = computed(() => isContinueChip(props.msg))

// Always rebuild raw URLs through service.ai.attachmentRawUrl so the
// query-string JWT fallback gets appended. Backend-embedded URLs in
// hydrated history blocks lack the token and 401 in <img>/<a> loads.
const allAttachments = computed<Attachment[]>(() => {
  const sid = sessionId.value
  // Optimistic: msg.attachments = [{id, filename, kind, mime, url}]
  if (Array.isArray(props.msg.attachments)) {
    return (props.msg.attachments as Attachment[]).map((a) => ({
      ...a,
      url: sid && a.id ? service.ai.attachmentRawUrl(sid, a.id) : a.url,
    }))
  }
  // Hydrated: blocks may contain
  //   {type:'image', attachment_id, filename?, mime?}  (images)
  //   {type:'attachment', attachment_id, kind, filename, mime}  (docs/etc)
  // The 'attachment' block was added by the backend's
  // _enrich_with_attachments pass — non-image attachments aren't in the
  // SDK input list, so the backend joins the attachments table by
  // message_id to surface them here.
  if (Array.isArray(props.msg.blocks)) {
    return props.msg.blocks
      .filter((b) => b.type === 'image' || b.type === 'attachment')
      .map((b) => ({
        id: b.attachment_id as string | number | undefined,
        url: sid && b.attachment_id
          ? service.ai.attachmentRawUrl(sid, b.attachment_id as string | number)
          : (b.url as string | undefined),
        kind: b.type === 'image' ? 'image' : ((b.kind as string) || 'binary'),
        filename: (b.filename as string) || '',
        mime: (b.mime as string) || '',
      }))
  }
  return []
})

const imageAttachments = computed(() => allAttachments.value.filter((a) => a.kind === 'image'))
const otherAttachments = computed(() => allAttachments.value.filter((a) => a.kind !== 'image'))
</script>

<template>
  <div class="msg msg-user" :class="{ 'is-chip': chip }">
    <div v-if="chip" class="cont-chip">
      <AgentIcon name="check" :size="13" /> {{ textContent }}
    </div>
    <div v-else-if="textContent" class="msg-bubble">
      {{ textContent }}
    </div>
    <div v-if="imageAttachments.length" class="msg-attachments">
      <a
        v-for="att in imageAttachments"
        :key="att.id"
        :href="att.url"
        target="_blank"
        class="msg-image-link"
      >
        <img :src="att.url" :alt="att.filename">
      </a>
    </div>
    <div v-if="otherAttachments.length" class="msg-files">
      <a
        v-for="att in otherAttachments"
        :key="att.id"
        :href="att.url"
        target="_blank"
        class="msg-file-chip"
        :title="att.filename"
      >
        <KindIcon kind="file" :ext="extOf(att.filename)" :size="12" />
        <span class="msg-file-chip-name">{{ att.filename || t('aiUntitled') }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.msg-attachments {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
}
.msg-image-link {
  display: block; max-width: 240px; max-height: 240px;
  border-radius: 8px; overflow: hidden;
}
.msg-image-link img {
  display: block; width: 100%; height: 100%; object-fit: cover;
}
.msg-files {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
}
.msg-file-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 6px; font-size: 12px;
  background: var(--bg-elevated); border: 1px solid var(--line);
  border-radius: 6px; color: var(--text-primary); text-decoration: none;
  max-width: 280px;
}
.msg-file-chip-name {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.msg-file-chip:hover {
  background: var(--bg-hover);
}
</style>
