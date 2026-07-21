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

  /** dry_run 预检 → 真 PUT(受理即返)→ markApplying。端口冲突落 conflicts,其余错误落 saveError。 */
  async function save(): Promise<boolean> {
    if (!model.value || saving.value) return false
    saving.value = true; saveError.value = ''; conflicts.value = []
    try {
      // tipsCustom 若只是 parseSettings 借 before_install 回落预填、用户从未编辑过,不能当用户确认的自定义提示落盘
      // (否则会把当前语言的回落文案冻结进 tips.custom,遮蔽未来的多语言回落解析)——此时清空后再喂给 buildYaml。
      const untouchedFallback = model.value.tipsFromFallback && model.value.tipsCustom === initialTips
      const forBuild = untouchedFallback ? { ...model.value, tipsCustom: '' } : model.value
      const yaml = buildYaml(originalYaml, forBuild)
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
