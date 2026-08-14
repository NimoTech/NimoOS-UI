// After ejecting a mount point, if the user is currently inside it (or a subdirectory),
// need to navigate back to /DATA.
// Note: Vue2 using bare startsWith would mistakenly classify /mnt/host2 as under /mnt/host;
// here we use exact match + delimiter boundary to correct it.
export function shouldNavigateHome(currentReal: string, ejectedReal: string): boolean {
  return currentReal === ejectedReal || currentReal.startsWith(ejectedReal + '/')
}
