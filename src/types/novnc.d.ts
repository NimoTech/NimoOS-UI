// @novnc/novnc ships no type declarations (plain ES module bundle, see package.json
// having no "types"/"typings" field). Kept minimal on purpose — only the constructor
// shape + the handful of instance methods useVncConsole.ts actually calls.
declare module '@novnc/novnc' {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      /** ⚠️ The constructor only reads credentials / shared / repeaterID / wsProtocols
       *  (core/rfb.js:28-32); **all other options are silently ignored** — putting the
       *  three switches below in here has no effect; they must be assigned as properties
       *  after construction. We only need the defaults, so they are not declared here. */
      options?: { credentials?: Record<string, string>; shared?: boolean },
    )
    /** Draw a small dot when the guest sends no cursor image (otherwise noVNC sets
     *  `cursor: none` on the canvas and the mouse is invisible over the console).
     *  Accessor property; must be assigned after construction. See the deviation log in useVncConsole.ts. */
    showDotCursor: boolean
    /** Scale the guest display to the container size. Accessor property; must be assigned after construction. */
    scaleViewport: boolean
    /** Whether to ask the guest to change its resolution to the container size. Accessor property; must be assigned after construction. */
    resizeSession: boolean
    addEventListener(event: 'connect' | 'disconnect', handler: () => void): void
    disconnect(): void
    sendKey(keysym: number, code: string | null, down?: boolean | null): void
    sendCtrlAltDel(): void
  }
}
