import { useI18n } from 'vue-i18n'
import YAML from 'yaml'
import { service } from '@nimotech/nimoos-service'
import { useInstalledAppsStore } from '../stores/installedApps'
import { useInstallProgressStore } from '../stores/installProgress'
import { ensureComposeMeta } from '../util/importNormalize'
import { parseInstallError } from './useInstallFlow'

export type CustomInstallResult =
  | { ok: true; name: string }
  | { ok: false; message: string; ports?: string[] }

export type CustomValidateResult =
  | { ok: true }
  | { ok: false; message: string; ports?: string[] }

type NormalizeResult = { ok: true; yaml: string; name: string } | { ok: false; message: string }

type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {})

/** ensureComposeMeta 把 icon 注入 x-nimoos(或已存在 x-casaos 时的 x-casaos)扩展块里——
 *  取回真实值(可能是用户 YAML 里自带的,不一定是默认公式 URL),供 installProgress.track() 用。 */
function extractIcon(yamlText: string): string {
  const doc = asDict(YAML.parse(yamlText))
  const icon = asDict(doc['x-nimoos']).icon ?? asDict(doc['x-casaos']).icon
  return typeof icon === 'string' ? icon : ''
}

export function useCustomInstall() {
  const { t } = useI18n()
  const installedApps = useInstalledAppsStore()
  const progress = useInstallProgressStore()

  /** ①规整:解析失败(坏 YAML)在这里就地拦下,后续步骤都不会跑。 */
  function normalize(rawYaml: string): NormalizeResult {
    try {
      const { yaml, name } = ensureComposeMeta(rawYaml)
      return { ok: true, yaml, name }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  /** 「校验」按钮:①规整 + ③dry_run 预检,不做 D4 同名硬挡、不真装。 */
  async function validateYaml(rawYaml: string): Promise<CustomValidateResult> {
    const meta = normalize(rawYaml)
    if (!meta.ok) return meta
    try {
      await service.compose.install(meta.yaml, { dryRun: true, checkPortConflict: true })
      return { ok: true }
    } catch (e) {
      const { message, ports } = parseInstallError(e)
      return { ok: false, message: message || t('appsInstallFailed', { name: meta.name }), ports: ports.length ? ports : undefined }
    }
  }

  /** 「安装」按钮:①规整 →②D4 同名硬挡 →③dry_run →④真装 →⑤track。 */
  async function installYaml(rawYaml: string): Promise<CustomInstallResult> {
    const meta = normalize(rawYaml)
    if (!meta.ok) return meta
    const { yaml, name } = meta

    // D4:后端对同名应用是静默覆盖已装应用的工作目录——宁可在前端硬挡,也不让用户无声丢数据。
    // 无条件刷新已装列表(不只在 store 为空时才刷新)——否则 store 在填表期间变陈旧
    // (旧版 UI/另一标签页装了同名应用后本 store 未感知),硬挡会静默失效,后端仍会覆盖对方工作目录。
    await installedApps.refresh().catch(() => {})
    if (installedApps.apps.some((a) => a.id === name)) {
      return { ok: false, message: t('appsCustomNameConflict') }
    }

    try {
      await service.compose.install(yaml, { dryRun: true, checkPortConflict: true })
      await service.compose.install(yaml, { checkPortConflict: true })
    } catch (e) {
      const { message, ports } = parseInstallError(e)
      return { ok: false, message: message || t('appsInstallFailed', { name }), ports: ports.length ? ports : undefined }
    }

    progress.track(name, name, extractIcon(yaml))
    return { ok: true, name }
  }

  return { validateYaml, installYaml }
}
