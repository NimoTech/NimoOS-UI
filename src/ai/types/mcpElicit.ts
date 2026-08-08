// SP14 T4 —— MCP elicitation 的字段描述符。
// 字段名逐字取自后端 NimoOS-AI/agent/mcp_client/elicitation_schema.py:134-143
// 的 _blank(),保持 snake_case(它是网络上的形状,不是本仓命名风格问题)。

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
