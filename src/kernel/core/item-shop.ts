import axios from 'axios'
import type { AccountData } from '../../types/accounts'
import type {
  AccountGiftingInfo,
  EligibleFriend,
  SendGiftPayload,
  SendGiftResult,
  ShopItemEntry,
} from '../../types/item-shop'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import { getFriendsSummary } from '../../services/endpoints/friends'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'
import { getQueryProfile, giftCatalogEntry } from '../../services/endpoints/mcp'

export class ItemShopCore {
  static async getCatalog() {
    try {
      const response = await axios.get('https://fortnite-api.com/v2/shop/br')
      const data = response.data?.data

      const items: Array<ShopItemEntry> = []

      const processEntries = (entries: any[], defaultCategory = 'Featured') => {
        if (!Array.isArray(entries)) return

        for (const entry of entries) {
          const firstItem = entry.items?.[0] || entry.bundle || {}
          const name = entry.bundle?.name || firstItem?.name || entry.devName || 'Unknown Item'
          const description = entry.bundle?.info || firstItem?.description || ''
          const rarity = firstItem?.rarity?.value || 'Common'
          const rarityColor = firstItem?.rarity?.backendValue || '#888888'

          const images = {
            icon: firstItem?.images?.icon || firstItem?.images?.smallIcon || entry.bundle?.image,
            featured: firstItem?.images?.featured || entry.bundle?.image || firstItem?.images?.icon,
            background: entry.newDisplayAsset?.materialInstances?.[0]?.images?.Background,
          }

          items.push({
            id: entry.offerId || firstItem?.id || Math.random().toString(),
            name,
            description,
            type: firstItem?.type?.value || 'Cosmetic',
            rarity,
            rarityColor,
            price: entry.finalPrice ?? 0,
            regularPrice: entry.regularPrice ?? entry.finalPrice ?? 0,
            banner: entry.banner?.value,
            category: entry.layout?.category || entry.section?.name || defaultCategory,
            offerId: entry.offerId,
            giftable: entry.giftable !== false,
            images,
          })
        }
      }

      if (data?.featured?.entries) processEntries(data.featured.entries, 'Featured')
      if (data?.daily?.entries) processEntries(data.daily.entries, 'Daily')
      if (data?.specialFeatured?.entries) processEntries(data.specialFeatured.entries, 'Special')
      if (data?.specialDaily?.entries) processEntries(data.specialDaily.entries, 'Special Daily')

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopGetCatalogNotification,
        {
          success: true,
          items,
        }
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopGetCatalogNotification,
        {
          success: false,
          items: [],
          errorMessage: error?.message,
        }
      )
    }
  }

  static async getGiftingInfo(account: AccountData) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) return

      // 1. Fetch common_core profile for V-Bucks and Gift History
      const profileResponse = await getQueryProfile({
        accessToken,
        accountId: account.accountId,
        profileId: 'common_core',
      })

      const profile = profileResponse.data?.profileChanges?.[0]?.profile
      const items = profile?.items || {}
      const stats = profile?.stats?.attributes || {}

      let vbucks = 0
      for (const [key, item] of Object.entries(items) as [string, any][]) {
        if (key.includes('Currency:Mtx') || item?.templateId?.includes('Currency:Mtx')) {
          vbucks += item?.quantity || 0
        }
      }

      const now = Date.now()
      const giftHistory = Array.isArray(stats.gift_history) ? stats.gift_history : []
      const giftsLast24h = giftHistory.filter((g: any) => {
        const giftDate = new Date(g.date).getTime()
        return !isNaN(giftDate) && now - giftDate < 24 * 3600 * 1000
      }).length

      const giftsRemainingToday = Math.max(0, 5 - giftsLast24h)
      const canSendGifts = stats.allowed_to_send_gifts !== false

      // 2. Fetch Friends Summary for 48h check
      const friendsSummary = await getFriendsSummary({
        accessToken,
        accountId: account.accountId,
      })

      const rawFriends = friendsSummary.data?.friends || []
      const friendIds = rawFriends.map((f) => f.accountId)

      const namesMap = new Map<string, string>()
      const chunkSize = 100
      for (let i = 0; i < friendIds.length; i += chunkSize) {
        const chunk = friendIds.slice(i, i + chunkSize)
        try {
          const lookup = await findUsersByAccountIds({ accessToken, accountIds: chunk })
          if (Array.isArray(lookup.data)) {
            for (const u of lookup.data) {
              if (u.id && u.displayName) namesMap.set(u.id, u.displayName)
            }
          }
        } catch {
          // Continue
        }
      }

      const eligibleFriends: Array<EligibleFriend> = rawFriends.map((f) => {
        const createdMs = new Date(f.created).getTime()
        const diffMs = now - createdMs
        const isEligible48h = diffMs >= 48 * 3600 * 1000
        const hoursRemaining = isEligible48h ? 0 : Math.max(0, Math.ceil((48 * 3600 * 1000 - diffMs) / 3600000))

        return {
          accountId: f.accountId,
          displayName: namesMap.get(f.accountId) || f.accountId,
          created: f.created,
          isEligible48h,
          hoursRemaining,
        }
      })

      // Sort: 48h eligible first, then alphabetical
      eligibleFriends.sort((a, b) => {
        if (a.isEligible48h && !b.isEligible48h) return -1
        if (!a.isEligible48h && b.isEligible48h) return 1
        return a.displayName.localeCompare(b.displayName)
      })

      const result: AccountGiftingInfo = {
        accountId: account.accountId,
        displayName: account.displayName,
        vbucks,
        canSendGifts,
        giftsRemainingToday,
        eligibleFriends,
      }

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopGetGiftingInfoNotification,
        result
      )
    } catch {
      // Fallback
    }
  }

  static async sendGift(payload: SendGiftPayload) {
    try {
      const accessToken = await Authentication.verifyAccessToken(payload.account)
      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ItemShopSendGiftNotification,
          {
            success: false,
            accountId: payload.account.accountId,
            receiverAccountId: payload.receiverAccountId,
            receiverDisplayName: payload.receiverDisplayName,
            itemName: payload.itemName,
            price: payload.price,
            errorMessage: 'Authentication failed for gifter account',
          } as SendGiftResult
        )
        return
      }

      await giftCatalogEntry({
        accessToken,
        accountId: payload.account.accountId,
        offerId: payload.offerId,
        receiverAccountIds: [payload.receiverAccountId],
        giftWrapTemplateId: payload.giftWrapTemplateId || 'GiftBox:gb_default',
        personalMessage: payload.personalMessage || 'Enjoy your gift!',
        purchasePrice: payload.price,
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopSendGiftNotification,
        {
          success: true,
          accountId: payload.account.accountId,
          receiverAccountId: payload.receiverAccountId,
          receiverDisplayName: payload.receiverDisplayName,
          itemName: payload.itemName,
          price: payload.price,
          errorMessage: null,
        } as SendGiftResult
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopSendGiftNotification,
        {
          success: false,
          accountId: payload.account.accountId,
          receiverAccountId: payload.receiverAccountId,
          receiverDisplayName: payload.receiverDisplayName,
          itemName: payload.itemName,
          price: payload.price,
          errorMessage: error?.response?.data?.errorMessage || error?.message || 'Gifting request failed',
        } as SendGiftResult
      )
    }
  }
}
