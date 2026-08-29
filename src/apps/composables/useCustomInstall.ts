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

/** ensureComposeMeta injects the icon into the x-nimoos extension block (or x-casaos when one already exists) —
 *  read back the actual value (it may come from the user's own YAML, not necessarily the default formula URL) for installProgress.track(). */
function extractIcon(yamlText: string): string {
  const doc = asDict(YAML.parse(yamlText))
  const icon = asDict(doc['x-nimoos']).icon ?? asDict(doc['x-casaos']).icon
  return typeof icon === 'string' ? icon : ''
}

export function useCustomInstall() {
  const { t } = useI18n()
  const installedApps = useInstalledAppsStore()
  const progress = useInstallProgressStore()

  /** Step 1, normalize: parse failures (bad YAML) are caught right here; no later step runs. */
  function normalize(rawYaml: string): NormalizeResult {
    try {
      const { yaml, name } = ensureComposeMeta(rawYaml)
      return { ok: true, yaml, name }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  /** "Validate" button: step 1 normalize + step 3 dry_run precheck; no D4 same-name hard block, no real install. */
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

  /** "Install" button: 1 normalize -> 2 D4 same-name hard block -> 3 dry_run -> 4 real install -> 5 track. */
  async function installYaml(rawYaml: string): Promise<CustomInstallResult> {
    const meta = normalize(rawYaml)
    if (!meta.ok) return meta
    const { yaml, name } = meta

    // D4: on a name collision the backend silently overwrites the installed app's working directory —
    // better to hard-block in the frontend than let users lose data silently.
    // Refresh the installed list unconditionally (not only when the store is empty) — otherwise the store
    // goes stale while the form is being filled (an app with the same name installed via the old UI /
    // another tab goes unnoticed), the hard block silently fails, and the backend still overwrites the other app's working directory.
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
