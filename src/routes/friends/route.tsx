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
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
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
} from '../../types/friends-management'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/friends',
  component: FriendsRouteComponent,
})

export function FriendsRouteComponent() {
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
        toast.success('Request removed')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Failed: ${res.errorMessage || 'Unknown error'}`)
      }
    })

    const subSend = window.electronAPI.notificationSendFriendRequest(async (res: FriendsActionResult) => {
      setActionLoading(null)
      if (res.success) {
        toast.success(`Request sent to ${res.displayName || 'user'}!`)
        setAddDisplayName('')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Could not send: ${res.errorMessage || 'User not found'}`)
      }
    })

    const subRemove = window.electronAPI.notificationRemoveFriendRecord(async (res: FriendsActionResult) => {
      setActionLoading(null)
      if (res.success) {
        toast.success('Friend removed')
        if (currentAccount) fetchSummary(currentAccount)
      } else {
        toast.error(`Failed: ${res.errorMessage || 'Unknown error'}`)
      }
    })

    const subBulkAccept = window.electronAPI.notificationBulkAccept(async (res: BulkAcceptResult) => {
      setBulkLoading(false)
      toast.success(`Accepted ${res.totalAccepted} requests across all accounts!`)
      if (currentAccount) fetchSummary(currentAccount)
    })

    const subBulkSend = window.electronAPI.notificationBulkSend(async (res: BulkSendResult) => {
      setBulkLoading(false)
      if (res.success) {
        const successes = res.results.filter((r) => r.success).length
        toast.success(`Request sent from ${successes}/${res.results.length} accounts to ${res.targetDisplayName}!`)
        setBulkDisplayName('')
      } else {
        toast.error(`User ${res.targetDisplayName} not found.`)
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
    <div className="flex flex-col gap-4 w-full">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <HomeBreadcrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Friends</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b">
        <h1 className="text-xl font-bold tracking-tight">Friends & Requests</h1>

        {/* Account Switcher & Refresh */}
        <div className="flex items-center gap-2">
          <select
            value={currentAccount?.accountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-8 px-2.5 rounded-md border bg-background text-xs font-medium focus:outline-none"
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
            className="h-8 px-2.5 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-xl h-8">
          <TabsTrigger value="incoming" className="flex items-center gap-1 text-xs">
            <UserPlus className="size-3.5" />
            <span>Incoming</span>
            {incomingCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1 py-0 text-[10px] leading-tight">
                {incomingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="friends" className="flex items-center gap-1 text-xs">
            <Users className="size-3.5" />
            <span>Friends ({friendsCount})</span>
          </TabsTrigger>

          <TabsTrigger value="outgoing" className="flex items-center gap-1 text-xs">
            <Clock className="size-3.5" />
            <span>Sent ({outgoingCount})</span>
          </TabsTrigger>

          <TabsTrigger value="add" className="flex items-center gap-1 text-xs">
            <UserCheck className="size-3.5" />
            <span>Add</span>
          </TabsTrigger>

          <TabsTrigger value="bulk" className="flex items-center gap-1 text-xs">
            <CheckCheck className="size-3.5" />
            <span>Bulk</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INCOMING REQUESTS */}
        <TabsContent value="incoming" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
              <CardTitle className="text-sm font-semibold">
                Incoming Requests ({incomingCount})
              </CardTitle>

              {incomingCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => {
                    summary?.incoming.forEach((req) => handleAccept(req.accountId))
                  }}
                  disabled={actionLoading !== null}
                >
                  Accept All on this Account
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingSummary ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground gap-2 text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading requests...</span>
                </div>
              ) : incomingCount === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs">
                  <UserPlus className="size-6 opacity-30 mb-1" />
                  <span>No pending incoming requests</span>
                </div>
              ) : (
                <div className="divide-y rounded border text-xs">
                  {summary?.incoming.map((req) => (
                    <div key={req.accountId} className="flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors">
                      <div className="flex flex-col truncate mr-2">
                        <span className="font-semibold text-xs truncate">{req.displayName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{req.accountId}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                          disabled={actionLoading === req.accountId}
                          onClick={() => handleAccept(req.accountId)}
                        >
                          {actionLoading === req.accountId ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Accept
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                          disabled={actionLoading === req.accountId}
                          onClick={() => handleReject(req.accountId)}
                        >
                          <X className="size-3" />
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
        <TabsContent value="friends" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 py-3 px-4">
              <CardTitle className="text-sm font-semibold">
                Friends ({friendsCount})
              </CardTitle>

              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchFriend}
                  onChange={(e) => setSearchFriend(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingSummary ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground gap-2 text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading friends...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs">
                  <Users className="size-6 opacity-30 mb-1" />
                  <span>{searchFriend ? 'No matching friends' : 'No friends found'}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.accountId}
                      className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col overflow-hidden mr-2">
                        <span className="font-medium text-xs truncate">{friend.displayName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{friend.accountId}</span>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                        title="Remove Friend"
                        disabled={actionLoading === friend.accountId}
                        onClick={() => {
                          if (confirm(`Remove ${friend.displayName}?`)) {
                            handleRemoveFriend(friend.accountId)
                          }
                        }}
                      >
                        {actionLoading === friend.accountId ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
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
        <TabsContent value="outgoing" className="mt-3">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold">Sent Requests ({outgoingCount})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingSummary ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground gap-2 text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading sent requests...</span>
                </div>
              ) : outgoingCount === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs">
                  <Clock className="size-6 opacity-30 mb-1" />
                  <span>No pending sent requests</span>
                </div>
              ) : (
                <div className="divide-y rounded border text-xs">
                  {summary?.outgoing.map((req) => (
                    <div key={req.accountId} className="flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors">
                      <div className="flex flex-col truncate mr-2">
                        <span className="font-semibold text-xs truncate">{req.displayName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{req.accountId}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        disabled={actionLoading === req.accountId}
                        onClick={() => handleReject(req.accountId)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ADD FRIEND */}
        <TabsContent value="add" className="mt-3">
          <Card className="max-w-md">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold">Send Friend Request</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form onSubmit={handleSendFriendRequest} className="flex flex-col gap-3">
                <Input
                  placeholder="Epic Display Name or Account ID"
                  value={addDisplayName}
                  onChange={(e) => setAddDisplayName(e.target.value)}
                  className="h-8 text-xs"
                  required
                />

                <Button
                  type="submit"
                  disabled={actionLoading === 'add-friend' || !addDisplayName.trim()}
                  className="w-full h-8 text-xs flex items-center justify-center gap-1.5"
                >
                  {actionLoading === 'add-friend' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  Send Request
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: BULK / ALL ACCOUNTS */}
        <TabsContent value="bulk" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bulk Accept Card */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Accept Incoming (All Accounts)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Button
                  onClick={handleBulkAcceptAll}
                  disabled={bulkLoading || accounts.length === 0}
                  className="w-full h-9 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  {bulkLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="size-3.5" />
                  )}
                  <span>Accept All Incoming ({accounts.length} Accounts)</span>
                </Button>
              </CardContent>
            </Card>

            {/* Bulk Send Card */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Send Request (All Accounts)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <form onSubmit={handleBulkSendAll} className="flex flex-col gap-2.5">
                  <Input
                    placeholder="Epic Display Name or ID"
                    value={bulkDisplayName}
                    onChange={(e) => setBulkDisplayName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />

                  <Button
                    type="submit"
                    disabled={bulkLoading || !bulkDisplayName.trim() || accounts.length === 0}
                    className="w-full h-9 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    {bulkLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="size-3.5" />
                    )}
                    <span>Send From All {accounts.length} Accounts</span>
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
