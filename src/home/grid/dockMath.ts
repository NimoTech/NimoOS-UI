const MAG_AMP = 0.55, MAG_SIGMA = 70
// engine.js 1142-1148
export function magScale(distance: number): number {
  return 1 + MAG_AMP * Math.exp(-(distance * distance) / (2 * MAG_SIGMA * MAG_SIGMA))
}
