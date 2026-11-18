import type { IpcRendererEvent } from 'electron'
import type { AccountData } from '../../../types/accounts'
import type {
  AutoRerollConfig,
  AutoRerollSummaryResult,
  DailyQuestRerollResponse,
  DailyQuestsAccountData,
} from '../../../types/daily-quests'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../../config/constants/main-process'

export function requestDailyQuests(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.DailyQuestsRequest, accounts)
}

export function rerollDailyQuest(account: AccountData, questId: string) {
  ipcRenderer.send(
    ElectronAPIEventKeys.DailyQuestReroll,
    account,
    questId
  )
}

export function notificationDailyQuests(
  callback: (value: Array<DailyQuestsAccountData>) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: Array<DailyQuestsAccountData>
  ) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.DailyQuestsNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.DailyQuestsNotification,
        customCallback
      ),
  }
}

export function notificationDailyQuestReroll(
  callback: (value: DailyQuestRerollResponse) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: DailyQuestRerollResponse
  ) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.DailyQuestRerollNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.DailyQuestRerollNotification,
        customCallback
      ),
  }
}

export function runAutoRerollDailyQuests(
  accounts: Array<AccountData>,
  customConfig?: AutoRerollConfig
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.DailyQuestsAutoRerollRun,
    accounts,
    customConfig
  )
}

export function notificationAutoRerollDailyQuests(
  callback: (value: AutoRerollSummaryResult) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: AutoRerollSummaryResult
  ) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.DailyQuestsAutoRerollNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.DailyQuestsAutoRerollNotification,
        customCallback
      ),
  }
}
