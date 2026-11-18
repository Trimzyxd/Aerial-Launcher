import type { IpcRendererEvent } from 'electron'
import type { AccountData, AccountDataList } from '../../types/accounts'
import type {
  BulkAcceptResult,
  BulkSendResult,
  FriendsActionResult,
  FriendsSummaryData,
} from '../../types/friends-management'

import { ipcRenderer } from 'electron'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function getFriendsSummary(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsGetSummary, account)
}

export function notificationFriendsSummary(
  callback: (value: FriendsSummaryData) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: FriendsSummaryData) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsGetSummaryNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsGetSummaryNotification,
        customCallback
      ),
  }
}

export function acceptFriendRequest(account: AccountData, friendId: string) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsAcceptRequest, account, friendId)
}

export function notificationAcceptFriendRequest(
  callback: (value: FriendsActionResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: FriendsActionResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsAcceptRequestNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsAcceptRequestNotification,
        customCallback
      ),
  }
}

export function rejectFriendRequest(account: AccountData, friendId: string) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsRejectRequest, account, friendId)
}

export function notificationRejectFriendRequest(
  callback: (value: FriendsActionResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: FriendsActionResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsRejectRequestNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsRejectRequestNotification,
        customCallback
      ),
  }
}

export function sendFriendRequest(
  account: AccountData,
  displayNameOrId: string
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.FriendsSendRequest,
    account,
    displayNameOrId
  )
}

export function notificationSendFriendRequest(
  callback: (value: FriendsActionResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: FriendsActionResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsSendRequestNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsSendRequestNotification,
        customCallback
      ),
  }
}

export function removeFriendRecord(account: AccountData, friendId: string) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsRemove, account, friendId)
}

export function notificationRemoveFriendRecord(
  callback: (value: FriendsActionResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: FriendsActionResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsRemoveNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsRemoveNotification,
        customCallback
      ),
  }
}

export function bulkAcceptIncoming(accounts: AccountDataList) {
  ipcRenderer.send(ElectronAPIEventKeys.FriendsBulkAccept, accounts)
}

export function notificationBulkAccept(
  callback: (value: BulkAcceptResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: BulkAcceptResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsBulkAcceptNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsBulkAcceptNotification,
        customCallback
      ),
  }
}

export function bulkSendFriendRequest(
  accounts: AccountDataList,
  displayNameOrId: string
) {
  ipcRenderer.send(
    ElectronAPIEventKeys.FriendsBulkSend,
    accounts,
    displayNameOrId
  )
}

export function notificationBulkSend(
  callback: (value: BulkSendResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: BulkSendResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.FriendsBulkSendNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.FriendsBulkSendNotification,
        customCallback
      ),
  }
}
