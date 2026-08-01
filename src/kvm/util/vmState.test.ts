import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import {
  canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp,
  canDelete, canEditSettings, showDeleteDivider, stateLabelKey,
} from './vmState'

const vm = (state: string) => ({ id: 'x', state } as KvmVM)

describe('电源动作可用性派生(逐字对 Vue2 KVMFullPage.vue:665-700 的 computed)', () => {
  it('canPowerOn:stopped / crashed', () => {
    expect(canPowerOn(vm('stopped'))).toBe(true)
    expect(canPowerOn(vm('crashed'))).toBe(true)
    expect(canPowerOn(vm('running'))).toBe(false)
    expect(canPowerOn(vm('paused'))).toBe(false)
    expect(canPowerOn(vm('missing'))).toBe(false)
  })
  it('canShutDown:只有 running', () => {
    expect(canShutDown(vm('running'))).toBe(true)
    expect(canShutDown(vm('paused'))).toBe(false)
  })
  it('canRestart:running / paused', () => {
    expect(canRestart(vm('running'))).toBe(true)
    expect(canRestart(vm('paused'))).toBe(true)
    expect(canRestart(vm('stopped'))).toBe(false)
  })
  it('canPause:只有 running', () => {
    expect(canPause(vm('running'))).toBe(true)
    expect(canPause(vm('suspended'))).toBe(false)
  })
  it('canResume:只有 paused', () => {
    expect(canResume(vm('paused'))).toBe(true)
    expect(canResume(vm('suspended'))).toBe(false)
  })
  it('canWakeUp:只有 suspended', () => {
    expect(canWakeUp(vm('suspended'))).toBe(true)
    expect(canWakeUp(vm('paused'))).toBe(false)
  })
  it('canDelete:stopped / crashed / missing', () => {
    expect(canDelete(vm('stopped'))).toBe(true)
    expect(canDelete(vm('crashed'))).toBe(true)
    expect(canDelete(vm('missing'))).toBe(true)
    expect(canDelete(vm('running'))).toBe(false)
  })
  it('canEditSettings:stopped / crashed', () => {
    expect(canEditSettings(vm('stopped'))).toBe(true)
    expect(canEditSettings(vm('crashed'))).toBe(true)
    expect(canEditSettings(vm('running'))).toBe(false)
  })
  it('全部派生对 null 一律 false,不抛', () => {
    for (const f of [canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp, canDelete, canEditSettings]) {
      expect(f(null)).toBe(false)
      expect(f(undefined)).toBe(false)
    }
  })
})

describe('showDeleteDivider', () => {
  it('crashed 时既能开机又能删 → 需要分隔线', () => {
    expect(showDeleteDivider(vm('crashed'))).toBe(true)
  })
  it('stopped 时也是既能开机又能删 → 需要分隔线', () => {
    expect(showDeleteDivider(vm('stopped'))).toBe(true)
  })
  it('missing 时只能删、没有任何电源项 → 不要分隔线', () => {
    expect(showDeleteDivider(vm('missing'))).toBe(false)
  })
  it('running 时不能删 → 不要分隔线', () => {
    expect(showDeleteDivider(vm('running'))).toBe(false)
  })
  it('null 不抛', () => {
    expect(showDeleteDivider(null)).toBe(false)
  })
})

describe('stateLabelKey', () => {
  it('五个已知状态映射到 i18n key', () => {
    expect(stateLabelKey('running')).toBe('kvmStateRunning')
    expect(stateLabelKey('stopped')).toBe('kvmStateStopped')
    expect(stateLabelKey('paused')).toBe('kvmStatePaused')
    expect(stateLabelKey('suspended')).toBe('kvmStateSuspended')
    expect(stateLabelKey('error')).toBe('kvmStateError')
  })
  it('未知状态原样返回(照 Vue2:crashed/missing 没有映射,直接显示原文)', () => {
    expect(stateLabelKey('crashed')).toBe('crashed')
    expect(stateLabelKey('missing')).toBe('missing')
    expect(stateLabelKey('')).toBe('')
  })
})
