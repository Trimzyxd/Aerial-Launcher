import axios from 'axios'
import type { AccountData } from '../../types/accounts'
import type {
  AccountGiftingInfo,
  BuyItemPayload,
  BuyItemResult,
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
  purchaseItemCatalogEntry,
} from '../../services/endpoints/mcp'

export class ItemShopCore {
  private static sessionGifts = new Map<string, number[]>()

  public static recordSessionGift(accountId: string) {
    const current = ItemShopCore.sessionGifts.get(accountId) || []
    current.push(Date.now())
    ItemShopCore.sessionGifts.set(accountId, current)
  }

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
      let giftsList: any[] = []
      if (Array.isArray(stats.gift_history)) {
        giftsList = stats.gift_history
      } else if (Array.isArray(stats.gift_history?.gifts)) {
        giftsList = stats.gift_history.gifts
      } else if (Array.isArray(stats.gift_history?.sent)) {
        giftsList = stats.gift_history.sent
      } else if (stats.gift_history && typeof stats.gift_history === 'object') {
        for (const val of Object.values(stats.gift_history)) {
          if (Array.isArray(val)) {
            giftsList = val
            break
          }
        }
      }

      const profileGiftsLast24h = giftsList.filter((g: any) => {
        const dateStr = g?.date || g?.time || g?.created || g?.timestamp
        const giftDate = new Date(dateStr).getTime()
        return !isNaN(giftDate) && now - giftDate < 24 * 3600 * 1000
      }).length

      const localTimestamps = ItemShopCore.sessionGifts.get(account.accountId) || []
      const localGiftsLast24h = localTimestamps.filter((ts) => now - ts < 24 * 3600 * 1000).length

      const totalGiftsLast24h = Math.max(profileGiftsLast24h, localGiftsLast24h)
      const giftsRemainingToday = Math.max(0, 5 - totalGiftsLast24h)
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
        giftWrapTemplateId: '',
        personalMessage: '',
        purchasePrice: payload.price,
      })

      // Record session gift so slots decrement immediately even before Epic CDN cache refresh
      ItemShopCore.recordSessionGift(payload.account.accountId)

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
      const responseData = error?.response?.data
      const rawError =
        responseData?.errorMessage ||
        responseData?.errorCode ||
        responseData?.message ||
        error?.message ||
        'Gifting request failed'

      const errorCode = String(responseData?.errorCode || '').toLowerCase()
      const errorMessage = String(responseData?.errorMessage || '').toLowerCase()
      const numericErrorCode = Number(responseData?.numericErrorCode)
      const rawCombined = `${rawError} ${errorCode} ${errorMessage}`.toLowerCase()

      console.error('[ItemShopCore] SendGift error responseData:', {
        errorCode,
        numericErrorCode,
        errorMessage,
        rawError,
      })

      let friendlyMessage = String(rawError)

      const isSelfGift = payload.account.accountId === payload.receiverAccountId

      if (isSelfGift) {
        friendlyMessage = `Cannot send a gift to yourself (${payload.receiverDisplayName}). Use the "Buy Item" button to purchase cosmetics directly for this account.`
      } else if (
        numericErrorCode === 28004 ||
        rawCombined.includes('purchase_not_allowed') ||
        rawCombined.includes('already_owned') ||
        rawCombined.includes('already own') ||
        rawCombined.includes('owns') ||
        rawCombined.includes('item_already_owned') ||
        rawCombined.includes('origination_item_already_owned')
      ) {
        friendlyMessage = `${payload.receiverDisplayName} already owns ${payload.itemName}. Epic Games does not allow duplicate gifting.`
      } else if (
        numericErrorCode === 28001 ||
        rawCombined.includes('insufficient_funds') ||
        rawCombined.includes('not_enough_funds') ||
        rawCombined.includes('not_enough_mtx') ||
        rawCombined.includes('insufficient_balance')
      ) {
        friendlyMessage = `Insufficient V-Bucks balance to gift ${payload.itemName}.`
      } else if (
        numericErrorCode === 28015 ||
        rawCombined.includes('daily_limit') ||
        rawCombined.includes('daily_gift_limit') ||
        rawCombined.includes('max_gifts')
      ) {
        friendlyMessage = `Daily gifting limit reached (5/5 gifts sent today).`
      } else if (
        numericErrorCode === 28014 ||
        rawCombined.includes('not_eligible') ||
        rawCombined.includes('recipient_not_eligible') ||
        rawCombined.includes('friendship')
      ) {
        friendlyMessage = `${payload.receiverDisplayName} is not eligible to receive gifts yet (must be Epic friends for at least 48 hours).`
      }

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
          errorMessage: friendlyMessage,
        } as SendGiftResult
      )
    }
  }

  static async buyItem(payload: BuyItemPayload) {
    try {
      const accessToken = await Authentication.verifyAccessToken(payload.account)
      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ItemShopBuyItemNotification,
          {
            success: false,
            accountId: payload.account.accountId,
            itemName: payload.itemName,
            price: payload.price,
            isDryRun: payload.isDryRun,
            errorMessage: 'Authentication failed for account',
          } as BuyItemResult
        )
        return
      }

      if (payload.isDryRun) {
        await getQueryProfileMainProfile({
          accessToken,
          accountId: payload.account.accountId,
        })

        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ItemShopBuyItemNotification,
          {
            success: true,
            accountId: payload.account.accountId,
            itemName: payload.itemName,
            price: payload.price,
            isDryRun: true,
            errorMessage: null,
          } as BuyItemResult
        )
        return
      }

      await purchaseItemCatalogEntry({
        accessToken,
        accountId: payload.account.accountId,
        offerId: payload.offerId,
        purchasePrice: payload.price,
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopBuyItemNotification,
        {
          success: true,
          accountId: payload.account.accountId,
          itemName: payload.itemName,
          price: payload.price,
          isDryRun: false,
          errorMessage: null,
        } as BuyItemResult
      )
    } catch (error: any) {
      const responseData = error?.response?.data
      const rawError =
        responseData?.errorMessage ||
        responseData?.errorCode ||
        responseData?.message ||
        error?.message ||
        'Item purchase failed'

      const errorCode = String(responseData?.errorCode || '').toLowerCase()
      const errorMessage = String(responseData?.errorMessage || '').toLowerCase()
      const numericErrorCode = Number(responseData?.numericErrorCode)
      const rawCombined = `${rawError} ${errorCode} ${errorMessage}`.toLowerCase()

      console.error('[ItemShopCore] BuyItem error responseData:', {
        errorCode,
        numericErrorCode,
        errorMessage,
        rawError,
      })

      let friendlyMessage = String(rawError)

      if (
        numericErrorCode === 28004 ||
        rawCombined.includes('purchase_not_allowed') ||
        rawCombined.includes('already_owned') ||
        rawCombined.includes('already own') ||
        rawCombined.includes('owns') ||
        rawCombined.includes('item_already_owned')
      ) {
        friendlyMessage = `This account (${payload.account.displayName}) already owns ${payload.itemName}.`
      } else if (
        numericErrorCode === 28001 ||
        rawCombined.includes('insufficient_funds') ||
        rawCombined.includes('not_enough_funds') ||
        rawCombined.includes('not_enough_mtx') ||
        rawCombined.includes('insufficient_balance')
      ) {
        friendlyMessage = `Insufficient V-Bucks balance to purchase ${payload.itemName}.`
      }

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemShopBuyItemNotification,
        {
          success: false,
          accountId: payload.account.accountId,
          itemName: payload.itemName,
          price: payload.price,
          isDryRun: payload.isDryRun,
          errorMessage: friendlyMessage,
        } as BuyItemResult
      )
    }
  }
}
