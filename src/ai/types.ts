// Shared type contracts for the AI Agent stream family (SP8-P1b).
// No imports — earliest consumer is the mapper family (searchMapper/streamMappers).

export interface AgentBlock { type: string; [k: string]: unknown }        // spread via v-bind="block"

export interface AgentStats {
  ttftMs?: number | null; generationMs?: number | null; totalMs?: number | null
  outputTokens?: number | null; tokensPerSec?: number | null
}

export interface AttachmentRef { id: string; filename?: string; kind?: string; mime?: string; url?: string }

export interface AgentMessage {
  id: string; role: 'user' | 'assistant'
  content?: string; blocks?: AgentBlock[]
  streaming?: boolean; stats?: AgentStats; attachments?: AttachmentRef[]
}

// The reducer's action contract (verbatim-port target). Guarded actions are OPTIONAL in 1b.
export interface StreamActions {
  pushUserMessage(text: string, attachmentRefs?: AttachmentRef[]): void
  startAssistant(): void
  appendBlock(block: AgentBlock): void
  patchBlock(pred: (b: AgentBlock) => boolean, patch: Partial<AgentBlock> | ((old: AgentBlock) => Partial<AgentBlock>)): boolean
  setStreamingDone(): void
  setBusy(v: boolean): void
  patchAssistantStats(partial: Partial<AgentStats>): void
  pushActivityStep(step: { name: string }): void
  markRunningStepDone(): void
  _lastNimoosSearchQuery?: string                 // transient carrier: written in tool_call, read in tool_result
  // 1c (absent in 1b — optional-chained in dispatchEvent):
  appendStagedChange?: (item: Record<string, unknown>) => void
  appendVisibleResource?: (vr: { path: string; kind: string }) => void
  removeVisibleResourceFromList?: (path: string) => void
}
