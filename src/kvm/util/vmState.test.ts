import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import {
  canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp,
  canDelete, canEditSettings, showDeleteDivider, stateLabelKey, isWindowsGuest,
} from './vmState'

const vm = (state: string) => ({ id: 'x', state } as KvmVM)

describe('power action availability derivatives (exactly matching Vue2 KVMFullPage.vue:665-700 computed)', () => {
  it('canPowerOn:stopped / crashed', () => {
    expect(canPowerOn(vm('stopped'))).toBe(true)
    expect(canPowerOn(vm('crashed'))).toBe(true)
    expect(canPowerOn(vm('running'))).toBe(false)
    expect(canPowerOn(vm('paused'))).toBe(false)
    expect(canPowerOn(vm('missing'))).toBe(false)
  })
  it('canShutDown: only running', () => {
    expect(canShutDown(vm('running'))).toBe(true)
    expect(canShutDown(vm('paused'))).toBe(false)
  })
  it('canRestart:running / paused', () => {
    expect(canRestart(vm('running'))).toBe(true)
    expect(canRestart(vm('paused'))).toBe(true)
    expect(canRestart(vm('stopped'))).toBe(false)
  })
  it('canPause: only running', () => {
    expect(canPause(vm('running'))).toBe(true)
    expect(canPause(vm('suspended'))).toBe(false)
  })
  it('canResume: only paused', () => {
    expect(canResume(vm('paused'))).toBe(true)
    expect(canResume(vm('suspended'))).toBe(false)
  })
  it('canWakeUp: only suspended', () => {
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
  it('all derivatives return false for null, no throw', () => {
    for (const f of [canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp, canDelete, canEditSettings]) {
      expect(f(null)).toBe(false)
      expect(f(undefined)).toBe(false)
    }
  })
})

describe('showDeleteDivider', () => {
  it('when crashed, both can power on and can delete → need divider', () => {
    expect(showDeleteDivider(vm('crashed'))).toBe(true)
  })
  it('when stopped, also both can power on and can delete → need divider', () => {
    expect(showDeleteDivider(vm('stopped'))).toBe(true)
  })
  it('when missing, only can delete, no power actions → don\'t need divider', () => {
    expect(showDeleteDivider(vm('missing'))).toBe(false)
  })
  it('when running, cannot delete → don\'t need divider', () => {
    expect(showDeleteDivider(vm('running'))).toBe(false)
  })
  it('null doesn\'t throw', () => {
    expect(showDeleteDivider(null)).toBe(false)
  })
})

describe('stateLabelKey', () => {
  it('five known states map to i18n keys', () => {
    expect(stateLabelKey('running')).toBe('kvmStateRunning')
    expect(stateLabelKey('stopped')).toBe('kvmStateStopped')
    expect(stateLabelKey('paused')).toBe('kvmStatePaused')
    expect(stateLabelKey('suspended')).toBe('kvmStateSuspended')
    expect(stateLabelKey('error')).toBe('kvmStateError')
  })
  it('unknown states return as-is (following Vue2: crashed/missing have no mapping, display original text directly)', () => {
    expect(stateLabelKey('crashed')).toBe('crashed')
    expect(stateLabelKey('missing')).toBe('missing')
    expect(stateLabelKey('')).toBe('')
  })
})

describe('isWindowsGuest (matching Vue2 KVMFullPage.vue:711-714 computed)', () => {
  it('os contains win (case-insensitive) → true', () => {
    expect(isWindowsGuest({ os: 'Windows 10' } as KvmVM)).toBe(true)
    expect(isWindowsGuest({ os: 'WIN11' } as KvmVM)).toBe(true)
    expect(isWindowsGuest({ os: 'windows-server' } as KvmVM)).toBe(true)
  })
  it('os doesn\'t contain win → false', () => {
    expect(isWindowsGuest({ os: 'linux' } as KvmVM)).toBe(false)
    expect(isWindowsGuest({ os: 'Ubuntu' } as KvmVM)).toBe(false)
  })
  it('null/undefined → false, doesn\'t throw', () => {
    expect(isWindowsGuest(null)).toBe(false)
    expect(isWindowsGuest(undefined)).toBe(false)
  })
})
