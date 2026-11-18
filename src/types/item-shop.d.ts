import type { AccountData } from './accounts'

export type ShopItemEntry = {
  id: string
  name: string
  description: string
  type: string
  rarity: string
  rarityColor?: string
  price: number
  regularPrice: number
  banner?: string
  category: string
  offerId: string
  giftable: boolean
  images: {
    icon?: string
    featured?: string
    background?: string
  }
}

export type EligibleFriend = {
  accountId: string
  displayName: string
  created: string
  isEligible48h: boolean
  hoursRemaining: number
}

export type AccountGiftingInfo = {
  accountId: string
  displayName: string
  vbucks: number
  canSendGifts: boolean
  giftsRemainingToday: number
  eligibleFriends: Array<EligibleFriend>
}

export type SendGiftPayload = {
  account: AccountData
  offerId: string
  receiverAccountId: string
  receiverDisplayName: string
  itemName: string
  price: number
  giftWrapTemplateId: string
  personalMessage: string
  isDryRun?: boolean
}

export type SendGiftResult = {
  success: boolean
  accountId: string
  receiverAccountId: string
  receiverDisplayName: string
  itemName: string
  price: number
  isDryRun?: boolean
  errorMessage?: string | null
}
