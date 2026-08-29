// Pure formatting for the rebuild ETA (ported verbatim from the Vue 2 panel's
// src/utils/raidUtils.js etaDurationParts / etaCompletionParts, commit 028837e8;
// behavior is kept identical, only TS types were added).
// The input is the backend status's rebuild_eta_seconds: remaining seconds estimated
// from the rebuild position's advance rate, -1/absent = unknown (see the RaidStatus
// comment in the service package).

export interface EtaDurationParts {
  days: number
  hours: number
  minutes: number
}

// Split the remaining duration into parts. Minutes round up — while the rebuild is
// still running it must never show "0 minutes"; unknown (null / negative) returns null,
// leaving the "estimating…" copy to the caller.
export function etaDurationParts(seconds: number | null | undefined): EtaDurationParts | null {
  if (seconds == null || seconds < 0) return null
  const totalMinutes = Math.ceil(seconds / 60)
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  }
}

export interface EtaCompletionParts {
  dayType: 'today' | 'tomorrow' | 'other'
  month: number
  day: number
  time: string // HH:mm
}

// Which day does now + seconds land on? 'today' / 'tomorrow' / 'other' (with a specific
// date) + HH:mm — used by the rebuild banner to alternate with an "expected to finish
// today at 14:32" style display.
export function etaCompletionParts(
  seconds: number | null | undefined,
  now: Date = new Date(),
): EtaCompletionParts | null {
  if (seconds == null || seconds < 0) return null
  const done = new Date(now.getTime() + seconds * 1000)
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  let dayType: EtaCompletionParts['dayType'] = 'other'
  if (sameDay(done, now)) dayType = 'today'
  else if (sameDay(done, tomorrow)) dayType = 'tomorrow'
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    dayType,
    month: done.getMonth() + 1,
    day: done.getDate(),
    time: `${pad(done.getHours())}:${pad(done.getMinutes())}`,
  }
}
