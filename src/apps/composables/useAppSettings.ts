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
  let originalYaml = ''

  async function load() {
    loading.value = true; loadError.value = false; model.value = null
    try {
      originalYaml = await service.compose.getYaml(id.value)
      model.value = parseSettings(originalYaml, locale.value)
    } catch (e) {
      console.warn('[apps] settings load', id.value, e)
      loadError.value = true
    } finally { loading.value = false }
  }

  /** dry_run 预检 → 真 PUT(受理即返)→ markApplying。端口冲突落 conflicts,其余错误落 saveError。 */
  async function save(): Promise<boolean> {
    if (!model.value || saving.value) return false
    saving.value = true; saveError.value = ''; conflicts.value = []
    try {
      const yaml = buildYaml(originalYaml, model.value)
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

  return { model, loading, loadError, saving, saveError, conflicts, load, save }
}
