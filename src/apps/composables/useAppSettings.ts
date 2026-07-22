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
   * save()/toYaml() 共享:把当前 model 序列化为 YAML。
   * tipsCustom 若只是 parseSettings 借 before_install 回落预填、用户从未编辑过,不能当用户确认的自定义提示落盘
   * (否则会把当前语言的回落文案冻结进 tips.custom,遮蔽未来的多语言回落解析)——此时清空后再喂给 buildYaml。
   */
  function serializeModel(m: SettingsModel): string {
    const untouchedFallback = m.tipsFromFallback && m.tipsCustom === initialTips
    const forBuild = untouchedFallback ? { ...m, tipsCustom: '' } : m
    return buildYaml(originalYaml, forBuild)
  }

  /** dry_run 预检 → 真 PUT(受理即返)→ markApplying。端口冲突落 conflicts,其余错误落 saveError。 */
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

  /** 进 YAML tab 时取文本:当前 model 序列化(带过表单已做的修改),复用 save() 同款 tipsFromFallback 处理。 */
  function toYaml(): string {
    return model.value ? serializeModel(model.value) : originalYaml
  }

  /**
   * YAML tab 编辑完切回表单:重 parse 重建 model,originalYaml 换成这份新文本。
   * 成功后所有 dirty 标记自然归零(model 是刚 parse 出来的新对象),originalYaml 也已替换——
   * 后续 save() 会以这份新文本为 base 再 buildYaml,语义正确(YAML tab 的编辑不会被 form tab 覆盖回去)。
   * 解析失败:不触碰现有 model/originalYaml,只落 parseError,返回 false。
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

  /** YAML tab 内保存:不经表单 model,直接以原文走 dry_run→PUT(与 save() 同款错误/冲突处理)。成功 true。 */
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
