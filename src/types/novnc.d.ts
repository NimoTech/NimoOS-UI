// @novnc/novnc ships no type declarations (plain ES module bundle, see package.json
// having no "types"/"typings" field). Kept minimal on purpose — only the constructor
// shape + the handful of instance methods useVncConsole.ts actually calls.
declare module '@novnc/novnc' {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      options?: { scaleViewport?: boolean; resizeSession?: boolean },
    )
    addEventListener(event: 'connect' | 'disconnect', handler: () => void): void
    disconnect(): void
    sendKey(keysym: number, code: string | null, down?: boolean | null): void
    sendCtrlAltDel(): void
  }
}
