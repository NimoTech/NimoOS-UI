// SP14 T4 -- Field descriptor for MCP elicitation.
// Field names are taken verbatim from the backend's _blank() in
// NimoOS-AI/agent/mcp_client/elicitation_schema.py:134-143, and kept in snake_case
// (this is the wire shape, not a naming-style question for this repo).

export interface ElicitOption {
  value: string | number
  title: string
}

export interface ElicitField {
  key: string
  type: 'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'multi_enum'
  title?: string
  description?: string
  required?: boolean
  default?: unknown
  format?: string | null
  min_length?: number | null
  max_length?: number | null
  minimum?: number | null
  maximum?: number | null
  options?: ElicitOption[] | null
  min_items?: number | null
  max_items?: number | null
}
