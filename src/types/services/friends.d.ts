export type FetchFriendResponse = {
  accountId: string
  groups: Array<unknown>
  alias: string
  note: string
  favorite: boolean
  created: string
}

export type FriendSummaryItem = {
  accountId: string
  status: string
  created: string
  favorite?: boolean
}

export type FriendsSummaryResponse = {
  friends: Array<FriendSummaryItem>
  incoming: Array<FriendSummaryItem>
  outgoing: Array<FriendSummaryItem>
  blocklist: Array<FriendSummaryItem>
}
