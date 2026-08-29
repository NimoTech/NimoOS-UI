declare module 'socket.io-client' {
  interface Socket {
    on(event: string, callback: (...args: any[]) => void): this
    off(event: string, callback?: (...args: any[]) => void): this
    emit(event: string, ...args: any[]): this
    disconnect(): void
  }

  interface SocketOptions {
    path?: string
    transports?: string[]
  }

  function io(options?: SocketOptions): Socket

  export default io
}
