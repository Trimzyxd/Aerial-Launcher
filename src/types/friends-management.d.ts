export type FriendUser = {
  accountId: string
  displayName: string
  status: string
  created: string
  favorite?: boolean
}

export type FriendsSummaryData = {
  accountId: string
  displayName: string
  friends: Array<FriendUser>
  incoming: Array<FriendUser>
  outgoing: Array<FriendUser>
  blocklist: Array<FriendUser>
}

export type FriendsActionResult = {
  success: boolean
  accountId: string
  friendId?: string
  displayName?: string
  errorMessage?: string | null
}

export type BulkAcceptResult = {
  success: boolean
  totalAccepted: number
  results: Array<{
    accountId: string
    displayName: string
    acceptedCount: number
  }>
}

export type BulkSendResult = {
  success: boolean
  targetDisplayName: string
  targetAccountId: string
  results: Array<{
    accountId: string
    displayName: string
    success: boolean
    errorMessage?: string | null
  }>
}
