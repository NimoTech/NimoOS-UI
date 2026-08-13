// When the refresh token fails for good (session is dead): clear the dead token first, then go to login.
// Clearing must come first: otherwise the guard sees /login with a token → redirects to / → home APIs 401 again → back to login, an infinite in-app ping-pong.
export function makeAuthFailHandler(clear: () => void, navigate: () => void) {
  return (): void => {
    clear()
    navigate()
  }
}
