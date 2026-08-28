// TimeMachineDepthStack.vue's own resolveSlotPose/
// computeVisibleStripCap calls both need the OUTER `.tm-stage` root's raw, un-reduced
// clientHeight -- Vue2 measures its own `$refs.stage` (the SAME `.tm-stage` element these
// functions' own bottomGap constant is defined relative to), and both functions already
// subtract that bottom-gap internally. Measuring `.tm-depth-stack` itself (as the first version
// of this task did) is wrong: that element's own CSS already reserves the bottom 80px (`bottom:
// 80px`), so its rendered `clientHeight` is ALREADY `stageHeight - 80` -- feeding that into
// functions that subtract 80 again double-subtracts it, under-measuring the real stage by 80px
// on every call.
//
// TimeMachineStage.vue provides its own `stageRoot` ref (the `.tm-stage` element) through this
// key; TimeMachineDepthStack.vue (which has no other reference to an ancestor it does not own,
// and is a separate component specifically so its own gsap/measurement lifecycle stays isolated
// from the stage shell's) injects it. A typed `InjectionKey<Ref<...>>` Symbol, not a plain
// string key -- same convention `useProvidedAgentStore.ts` already established in this repo.
//
// `offsetParent` (the review's OTHER suggested option) was considered and rejected: jsdom does
// not implement layout, so `offsetParent` is always `null` there regardless of the real DOM
// structure, which would make the "measures the stage root, not the stack wrapper" wiring
// untestable without a real browser. provide/inject has no such dependency on layout.
import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

export const TM_STAGE_ROOT_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol('tmStageRoot')

export function provideTmStageRoot(root: Ref<HTMLElement | null>): void {
  provide(TM_STAGE_ROOT_KEY, root)
}

// Falls back to a standalone, always-null ref when mounted without a providing ancestor (e.g.
// this component's own unit tests that mount TimeMachineDepthStack directly) -- matches every
// OTHER "stageHeight unmeasured" fallback already established (resolveSlotPose/
// computeVisibleStripCap both degrade safely -- fixed fallback / uncapped ceiling -- for a
// non-finite/non-positive height, see their own header comments in timeMachineMath.ts).
export function injectTmStageRoot(): Ref<HTMLElement | null> {
  return inject(TM_STAGE_ROOT_KEY, () => ref<HTMLElement | null>(null), true)
}
