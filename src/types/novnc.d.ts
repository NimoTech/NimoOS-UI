// @novnc/novnc ships no type declarations (plain ES module bundle, see package.json
// having no "types"/"typings" field). Kept minimal on purpose — only the constructor
// shape + the handful of instance methods useVncConsole.ts actually calls.
declare module '@novnc/novnc' {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      /** ⚠️ 构造函数只读 credentials / shared / repeaterID / wsProtocols
       *  (core/rfb.js:28-32),**其余选项一律静默忽略** —— 下面那三个开关写进这里
       *  是无效的,必须构造后赋属性。我们只用得到默认值,所以这里不展开声明。 */
      options?: { credentials?: Record<string, string>; shared?: boolean },
    )
    /** 客户机不下发光标图案时补画一个小圆点(否则 noVNC 给画布写 `cursor: none`,
     *  鼠标在控制台上隐形)。存取器属性,必须构造后赋值。见 useVncConsole.ts 的偏离登记。 */
    showDotCursor: boolean
    /** 把客户机画面缩放到容器大小。存取器属性,必须构造后赋值。 */
    scaleViewport: boolean
    /** 是否要求客户机把分辨率改成容器大小。存取器属性,必须构造后赋值。 */
    resizeSession: boolean
    addEventListener(event: 'connect' | 'disconnect', handler: () => void): void
    disconnect(): void
    sendKey(keysym: number, code: string | null, down?: boolean | null): void
    sendCtrlAltDel(): void
  }
}
