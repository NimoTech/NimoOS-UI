// APlayer ships no type declarations and its CSS entry point has no module
// shape either — both are dynamically imported in MediaViewer.vue only for
// the interop boundary (audio playback). Kept minimal on purpose.
declare module 'aplayer' {
  const APlayer: new (options: Record<string, unknown>) => {
    destroy: () => void
    [key: string]: unknown
  }
  export default APlayer
}

declare module 'aplayer/dist/APlayer.min.css'
