// 重建 ETA 纯格式化(逐字移植 Vue2 NimoOS-UI src/utils/raidUtils.js
// etaDurationParts / etaCompletionParts,commit 028837e8;行为保持一致,只加 TS 类型)。
// 输入是后端 status 的 rebuild_eta_seconds:按重建位置推进速率估算的剩余秒数,
// -1/缺席 = 未知(见 service 包 RaidStatus 注释)。

export interface EtaDurationParts {
  days: number
  hours: number
  minutes: number
}

// 剩余时长拆件。分钟向上取整 —— 重建还在跑就绝不显示「0 分钟」;
// 未知(null / 负数)返回 null,由调用方给「正在估算…」文案。
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

// now + seconds 落在哪一天?'today' / 'tomorrow' / 'other'(带具体日期)+ HH:mm ——
// 供重建横幅的「预计今天 14:32 完成」交替显示用。
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
