import type { AxiosInstance } from 'axios'
import { initService, getHttp, refreshAccessToken } from './http.js'
import { getConfig } from './config.js'
import { createSys } from './sys.js'
import { createUsers } from './users.js'
import { createFolder } from './folder.js'
import { createApps } from './apps.js'
import { createPhotos } from './photos.js'
import { createFile, UPLOAD_TUS_ENDPOINT } from './file.js'
import { createBatch } from './batch.js'
import { createStorage } from './storage.js'
import { createImage } from './image.js'
import { parseUtil } from './parseUtil.js'
import { createSamba } from './samba.js'
import { createDisks } from './disks.js'
import { createCloud } from './cloud.js'
import { createDriver } from './driver.js'
import { createContainer } from './container.js'
import { createAppstore } from './appstore.js'
import { createCompose } from './compose.js'
import { createRaid } from './raid.js'
import { createSnapshot } from './snapshot.js'
import { createNetwork, networkErrorText } from './network.js'
import { createKvm } from './kvm.js'
import { createTerminal } from './terminal.js'
import { createSearch } from './search.js'
import { createAi } from './ai.js'
import { sseRequest } from './sse.js'
import { createNotes } from './notes.js'
import { createWiki } from './wiki.js'
import { createUploadBatches } from './uploadBatches.js'

export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText, sseRequest }
export { isDistillableName, DISTILL_EXTS } from './notes.js'
export { createRootBody } from './wiki.js'
export type { SseOptions, SseOutcome } from './sse.js'
export type { ServiceConfig } from './config.js'
export type { Utilization, UtilSection, StdEnvelope, EventModel, FolderEntry, FolderListing, AppGridWidget, AppGridItem, PhotoAsset, FileContent, ServerUploadTask, UploadPrecheckResult, LoginResult, UserStatus, UserInfo, MemberInfo, UserFolderPermission, SambaConnection, CloudMount, CloudDriver, HardwareInfo, DockerNetwork, PruneReport, AppCategory, StoreAppInfo, StoreAppCatalog, UpgradableAppInfo, AppStoreSource, ComposeAppWithStoreInfo, UpdateCheck, SysBaseInfo, SystemPathEntry, SystemPaths, SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, LanDevice, LanDiscovery, MigrateStatus, NetworkIPv4Config, NetworkWirelessConfig, NetworkInterfaceConfig, NetworkInterfaceUpdate, WifiScanResult, CreateBatchInput, UploadBatch, UploadBatchItem, BatchDetail } from './types.js'
export type { ComposeContainerSummary, ComposeContainersInfo } from './compose.js'
export type { RaidStatus, RaidMemberDisk, RaidMemberDiskRow, RaidReplaceDiskBody, RaidCreateBody } from './raid.js'
export type { Drive, DiskChild, DiskRaidInfo, DiskListData } from './disks.js'
export type { SnapshotVolume, SnapshotPolicy } from './snapshot.js'
export type { KvmVM, KvmVMList, KvmVncInfo, KvmSettings, KvmSettingsUpdate, KvmISO, KvmISODownloadProgress, KvmSnapshot, KvmCreateVMRequest, KvmUpdateVMRequest } from './kvm.js'
export type { TerminalMode, TerminalSessionInfo, TerminalSettings, TerminalWindow } from './terminal.js'
export type { SearchSource, SearchFilePath, SearchCite, SemanticHit, FileNameHit, ImageHit, NoteHit, NormalizedAggregate } from './search.js'
export type { Note, CreateNoteFields, UpdateNoteFields, NotesSettings, SettingsFields, NotesDistillSettings, DistillSettingsPatch, DistillJob, DistillJobsView } from './notes.js'
export type { WikiRoot, WikiCandidate, WikiTreeNode, WikiChildMapEntry, WikiRecentChange, WikiNode } from './wiki.js'

// 惰性域服务:initService 之后访问。
export const service = {
  get sys(): ReturnType<typeof createSys> {
    return createSys(getHttp() as AxiosInstance)
  },
  get users(): ReturnType<typeof createUsers> {
    return createUsers(getHttp() as AxiosInstance)
  },
  get folder(): ReturnType<typeof createFolder> {
    return createFolder(getHttp() as AxiosInstance)
  },
  get apps(): ReturnType<typeof createApps> {
    return createApps(getHttp() as AxiosInstance)
  },
  get photos(): ReturnType<typeof createPhotos> {
    return createPhotos(getHttp() as AxiosInstance, () => getConfig().getToken())
  },
  get file(): ReturnType<typeof createFile> {
    return createFile(getHttp() as AxiosInstance, () => getConfig().getToken())
  },
  get uploadBatches(): ReturnType<typeof createUploadBatches> {
    return createUploadBatches(getHttp() as AxiosInstance, () => getConfig().getToken())
  },
  get batch(): ReturnType<typeof createBatch> {
    return createBatch(getHttp() as AxiosInstance, () => getConfig().getToken())
  },
  get storage(): ReturnType<typeof createStorage> {
    return createStorage(getHttp() as AxiosInstance)
  },
  get image(): ReturnType<typeof createImage> {
    return createImage(() => getConfig().getToken())
  },
  get samba(): ReturnType<typeof createSamba> {
    return createSamba(getHttp() as AxiosInstance)
  },
  get disks(): ReturnType<typeof createDisks> {
    return createDisks(getHttp() as AxiosInstance)
  },
  get cloud(): ReturnType<typeof createCloud> {
    return createCloud(getHttp() as AxiosInstance)
  },
  get driver(): ReturnType<typeof createDriver> {
    return createDriver(getHttp() as AxiosInstance)
  },
  get container(): ReturnType<typeof createContainer> {
    return createContainer(getHttp() as AxiosInstance)
  },
  get appstore(): ReturnType<typeof createAppstore> {
    return createAppstore(getHttp() as AxiosInstance)
  },
  get compose(): ReturnType<typeof createCompose> {
    return createCompose(getHttp() as AxiosInstance)
  },
  get raid(): ReturnType<typeof createRaid> {
    return createRaid(getHttp() as AxiosInstance)
  },
  get snapshot(): ReturnType<typeof createSnapshot> {
    return createSnapshot(getHttp() as AxiosInstance)
  },
  get network(): ReturnType<typeof createNetwork> {
    return createNetwork(getHttp() as AxiosInstance)
  },
  get kvm(): ReturnType<typeof createKvm> {
    return createKvm(getHttp() as AxiosInstance)
  },
  get terminal(): ReturnType<typeof createTerminal> {
    return createTerminal(getHttp() as AxiosInstance)
  },
  get search(): ReturnType<typeof createSearch> {
    return createSearch(getHttp() as AxiosInstance)
  },
  get ai(): ReturnType<typeof createAi> {
    return createAi(getHttp() as AxiosInstance, () => getConfig().getToken())
  },
  get notes(): ReturnType<typeof createNotes> {
    return createNotes(getHttp() as AxiosInstance)
  },
  get wiki(): ReturnType<typeof createWiki> {
    return createWiki(getHttp() as AxiosInstance)
  },
}
