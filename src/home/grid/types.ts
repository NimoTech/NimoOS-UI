export type Kind = 'widget' | 'app' | 'folder' | 'photo'

export interface LayoutItem {
  id: string
  kind: Kind
  key: string
  c: number
  r: number
  w: number
  h: number
  path?: string
}

export interface Dims { cols: number; rows: number }
export interface Pos { c: number; r: number }
export interface PlanEntry { id: string; c: number; r: number; w?: number; h?: number }
export interface WidgetSize { min: [number, number]; max: [number, number] }
