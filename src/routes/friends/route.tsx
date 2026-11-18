import { createRoute } from '@tanstack/react-router'
import {
  Check,
  CheckCheck,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Route as RootRoute } from '../__root'

import { HomeBreadcrumb } from '../../components/navigations/breadcrumb/home'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../components/ui/breadcrumb'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs'

import { useAccountListStore } from '../../state/accounts/list'
import type { AccountData } from '../../types/accounts'
import type {
  BulkAcceptResult,
  BulkSendResult,
  FriendsActionResult,
  FriendsSummaryData,
  FriendUser,
} from '../../types/friends-management'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/friends',
  component: FriendsRouteComponent,
})

export function FriendsRouteComponent() {
  const { t } = useTranslation(['general'])
  const accountsRecord = useAccountListStore((state) => state.accounts)
  const accounts = useMemo(() => Object.values(accountsRecord), [accountsRecord])

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'incoming' | 'friends' | 'outgoing' | 'add' | 'bulk'>('incoming')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Current account's summary
  const [summary, setSummary] = useState<FriendsSummaryData | null>(null)

  // Filters & Inputs
  const [searchFriend, setSearchFriend] = useState('')
  const [addDisplayName, setAddDisplayName] = useState('')
  const [bulkDisplayName, setBulkDisplayName] = useState('')

  // Selected single account
  const currentAccount = useMemo(
    () => accounts.find((acc) => acc.accountId === selectedAccountId) || accounts[0],
    [accounts, selectedAccountId]
  )

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].accountId)
    }
  }, [accounts, selectedAccountId])

  // Fetch summary when account changes
  const fetchSummary = (account?: AccountData) => {
    const target = account || currentAccount
    if (!target) return

    setLoadingSummary(true)
    window.electronAPI.getFriendsSummary(target)
  }

  useEffect(() => {
    if (currentAccount) {
      fetchSummary(currentAccount)
    }
  }, [currentAccount?.accountId])

  // Setup IPC notification listeners
  useEffect(() => {
    const subSummary = window.electronAPI.notificationFriendsSummary(async (data) => {
      if (data.accountId === currentAccount?.accountId) {
        setSummary(data)
        setLoadingSummary(false)
      }
    })

    const subAccept = window.electronAPI.notificationAcceptFriendRequest(async (res: FriendsActionResult) => {
      setActionLoading(null)
      if (res.success) {
        toast.success('Friend request accepted!')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Failed to accept: ${res.errorMessage || 'Unknown error'}`)
      }
    })

    const subReject = window.electronAPI.notificationRejectFriendRequest(async (res: FriendsActionResult) => {
      setActionLoading(null)
      if (res.success) {
        toast.success('Friend request rejected/cancelled')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Failed: ${res.errorMessage || 'Unknown error'}`)
      }
    })

    const subSend = window.electronAPI.notificationSendFriendRequest(async (res: FriendsActionResult) => {
      setActionLoading(null)
      if (res.success) {
        toast.success(`Friend request sent to ${res.displayName || 'user'}!`)
        setAddDisplayName('')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Could not send request: ${res.errorMessage || 'User not found'}`)
      }
    })

    const subRemove = window.electronAPI.notificationRemoveFriendRecord(async (res: FriendsActionResult) => {
      setActionLoading(null)
      if (res.success) {
        toast.success('Friend removed')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Failed to remove friend: ${res.errorMessage || 'Unknown error'}`)
      }
    })

    const subBulkAccept = window.electronAPI.notificationBulkAccept(async (res: BulkAcceptResult) => {
      setBulkLoading(false)
      toast.success(`Bulk accept complete: accepted ${res.totalAccepted} requests across accounts!`)
      if (currentAccount) fetchSummary(currentAccount)
    })

    const subBulkSend = window.electronAPI.notificationBulkSend(async (res: BulkSendResult) => {
      setBulkLoading(false)
      if (res.success) {
        const successes = res.results.filter((r) => r.success).length
        toast.success(`Friend request sent from ${successes}/${res.results.length} accounts to ${res.targetDisplayName}!`)
        setBulkDisplayName('')
      } else {
        toast.error(`Bulk send failed: target user ${res.targetDisplayName} was not found.`)
      }
    })

    return () => {
      subSummary.removeListener()
      subAccept.removeListener()
      subReject.removeListener()
      subSend.removeListener()
      subRemove.removeListener()
      subBulkAccept.removeListener()
      subBulkSend.removeListener()
    }
  }, [currentAccount])

  // Actions
  const handleAccept = (friendId: string) => {
    if (!currentAccount) return
    setActionLoading(friendId)
    window.electronAPI.acceptFriendRequest(currentAccount, friendId)
  }

  const handleReject = (friendId: string) => {
    if (!currentAccount) return
    setActionLoading(friendId)
    window.electronAPI.rejectFriendRequest(currentAccount, friendId)
  }

  const handleRemoveFriend = (friendId: string) => {
    if (!currentAccount) return
    setActionLoading(friendId)
    window.electronAPI.removeFriendRecord(currentAccount, friendId)
  }

  const handleSendFriendRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentAccount || !addDisplayName.trim()) return
    setActionLoading('add-friend')
    window.electronAPI.sendFriendRequest(currentAccount, addDisplayName.trim())
  }

  const handleBulkAcceptAll = () => {
    if (accounts.length === 0) return
    setBulkLoading(true)
    window.electronAPI.bulkAcceptIncoming(accounts)
  }

  const handleBulkSendAll = (e: React.FormEvent) => {
    e.preventDefault()
    if (accounts.length === 0 || !bulkDisplayName.trim()) return
    setBulkLoading(true)
    window.electronAPI.bulkSendFriendRequest(accounts, bulkDisplayName.trim())
  }

  // Filtered friends
  const filteredFriends = useMemo(() => {
    if (!summary?.friends) return []
    if (!searchFriend.trim()) return summary.friends
    const q = searchFriend.toLowerCase()
    return summary.friends.filter(
      (f) => f.displayName.toLowerCase().includes(q) || f.accountId.toLowerCase().includes(q)
    )
  }, [summary?.friends, searchFriend])

  const incomingCount = summary?.incoming?.length || 0
  const outgoingCount = summary?.outgoing?.length || 0
  const friendsCount = summary?.friends?.length || 0

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <HomeBreadcrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Friends Management</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Friends & Requests</h1>
          <p className="text-sm text-muted-foreground">
            Manage incoming/outgoing Epic Games friend requests and your active friends list per account.
          </p>
        </div>

        {/* Account Switcher & Refresh */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={currentAccount?.accountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-9 px-3 rounded-md border bg-background text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {accounts.map((acc) => (
              <option key={acc.accountId} value={acc.accountId}>
                {acc.customDisplayName || acc.displayName}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummary()}
            disabled={loadingSummary}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`size-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="incoming" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <UserPlus className="size-4" />
            <span>Incoming</span>
            {incomingCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                {incomingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="friends" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Users className="size-4" />
            <span>Friends ({friendsCount})</span>
          </TabsTrigger>

          <TabsTrigger value="outgoing" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Clock className="size-4" />
            <span>Sent ({outgoingCount})</span>
          </TabsTrigger>

          <TabsTrigger value="add" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <UserCheck className="size-4" />
            <span>Add Friend</span>
          </TabsTrigger>

          <TabsTrigger value="bulk" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <CheckCheck className="size-4" />
            <span>Bulk / All</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INCOMING REQUESTS */}
        <TabsContent value="incoming" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg">Incoming Friend Requests</CardTitle>
                <CardDescription>
                  People waiting for {currentAccount?.customDisplayName || currentAccount?.displayName} to accept them.
                </CardDescription>
              </div>

              {incomingCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    summary?.incoming.forEach((req) => handleAccept(req.accountId))
                  }}
                  disabled={actionLoading !== null}
                >
                  Accept All on this Account
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin" />
                  <span>Loading friend requests from Epic Games...</span>
                </div>
              ) : incomingCount === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-1">
                  <UserPlus className="size-8 opacity-40 mb-1" />
                  <span className="font-medium">No pending incoming friend requests</span>
                  <span className="text-xs">Incoming requests from customers and friends will appear here.</span>
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {summary?.incoming.map((req) => (
                    <div key={req.accountId} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{req.displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{req.accountId}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          disabled={actionLoading === req.accountId}
                          onClick={() => handleAccept(req.accountId)}
                        >
                          {actionLoading === req.accountId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Accept
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-1.5 text-destructive hover:bg-destructive/10"
                          disabled={actionLoading === req.accountId}
                          onClick={() => handleReject(req.accountId)}
                        >
                          <X className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ACTIVE FRIENDS */}
        <TabsContent value="friends" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-lg">Friends List ({friendsCount})</CardTitle>
                <CardDescription>
                  Active friends on {currentAccount?.customDisplayName || currentAccount?.displayName}
                </CardDescription>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search friends..."
                  value={searchFriend}
                  onChange={(e) => setSearchFriend(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin" />
                  <span>Loading friends list...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-1">
                  <Users className="size-8 opacity-40 mb-1" />
                  <span className="font-medium">
                    {searchFriend ? 'No friends match your search' : 'No friends on this account'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.accountId}
                      className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col overflow-hidden mr-2">
                        <span className="font-medium text-sm truncate">{friend.displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono truncate">{friend.accountId}</span>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove Friend"
                        disabled={actionLoading === friend.accountId}
                        onClick={() => {
                          if (confirm(`Remove ${friend.displayName} from friends?`)) {
                            handleRemoveFriend(friend.accountId)
                          }
                        }}
                      >
                        {actionLoading === friend.accountId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: OUTGOING SENT REQUESTS */}
        <TabsContent value="outgoing" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Sent Friend Requests ({outgoingCount})</CardTitle>
              <CardDescription>
                Friend requests sent by {currentAccount?.customDisplayName || currentAccount?.displayName} waiting for acceptance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin" />
                  <span>Loading sent requests...</span>
                </div>
              ) : outgoingCount === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-1">
                  <Clock className="size-8 opacity-40 mb-1" />
                  <span className="font-medium">No pending sent requests</span>
                  <span className="text-xs">Requests you send to others will appear here until they accept.</span>
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {summary?.outgoing.map((req) => (
                    <div key={req.accountId} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{req.displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{req.accountId}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground hover:text-destructive text-xs"
                        disabled={actionLoading === req.accountId}
                        onClick={() => handleReject(req.accountId)}
                      >
                        Cancel Request
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ADD FRIEND */}
        <TabsContent value="add" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="text-lg">Send Friend Request</CardTitle>
              <CardDescription>
                Send a friend request from <strong>{currentAccount?.customDisplayName || currentAccount?.displayName}</strong> to an Epic Games user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendFriendRequest} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Epic Games Display Name or Account ID</label>
                  <Input
                    placeholder="e.g. Ninja or accountId"
                    value={addDisplayName}
                    onChange={(e) => setAddDisplayName(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={actionLoading === 'add-friend' || !addDisplayName.trim()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {actionLoading === 'add-friend' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Send Friend Request
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: BULK / ALL ACCOUNTS */}
        <TabsContent value="bulk" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Bulk Accept Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Accept All Requests Across All Accounts</CardTitle>
                <CardDescription>
                  Automatically scan every connected account ({accounts.length} accounts) and accept all pending incoming friend requests in one click.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-md border p-3 bg-muted/30 text-xs text-muted-foreground">
                  Ideal when customers add your gifter accounts: click this button once to accept incoming requests across all accounts and immediately start their 48-hour gifting cooldown.
                </div>

                <Button
                  onClick={handleBulkAcceptAll}
                  disabled={bulkLoading || accounts.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {bulkLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCheck className="size-4" />
                  )}
                  Accept All Incoming on All {accounts.length} Accounts
                </Button>
              </CardContent>
            </Card>

            {/* Bulk Send Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add User on All Accounts</CardTitle>
                <CardDescription>
                  Send a friend request to a customer or friend from every logged-in account at once.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBulkSendAll} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Target Epic Display Name or ID</label>
                    <Input
                      placeholder="e.g. BuyerEpicUsername"
                      value={bulkDisplayName}
                      onChange={(e) => setBulkDisplayName(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={bulkLoading || !bulkDisplayName.trim() || accounts.length === 0}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {bulkLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserCheck className="size-4" />
                    )}
                    Send Request From All {accounts.length} Accounts
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
