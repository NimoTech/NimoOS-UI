// composerize ships no type declarations (plain CJS, `module.exports = fn`).
// Kept minimal on purpose — only the single call shape we use.
declare module 'composerize' {
  const composerize: (dockerRunCommand: string) => string
  export default composerize
}
