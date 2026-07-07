// 弹出某挂载点后,若用户当前正处在它(或其子目录)内,需导航回 /DATA。
// 注意 Vue2 用裸 startsWith 会把 /mnt/host2 误判为 /mnt/host 之下;这里用精确 + 分隔符边界修正。
export function shouldNavigateHome(currentReal: string, ejectedReal: string): boolean {
  return currentReal === ejectedReal || currentReal.startsWith(ejectedReal + '/')
}
