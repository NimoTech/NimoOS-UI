// See channelsFormat.ts header comment: these 7 examples are written directly based on Vue2
// ChannelsSection.vue bindingLabel (:304-307) / pairInstructions (:185-190) /
// channelsBotTokenTail template population (:29) source code behavior,
// not derived from the Vue 2 panel's ChannelsSection.spec.js — that spec has no
// direct assertions for these two methods (genCode test comment explicitly states {bot}/{code} replacement not tested).
import { describe, it, expect } from 'vitest'
import { bindingLabel, fillPairInstructions, fillTokenTail, addBotErrorKey } from './channelsFormat'

describe('channelsFormat', () => {
  it('bindingLabel adds @ prefix when username is present', () => {
    expect(bindingLabel({ id: 1, external_username: 'nimo' }, '(no label)')).toBe('@nimo')
  })

  it('bindingLabel falls back to external_user_id when username is missing', () => {
    expect(bindingLabel({ id: 1, external_user_id: '12345' }, '(no label)')).toBe('12345')
  })

  it('bindingLabel uses provided fallback text when both are missing', () => {
    expect(bindingLabel({ id: 1 }, '(no label)')).toBe('(no label)')
  })

  it('bindingLabel does not consider empty string username as a value (Vue2 uses truthy check)', () => {
    expect(bindingLabel({ id: 1, external_username: '', external_user_id: '9' }, '(no label)')).toBe('9')
  })

  it('fillPairInstructions replaces {bot} and {code}', () => {
    expect(fillPairInstructions('send to @{bot}: /pair {code}', 'nimobot', 'ABC123'))
      .toBe('send to @nimobot: /pair ABC123')
  })

  it('fillPairInstructions does not produce undefined when bot is empty', () => {
    expect(fillPairInstructions('send to @{bot}: {code}', '', 'X')).toBe('send to @: X')
  })

  it('fillTokenTail replaces {tail}', () => {
    expect(fillTokenTail('token ···{tail}', '8f2c')).toBe('token ···8f2c')
  })
})

// Feedback from an earlier review: when adding a bot failed, the interface directly
// displayed the raw backend response `{"detail":"bot token rejected"}`. User requirement: use human-readable
// text, do not show JSON, and support multiple languages. Thus we add this mapping: normalize backend detail
// to **i18n keys** (pure function does not call t(), same division as other functions in this file),
// and the caller then calls t() to get the current language's copy. The backend (NimoOS-AI/agent/main.py:417-424)
// has only three types of 422 detail for this endpoint, mapped one by one; all others fall to the generic
// fallback key, **never display the raw backend response**.
describe('addBotErrorKey — backend detail → i18n key', () => {
  it('bot token rejected → dedicated key', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'bot token rejected' } } }))
      .toBe('aiCfgChannelsErrTokenRejected')
  })

  it('bot_token required → dedicated key', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'bot_token required' } } }))
      .toBe('aiCfgChannelsErrTokenRequired')
  })

  it('unsupported channel_type → dedicated key', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'unsupported channel_type' } } }))
      .toBe('aiCfgChannelsErrUnsupportedType')
  })

  it('case and whitespace do not affect matching', () => {
    expect(addBotErrorKey({ response: { data: { detail: '  BOT TOKEN REJECTED ' } } }))
      .toBe('aiCfgChannelsErrTokenRejected')
  })

  it('Go service-style message field also participates in matching (same endpoint, two backend types)', () => {
    expect(addBotErrorKey({ response: { data: { message: 'bot token rejected' } } }))
      .toBe('aiCfgChannelsErrTokenRejected')
  })

  it('unrecognized backend text → generic fallback key (rather than echoing raw text/JSON)', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'bot quota exceeded' } } }))
      .toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey({ response: { data: { code: 42, hint: 'x' } } }))
      .toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey(new Error('Network Error'))).toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey(null)).toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey(undefined)).toBe('aiCfgChannelsAddBotFailed')
  })
})
