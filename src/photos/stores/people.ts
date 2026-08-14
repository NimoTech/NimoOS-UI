// Ported from Vue2 NimoOS-UI src/store/modules/photos.js:
//   state      :277-292   (people / peopleLoaded / facesIndexedUpTo / peopleFilter / mergeSuggestions)
//   mutations  :350-361, :503-529
//   actions    :1079-1099 (fetch/filter), :1100-1120 (rename/relation/fav),
//              :1121-1132 (cover), :1143-1153 (merge), :1171-1211 (purge+undo), :1224-1248 (suggestions)
// Photos v1 backend has no envelope: listPersons is a { persons, facesIndexedUpTo } object wrapper; not unwrapped inside, self-unwrapped here.
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import {
  toPerson, namedOf, unnamedOf, visibleUnnamedOf, hiddenSingletonCountOf,
  type Person, type PeopleFilter,
} from '../util/peopleView'

const LS_CONFIDENCE = 'nimo_people_confidence'
const LS_SHOW_SINGLETONS = 'nimo_people_show_singletons'
const CONFIDENCE_ALLOWED = [50, 60, 70, 80, 90, 95]
const PURGE_DELAY_MS = 5000

// Purge cancellation pending items. Timer and snapshot are not serializable, follow Vue2 to place at module scope (photos.js:230-231), not in state.
// key always String(id) (iron rule: backend id may be numeric, route params are always strings).
interface PurgeEntry { timer: ReturnType<typeof setTimeout>; snapshot: Person | null; idx: number; committed: boolean }
const _purgeTimers = new Map<string, PurgeEntry>()

function readFilter(): PeopleFilter {
  // Follow Vue2 photos.js:283-291 IIFE: whitelist validation + strict '1' comparison + overall try fallback (private mode/SSR).
  const def: PeopleFilter = { confidence: 80, showSingletons: false }
  try {
    const c = parseInt(localStorage.getItem(LS_CONFIDENCE) ?? '', 10)
    if (CONFIDENCE_ALLOWED.includes(c)) def.confidence = c
    def.showSingletons = localStorage.getItem(LS_SHOW_SINGLETONS) === '1'
  } catch {
    /* Keep default value when localStorage is unavailable */
  }
  return def
}

export const usePhotosPeople = defineStore('photosPeople', () => {
  const people = ref<Person[]>([])
  // New-UI addition: empty state gate control. Only set to true on fetchPeople success path, leave false on failure for retry
  // (P3 hard lesson: unconditional setting makes transient failure indistinguishable from "confirmed zero people"). Vue2's peopleLoaded is a write-only dead field.
  const peopleLoaded = ref(false)
  const facesIndexedUpTo = ref<string | null>(null)
  const filter = ref<PeopleFilter>(readFilter())
  const mergeSuggestions = ref<Array<Record<string, unknown>>>([])

  const named = computed(() => namedOf(people.value))
  const unnamed = computed(() => unnamedOf(people.value))
  const visibleUnnamed = computed(() => visibleUnnamedOf(unnamed.value, filter.value))
  const namedCount = computed(() => named.value.length)
  // Sidebar/topbar count and grid must use the same calibration: unnamed count uses "visible" not all (Vue2 photos.js:344 comment emphasizes).
  const unnamedCount = computed(() => visibleUnnamed.value.length)
  const hiddenSingletonCount = computed(() => hiddenSingletonCountOf(unnamed.value, filter.value))

  const key = (id: string | number): string => String(id)
  function personById(id: string | number): Person | null {
    return people.value.find((p) => key(p.id) === key(id)) ?? null
  }

  // ── Local writes (corresponding to four mutations in Vue2) ──
  function patchPerson(id: string | number, patch: Partial<Person>): void {
    const i = people.value.findIndex((p) => key(p.id) === key(id))
    if (i >= 0) people.value.splice(i, 1, { ...people.value[i], ...patch })  // Not found, silent no-op, follow Vue2 :514-517
  }
  function removePerson(id: string | number): void {
    people.value = people.value.filter((p) => key(p.id) !== key(id))
  }
  function insertPersonAt(person: Person, idx: number): void {
    const arr = [...people.value]
    const clamped = idx >= 0 && idx <= arr.length ? idx : arr.length   // Out of bounds/negative falls back to end append, follow Vue2 :521-526
    arr.splice(clamped, 0, person)
    people.value = arr
  }

  // ── Read ──
  async function fetchPeople(): Promise<void> {
    try {
      const raw = (await service.photos.listPersons()) as
        { persons?: unknown; facesIndexedUpTo?: unknown } | undefined
      const list = Array.isArray(raw?.persons) ? (raw?.persons as Record<string, unknown>[]) : []
      const mapped = list.map(toPerson)
      // People within purge cancellation window must be filtered out from refetch result, else "deleted but resurfaces" (Vue2 mutation SET_PEOPLE :507).
      people.value = _purgeTimers.size ? mapped.filter((p) => !_purgeTimers.has(key(p.id))) : mapped
      // Unregistered divergence (review required, add record): `!== undefined` here aligns with Vue2 **mutation**
      // layer (:509) check, but Vue2 **action** layer (fetchPeople :1085) always passes
      // `data.facesIndexedUpTo || null` to mutation—success path is always "has value or null",
      // never undefined, so Vue2's actual behavior is "response missing this field resets local value to
      // null", only failure branch (commit doesn't include this key at all) falls into "no override" path.
      // No action/mutation two-layer wrapper here, directly implement by mutation semantics: field absent keeps old value,
      // not reset to null—this is better (when response body is normal but missing field, shouldn't lose old value user already saw),
      // keep as is, don't revert to Vue2. Relatedly `||` → `??`: Vue2 treats empty string `''` as falsy and coerces to null,
      // here `?? null` only handles null/undefined, empty string stays as is.
      if (raw?.facesIndexedUpTo !== undefined) {
        facesIndexedUpTo.value = (raw.facesIndexedUpTo as string | null) ?? null
      }
      peopleLoaded.value = true
    } catch (e) {
      // Divergence record: Vue2 (photos.js:1086-1089) clears list to [] here, a single network blip erases loaded data.
      // Here only log, keep previous data; peopleLoaded not set (first failure leaves false for retry).
      console.error('[photos-people] fetchPeople', e)
    }
  }

  async function fetchMergeSuggestions(): Promise<void> {
    try {
      const list = (await service.photos.mergeSuggestions()) as Array<Record<string, unknown>> | undefined
      mergeSuggestions.value = Array.isArray(list) ? list : []
    } catch (e) {
      // Same as above: Vue2 :1095-1098 clears on failure, here keep previous data.
      console.error('[photos-people] fetchMergeSuggestions', e)
    }
  }

  // ── Filter preferences (write to localStorage, follow Vue2 mutation :350-361) ──
  function setConfidence(v: number): void {
    filter.value = { ...filter.value, confidence: v }
    try { localStorage.setItem(LS_CONFIDENCE, String(v)) } catch { /* Ignore write failure */ }
  }
  function setShowSingletons(v: boolean): void {
    filter.value = { ...filter.value, showSingletons: !!v }
    try { localStorage.setItem(LS_SHOW_SINGLETONS, v ? '1' : '0') } catch { /* Ignore write failure */ }
  }

  // ── Write operations (optimistic strategy, verify each case separately, note each differs) ──

  // Optimistic patch; failure doesn't precisely rollback, instead fetchPeople corrects with server truth (follow Vue2 renameCluster :1100-1103).
  // Throws: view layer must show failure toast and restore input (Vue2 swallows error = user sees no failure, similar divergence record type 1).
  async function renamePerson(id: string | number, name: string): Promise<void> {
    patchPerson(id, { name })
    try {
      await service.photos.updatePerson(id, { name })
    } catch (e) {
      console.error('[photos-people] renamePerson', e)
      void fetchPeople()
      throw e
    }
  }

  // Divergence record 4: Vue2 (PhotosPersonDetail.vue:951-955) fire-and-forget and doesn't rollback detail page local value.
  // Here optimistic patch + precise failure rollback + rethrow, view layer catch → toast.
  async function setPersonRelation(id: string | number, relation: string): Promise<void> {
    const prev = personById(id)?.relation ?? ''
    patchPerson(id, { relation })
    try {
      await service.photos.updatePerson(id, { relation })
    } catch (e) {
      console.error('[photos-people] setPersonRelation', e)
      patchPerson(id, { relation: prev })
      throw e
    }
  }

  // Divergence record 3: Vue2 (photos.js:1113-1120) returns if local list doesn't find the person, doesn't send any request
  // (deep link directly to detail page leaves people empty), while detail page unconditionally flips local favorite—UI says favorited, backend knows nothing.
  // Here not reliant on local hit: always call backend; only patch if hit; failure rollback + rethrow.
  async function setPersonFavorite(id: string | number, next: boolean): Promise<void> {
    const hit = personById(id)
    if (hit) patchPerson(id, { favorite: next })
    try {
      await service.photos.updatePerson(id, { favorite: next })
    } catch (e) {
      console.error('[photos-people] setPersonFavorite', e)
      if (hit) patchPerson(id, { favorite: !next })
      throw e
    }
  }

  // Non-optimistic: write to local only after backend responds (follow Vue2 :1121-1132). Return new coverFaceId for view to refresh avatar.
  // Line-by-line cross-check against Vue2 :1123-1125 found discrepancy: Vue2 uses `!== undefined` to decide whether to write—even when backend explicitly
  // returns coverFaceId: null, it will patch to null (clear local cover); brief snapshot uses `res?.coverFaceId ?? null`
  // which coerces "explicit null" and "field absent" to the same value, letting explicit-clear responses be misread as "field not included" thus
  // not write, leaving stale cover. By Vue2 source as authority, change to check original field with `!== undefined`.
  //
  // T14 review required 1 (pure additive fix, changes no existing behavior): add `| undefined` to return type, **no longer** use
  // `?? null` to coerce "field absent" to null. That original `?? null` merged the two carefully-distinguished cases
  // again at the return value—call site (detail page container) getting null can't distinguish "backend says clear cover" from
  // "backend didn't mention cover at all", unconditional patch will have backend returning `200 {}` clear local coverFaceId to
  // null, detail page hero instantly degrades to gradient fallback (PersonHero.vue:76 isFallback becomes true immediately).
  // Now semantics are consistent across the boundary: undefined = field absent (call site should keep original value), null = explicit clear.
  // Existing three store tests unaffected (field absent case doesn't assert return value, explicit null case still gets null).
  async function setPersonCover(
    id: string | number, assetId: string | number,
  ): Promise<string | number | null | undefined> {
    try {
      const res = (await service.photos.setPersonCover(id, assetId)) as
        { coverFaceId?: string | number | null } | undefined
      const coverFaceId = res?.coverFaceId
      if (coverFaceId !== undefined) patchPerson(id, { coverFaceId })
      return coverFaceId
    } catch (e) {
      console.error('[photos-people] setPersonCover', e)
      throw e
    }
  }

  // Non-optimistic (follow Vue2 :1133-1142). Passing null for assetId = fallback to face thumbnail, send empty string to backend field.
  // Unregistered divergence (review required, add record): Vue2 :1136-1137 uses `assetId || ''` (send to backend) and
  // `assetId || null` (write locally)—falsy check, if assetId is exactly number `0` or empty string `''`, these kinds of
  // "legitimate but falsy" values get misidentified as "clear". Here change to `?? ''` only handle null/undefined, and
  // write local patch directly as original assetId (no `|| null` coercion)—behavior forks from Vue2 when assetId is `0`/`''`:
  // Vue2 clears, here preserves original. This is better (semantically falsy id values may be legitimate ids,
  // shouldn't be silently cleared), keep as is, don't revert to Vue2.
  async function setPersonHero(id: string | number, assetId: string | number | null): Promise<void> {
    try {
      await service.photos.updatePerson(id, { heroAssetId: assetId ?? '' })
      patchPerson(id, { heroAssetId: assetId })
    } catch (e) {
      console.error('[photos-people] setPersonHero', e)
      throw e
    }
  }

  // Follow Vue2 mergeClusterInto :1143-1153: throw to call site, and finally unconditionally refetch both data (both success and failure).
  async function mergePersonInto(fromId: string | number, intoId: string | number): Promise<void> {
    try {
      await service.photos.mergePersons(fromId, intoId)
    } catch (e) {
      console.error('[photos-people] mergePersonInto', e)
      throw e
    } finally {
      void fetchPeople()
      void fetchMergeSuggestions()
    }
  }

  // 5-second reversible purge. Return undo closure (follow Vue2 purgeClusterWithUndo :1171-1211), two timing fixes noted in comments.
  function purgePersonWithUndo(id: string | number): () => void {
    const k = key(id)
    const existing = _purgeTimers.get(k)
    // Fix 2 (Vue2 :1178-1180): when same id triggered again within window, Vue2 recalculates idx using "list already removed once",
    // position when undo inserts back is no longer original position. Here reuse first snapshot and idx.
    const idx = existing ? existing.idx : people.value.findIndex((p) => key(p.id) === k)
    const snapshot = existing ? existing.snapshot : (idx >= 0 ? { ...people.value[idx] } : null)
    if (existing) { clearTimeout(existing.timer); _purgeTimers.delete(k) }

    removePerson(id)

    // Review fix (required): entry is identity token for this purge. When same id triggered again during committed
    // (DELETE sent, request in flight) is a legal scenario (existing branch above handles), swaps in new
    // entry; old entry's timer callback and undo closure must be able to detect "I've been replaced",
    // can't just check key still in map and wrongly delete/insert new entry state—always use `_purgeTimers.get(k) === entry`
    // reference equality to judge "is the one in map right now still me", not just check key exists.
    // This also makes the previously separate `cancelled` flag redundant: first undo() removes entry from map,
    // same undo clicked second time `_purgeTimers.get(k)` is no longer itself, naturally no-op.
    const entry: PurgeEntry = {
      timer: undefined as unknown as ReturnType<typeof setTimeout>,
      snapshot,
      idx,
      committed: false,
    }

    const undo = (): void => {
      if (_purgeTimers.get(k) !== entry) return   // Not this one (already spammed-cancelled, or replaced by new purge)
      if (entry.committed) return                  // Window passed (timer fired) → no-op, follow Vue2
      _purgeTimers.delete(k)
      clearTimeout(entry.timer)
      if (entry.snapshot) insertPersonAt(entry.snapshot, entry.idx)
    }

    entry.timer = setTimeout(() => {
      if (_purgeTimers.get(k) !== entry) return    // Already spammed-undone, or replaced by new purge
      // Fix 1 (Vue2 :1198 before :1201): Vue2 removes entry **before** sending request, during network flight window
      // if one fetchPeople occurs, deleted person will "zombie" resurface. Here change to: mark committed first (make undo ineffective,
      // preserve "expired not reversible" semantics), keep entry until request settles then remove in finally, filter window thus has no gap.
      // Regression test see people.test.ts "committed but purgePerson still in flight" two cases (review required).
      entry.committed = true
      void service.photos
        .purgePerson(id)
        .catch((e: unknown) => {
          console.error('[photos-people] purgePersonWithUndo', e)
          // Failure, insert snapshot back at original position; don't fetchPeople—server may still return old view, will blow away just-inserted item
          // (follow Vue2 :1204-1205 comment and approach).
          if (entry.snapshot) insertPersonAt(entry.snapshot, entry.idx)
        })
        .finally(() => {
          // Review fix (required): confirm map still has this one before deleting, can't just delete(k) blindly.
          // Scenario: after committed (DELETE request in flight) same id triggered again, old entry swapped for new
          // entry2; if unconditional delete(k) here, request 1 settle will delete entry2 too—entry2's
          // timer2 fires sees `get(k) === undefined` returns directly, second purge never sends,
          // its undo also ineffective (dead reference).
          if (_purgeTimers.get(k) === entry) _purgeTimers.delete(k)
        })
    }, PURGE_DELAY_MS)

    _purgeTimers.set(k, entry)
    return undo
  }

  // Merge suggestion: optimistically remove suggestion first, on failure refetch suggestion list to correct (follow Vue2 :1224-1246).
  // accept's finally unconditionally fetchPeople (merge changes person list); reject doesn't touch person list.
  async function acceptMergeSuggestion(suggestionId: string | number): Promise<void> {
    const s = mergeSuggestions.value.find((m) => key(m.id as string | number) === key(suggestionId))
    mergeSuggestions.value = mergeSuggestions.value.filter((m) => key(m.id as string | number) !== key(suggestionId))
    // Fix (review required): brief snapshot puts `finally { fetchPeople() }` outside `if (s)`,
    // when suggestionId not found locally (already consumed elsewhere/expired) will also waste one listPersons call—Vue2
    // :1227-1234 try/catch/finally entire block is inside `if (s)`, not found does nothing. Here
    // move inside if(s) to align with Vue2: if merge didn't actually happen, no reason to refetch person list, reduce one pointless request.
    if (s) {
      try {
        await service.photos.mergePersons(s.fromId as string | number, s.intoId as string | number)
      } catch (e) {
        console.error('[photos-people] acceptMergeSuggestion', e)
        void fetchMergeSuggestions()
        throw e
      } finally {
        void fetchPeople()
      }
    }
  }

  async function rejectMergeSuggestion(suggestionId: string | number): Promise<void> {
    const s = mergeSuggestions.value.find((m) => key(m.id as string | number) === key(suggestionId))
    mergeSuggestions.value = mergeSuggestions.value.filter((m) => key(m.id as string | number) !== key(suggestionId))
    try {
      if (s) await service.photos.rejectMergeSuggestion(s.fromId as string | number, s.intoId as string | number)
    } catch (e) {
      console.error('[photos-people] rejectMergeSuggestion', e)
      void fetchMergeSuggestions()
      throw e
    }
  }

  // Purely local clear: backend has no "dismiss all" endpoint, next fetchMergeSuggestions suggestions will reappear (follow Vue2 :1248 comment).
  function dismissAllMerges(): void { mergeSuggestions.value = [] }

  function __resetForTest(): void {
    for (const entry of _purgeTimers.values()) clearTimeout(entry.timer)
    _purgeTimers.clear()
    people.value = []
    peopleLoaded.value = false
    facesIndexedUpTo.value = null
    mergeSuggestions.value = []
    filter.value = readFilter()
  }

  return {
    people, peopleLoaded, facesIndexedUpTo, filter, mergeSuggestions,
    named, unnamed, visibleUnnamed, namedCount, unnamedCount, hiddenSingletonCount,
    personById, patchPerson,
    fetchPeople, fetchMergeSuggestions, setConfidence, setShowSingletons,
    renamePerson, setPersonRelation, setPersonFavorite, setPersonCover, setPersonHero,
    mergePersonInto, purgePersonWithUndo,
    acceptMergeSuggestion, rejectMergeSuggestion, dismissAllMerges,
    __resetForTest,
  }
})
