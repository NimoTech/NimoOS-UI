import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { parseSettings, buildYaml, type SettingsModel } from '../util/composeSettings'
import { parseInstallError } from './useInstallFlow'
import { useInstalledAppsStore } from '../stores/installedApps'

export function useAppSettings(id: Ref<string>) {
  const { locale } = useI18n()
  const installed = useInstalledAppsStore()
  const model = ref<SettingsModel | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
  const saving = ref(false)
  const saveError = ref('')
  const conflicts = ref<string[]>([])
  const parseError = ref('')
  let originalYaml = ''
  let initialTips = ''

  async function load() {
    loading.value = true; loadError.value = false; model.value = null
    try {
      originalYaml = await service.compose.getYaml(id.value)
      model.value = parseSettings(originalYaml, locale.value)
      initialTips = model.value.tipsCustom
    } catch (e) {
      console.warn('[apps] settings load', id.value, e)
      loadError.value = true
    } finally { loading.value = false }
  }

  /**
   * Shared by save()/toYaml(): serialize current model to YAML.
   * If tipsCustom is only a fallback pre-fill from parseSettings' before_install (user never edited),
   * it cannot be persisted as user-confirmed custom tips (otherwise current language fallback text
   * freezes into tips.custom, obscuring future multilingual fallback resolution)—in this case clear
   * it before passing to buildYaml.
   */
  function serializeModel(m: SettingsModel): string {
    const untouchedFallback = m.tipsFromFallback && m.tipsCustom === initialTips
    const forBuild = untouchedFallback ? { ...m, tipsCustom: '' } : m
    return buildYaml(originalYaml, forBuild)
  }

  /** dry_run precheck → real PUT (returns once accepted) → markApplying. Port conflicts go to conflicts, other errors to saveError. */
  async function save(): Promise<boolean> {
    if (!model.value || saving.value) return false
    saving.value = true; saveError.value = ''; conflicts.value = []
    try {
      const yaml = serializeModel(model.value)
      await service.compose.applySettings(id.value, yaml, { dryRun: true, checkPortConflict: true })
      await service.compose.applySettings(id.value, yaml, { checkPortConflict: true })
      installed.markApplying(id.value)
      return true
    } catch (e) {
      console.warn('[apps] settings save', id.value, e)
      const { message, ports } = parseInstallError(e)
      conflicts.value = ports
      saveError.value = message
      return false
    } finally { saving.value = false }
  }

  /** When entering YAML tab, get text: serialize current model (carries form edits), reuse save()'s same tipsFromFallback handling. */
  function toYaml(): string {
    return model.value ? serializeModel(model.value) : originalYaml
  }

  /**
   * After editing YAML tab, switch back to form: re-parse and rebuild model, replace originalYaml with this new text.
   * On success, all dirty flags naturally zero out (model is freshly parsed), originalYaml also replaced—
   * subsequent save() uses this new text as base for buildYaml, semantics correct (YAML tab edits won't be
   * overwritten by form tab).
   * Parse fails: don't touch existing model/originalYaml, only set parseError, return false.
   */
  function replaceFromYaml(text: string): boolean {
    try {
      const parsed = parseSettings(text, locale.value)
      model.value = parsed
      initialTips = parsed.tipsCustom
      originalYaml = text
      parseError.value = ''
      return true
    } catch (e) {
      parseError.value = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  /** Save within YAML tab: bypass form model, use raw text directly for dry_run→PUT (same error/conflict handling as save()). Returns true on success. */
  async function saveYaml(text: string): Promise<boolean> {
    if (saving.value) return false
    saving.value = true; saveError.value = ''; conflicts.value = []; parseError.value = ''
    try {
      await service.compose.applySettings(id.value, text, { dryRun: true, checkPortConflict: true })
      await service.compose.applySettings(id.value, text, { checkPortConflict: true })
      installed.markApplying(id.value)
      return true
    } catch (e) {
      console.warn('[apps] settings save yaml', id.value, e)
      const { message, ports } = parseInstallError(e)
      conflicts.value = ports
      saveError.value = message
      return false
    } finally { saving.value = false }
  }

  return {
    model, loading, loadError, saving, saveError, conflicts, parseError,
    load, save, toYaml, replaceFromYaml, saveYaml,
  }
}
