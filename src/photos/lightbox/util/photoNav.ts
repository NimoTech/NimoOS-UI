export function photoIndexById<T extends { id: string | number }>(list: T[], current: { id: string | number }): number {
  const i = list.findIndex((x) => x.id === current.id)
  return i >= 0 ? i : 0
}
