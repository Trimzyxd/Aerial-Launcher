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
import {
  getQueryProfileMainProfile,
  giftCatalogEntry,
} from '../../services/endpoints/mcp'

export class ItemShopCore {
  static async getCatalog() {
    try {
      const response = await axios.get('https://fortnite-api.com/v2/shop', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      const entries = response.data?.data?.entries || []

      const items: Array<ShopItemEntry> = []
      const seen = new Set<string>()

      for (const entry of entries) {
        if (entry.giftable === false) continue
        const finalPrice = Number(entry.finalPrice || 0)
        if (finalPrice <= 0) continue

        const offerId = entry.offerId
        if (!offerId || seen.has(offerId)) continue
        seen.add(offerId)

        const renderImg = entry.newDisplayAsset?.renderImages?.[0]?.image
        const layoutName = entry.layout?.name || 'Featured'

        let name = ''
        let rarity = 'Common'
        let type = 'Item'
        let imageUrl = ''
        let category = layoutName

        if (entry.bundle?.name) {
          name = entry.bundle.name
          category = 'Bundles'
          type = 'Bundle'
          imageUrl =
            renderImg ||
            entry.bundle.image ||
            entry.brItems?.[0]?.images?.featured ||
            entry.brItems?.[0]?.images?.icon ||
            entry.brItems?.[0]?.images?.smallIcon ||
            ''
        } else if (entry.brItems && entry.brItems.length > 0) {
          const first = entry.brItems[0]
          name = first.name || ''
          rarity = first.rarity?.displayValue || first.rarity?.value || 'Rare'
          type = first.type?.displayValue || first.type?.value || 'Cosmetic'
          imageUrl =
            renderImg ||
            first.images?.featured ||
            first.images?.icon ||
            first.images?.smallIcon ||
            ''
        } else if (entry.tracks && entry.tracks.length > 0) {
          const track = entry.tracks[0]
          name = track.title ? `${track.title} - ${track.artist || ''}`.trim() : 'Jam Track'
          category = 'Jam Tracks'
          type = 'Jam Track'
          imageUrl = track.albumArt || renderImg || ''
        } else if (entry.cars && entry.cars.length > 0) {
          const car = entry.cars[0]
          name = car.name || 'Vehicle'
          category = 'Vehicles'
          type = 'Vehicle'
          imageUrl = renderImg || car.images?.large || car.images?.small || car.images?.icon || ''
        } else if (entry.instruments && entry.instruments.length > 0) {
          const inst = entry.instruments[0]
          name = inst.name || 'Instrument'
          category = 'Instruments'
          type = 'Instrument'
          imageUrl = renderImg || inst.images?.large || inst.images?.small || inst.images?.icon || ''
        } else if (entry.legoKits && entry.legoKits.length > 0) {
          const lego = entry.legoKits[0]
          name = lego.name || 'LEGO Kit'
          category = 'LEGO'
          type = 'LEGO Kit'
          imageUrl = renderImg || lego.images?.large || lego.images?.small || lego.images?.icon || ''
        } else {
          name = entry.devName?.replace(/^\[VIRTUAL\]\d+\s*x\s*/i, '').replace(/\s*for\s*-?\d+\s*MtxCurrency/i, '') || 'Item'
          imageUrl = renderImg || ''
        }

        if (!name) continue

        items.push({
          id: offerId,
          name,
          description: entry.bundle?.info || entry.brItems?.[0]?.description || '',
          type,
          rarity,
          rarityColor: '#888888',
          price: finalPrice,
          regularPrice: entry.regularPrice || finalPrice,
          banner: entry.banner?.value,
          category,
          offerId,
          giftable: true,
          images: {
            icon: imageUrl,
            featured: imageUrl,
          },
        })
      }

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
      const profileResponse = await getQueryProfileMainProfile({
        accessToken,
        accountId: account.accountId,
      })

      const profile = profileResponse.data?.profileChanges?.[0]?.profile
      const items = profile?.items || {}
      const stats = profile?.stats?.attributes || {}

      let vbucks = 0
      for (const item of Object.values(items) as any[]) {
        if (item?.templateId?.startsWith('Currency:Mtx')) {
          vbucks += item?.quantity ?? 0
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
      const eligibleFriends: Array<EligibleFriend> = []
      try {
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

        for (const f of rawFriends) {
          const createdMs = new Date(f.created).getTime()
          const diffMs = now - createdMs
          const isEligible48h = diffMs >= 48 * 3600 * 1000
          const hoursRemaining = isEligible48h ? 0 : Math.max(0, Math.ceil((48 * 3600 * 1000 - diffMs) / 3600000))

          eligibleFriends.push({
            accountId: f.accountId,
            displayName: namesMap.get(f.accountId) || f.accountId,
            created: f.created,
            isEligible48h,
            hoursRemaining,
          })
        }

        eligibleFriends.sort((a, b) => {
          if (a.isEligible48h && !b.isEligible48h) return -1
          if (!a.isEligible48h && b.isEligible48h) return 1
          return a.displayName.localeCompare(b.displayName)
        })
      } catch (friendsError) {
        // Log friends fetch issue without failing V-Bucks display
        console.error('[ItemShopCore] Error fetching friends summary:', friendsError)
      }

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
    } catch (error) {
      console.error('[ItemShopCore] Error fetching gifting info:', error)
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
            isDryRun: payload.isDryRun,
            errorMessage: 'Authentication failed for gifter account',
          } as SendGiftResult
        )
        return
      }

      // If dry-run test mode: DO NOT call giftCatalogEntry!
      if (payload.isDryRun) {
        // Query common_core to verify connection and session validity
        await getQueryProfileMainProfile({
          accessToken,
          accountId: payload.account.accountId,
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
            isDryRun: true,
            errorMessage: null,
          } as SendGiftResult
        )
        return
      }

      // Real purchase
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
          isDryRun: false,
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
          isDryRun: payload.isDryRun,
          errorMessage: error?.response?.data?.errorMessage || error?.message || 'Gifting request failed',
        } as SendGiftResult
      )
    }
  }
}
