// SP14 T8 (Vue2 #141) — the protocol-version line shown when a connection test
// succeeds.
//
// The only difference from Vue2: Vue2 wrote this inline in a computed property on
// McpServerDetail. This repo follows mcpErrorKey's existing split of
// responsibilities instead — the pure function only produces an i18n key plus
// params, and the view calls t() to render it in the current language. One
// element is composed rather than two near-identical modern/legacy divs — they
// only differ by one condition and one class.
import type { McpTestView } from '../types/mcpServer'

export function protocolLine(v: McpTestView): { key: string; params: Record<string, string> } | null {
  if (!v.ok) return null
  const version = v.protocolVersion
  // If era isn't one of the two known values (including 'unknown', and including
  // an older backend that omits the field entirely) the whole line is suppressed;
  // an empty version string suppresses it too — no line beats half a sentence.
  if (!version) return null
  if (v.protocolEra === 'legacy') return { key: 'aiMcpSrvProtoLegacy', params: { version } }
  if (v.protocolEra !== 'modern') return null
  // modern: supportedVersions is the server's own full declaration — a
  // dual-era server lists its legacy revisions here too. The negotiated one is
  // shown on its own; everything else becomes "also supports".
  const list = v.supportedVersions.filter((x) => x !== version)
  return list.length
    ? { key: 'aiMcpSrvProtoAlso', params: { version, list: list.join(', ') } }
    : { key: 'aiMcpSrvProtoOnly', params: { version } }
}
