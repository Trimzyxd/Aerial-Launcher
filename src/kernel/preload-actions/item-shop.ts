import type { IpcRendererEvent } from 'electron'
import type { AccountData } from '../../types/accounts'
import type {
  AccountGiftingInfo,
  BuyItemPayload,
  BuyItemResult,
  SendGiftPayload,
  SendGiftResult,
  ShopItemEntry,
} from '../../types/item-shop'

import { ipcRenderer } from 'electron'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function getItemShopCatalog() {
  ipcRenderer.send(ElectronAPIEventKeys.ItemShopGetCatalog)
}

export function notificationItemShopCatalog(
  callback: (response: { success: boolean; items: Array<ShopItemEntry>; errorMessage?: string }) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: { success: boolean; items: Array<ShopItemEntry>; errorMessage?: string }
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ItemShopGetCatalogNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ItemShopGetCatalogNotification,
        customCallback
      ),
  }
}

export function getAccountGiftingInfo(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.ItemShopGetGiftingInfo, account)
}

export function notificationAccountGiftingInfo(
  callback: (value: AccountGiftingInfo) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: AccountGiftingInfo) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ItemShopGetGiftingInfoNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ItemShopGetGiftingInfoNotification,
        customCallback
      ),
  }
}

export function sendGift(payload: SendGiftPayload) {
  ipcRenderer.send(ElectronAPIEventKeys.ItemShopSendGift, payload)
}

export function notificationSendGift(
  callback: (value: SendGiftResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: SendGiftResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ItemShopSendGiftNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ItemShopSendGiftNotification,
        customCallback
      ),
  }
}

export function buyItem(payload: BuyItemPayload) {
  ipcRenderer.send(ElectronAPIEventKeys.ItemShopBuyItem, payload)
}

export function notificationBuyItem(
  callback: (value: BuyItemResult) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: BuyItemResult) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ItemShopBuyItemNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ItemShopBuyItemNotification,
        customCallback
      ),
  }
}
