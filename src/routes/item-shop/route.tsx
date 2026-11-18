import { createRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  Check,
  Gift,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'

import { useAccountListStore } from '../../state/accounts/list'
import type { AccountData } from '../../types/accounts'
import type {
  AccountGiftingInfo,
  EligibleFriend,
  SendGiftPayload,
  SendGiftResult,
  ShopItemEntry,
} from '../../types/item-shop'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/item-shop',
  component: ItemShopRouteComponent,
})

const GIFT_BOXES = [
  { id: 'GiftBox:gb_default', name: 'Classic Gold & Red' },
  { id: 'GiftBox:gb_makeitrain', name: 'Make It Rain Money Box' },
  { id: 'GiftBox:gb_hearts', name: 'Hearts & Love Box' },
  { id: 'GiftBox:gb_birthday', name: 'Birthday Confetti' },
]

export function ItemShopRouteComponent() {
  const { t } = useTranslation(['general'])
  const accountsRecord = useAccountListStore((state) => state.accounts)
  const accounts = useMemo(() => Object.values(accountsRecord), [accountsRecord])

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [catalogItems, setCatalogItems] = useState<Array<ShopItemEntry>>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Gifting info for currently selected account
  const [giftingInfo, setGiftingInfo] = useState<AccountGiftingInfo | null>(null)
  const [loadingGiftingInfo, setLoadingGiftingInfo] = useState(false)

  // Gifting Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ShopItemEntry | null>(null)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('')
  const [searchRecipient, setSearchRecipient] = useState<string>('')
  const [selectedGiftBox, setSelectedGiftBox] = useState<string>(GIFT_BOXES[0].id)
  const [customMessage, setCustomMessage] = useState<string>('Enjoy your gift!')
  const [sendingGift, setSendingGift] = useState(false)

  const currentAccount = useMemo(
    () => accounts.find((acc) => acc.accountId === selectedAccountId) || accounts[0],
    [accounts, selectedAccountId]
  )

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].accountId)
    }
  }, [accounts, selectedAccountId])

  // Fetch shop catalog
  const fetchCatalog = () => {
    setLoadingCatalog(true)
    window.electronAPI.getItemShopCatalog()
  }

  // Fetch gifting info for account
  const fetchGiftingInfo = (account?: AccountData) => {
    const target = account || currentAccount
    if (!target) return
    setLoadingGiftingInfo(true)
    window.electronAPI.getAccountGiftingInfo(target)
  }

  useEffect(() => {
    fetchCatalog()
  }, [])

  useEffect(() => {
    if (currentAccount) {
      fetchGiftingInfo(currentAccount)
    }
  }, [currentAccount?.accountId])

  // Setup IPC notifications
  useEffect(() => {
    const subCatalog = window.electronAPI.notificationItemShopCatalog(async (res) => {
      setLoadingCatalog(false)
      if (res.success && res.items) {
        setCatalogItems(res.items)
      } else {
        toast.error('Could not load Item Shop. Please try again.')
      }
    })

    const subGiftingInfo = window.electronAPI.notificationAccountGiftingInfo(async (info) => {
      setLoadingGiftingInfo(false)
      if (info.accountId === currentAccount?.accountId) {
        setGiftingInfo(info)
      }
    })

    const subSendGift = window.electronAPI.notificationSendGift(async (res: SendGiftResult) => {
      setSendingGift(false)
      if (res.success) {
        toast.success(`Successfully gifted ${res.itemName} to ${res.receiverDisplayName}!`)
        setIsModalOpen(false)
        if (currentAccount) fetchGiftingInfo(currentAccount)
      } else {
        toast.error(`Gifting failed: ${res.errorMessage || 'Please check V-Bucks or daily limit'}`)
      }
    })

    return () => {
      subCatalog.removeListener()
      subGiftingInfo.removeListener()
      subSendGift.removeListener()
    }
  }, [currentAccount])

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>(['All'])
    catalogItems.forEach((i) => {
      if (i.category) set.add(i.category)
    })
    return Array.from(set)
  }, [catalogItems])

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [catalogItems, selectedCategory, searchQuery])

  // Selected recipient friend
  const selectedFriend = useMemo(() => {
    return giftingInfo?.eligibleFriends.find((f) => f.accountId === selectedRecipientId) || null
  }, [giftingInfo?.eligibleFriends, selectedRecipientId])

  // Filtered friends for modal
  const filteredFriends = useMemo(() => {
    if (!giftingInfo?.eligibleFriends) return []
    if (!searchRecipient.trim()) return giftingInfo.eligibleFriends
    const q = searchRecipient.toLowerCase()
    return giftingInfo.eligibleFriends.filter(
      (f) => f.displayName.toLowerCase().includes(q) || f.accountId.toLowerCase().includes(q)
    )
  }, [giftingInfo?.eligibleFriends, searchRecipient])

  const openGiftModal = (item: ShopItemEntry) => {
    setSelectedItem(item)
    setSelectedRecipientId(giftingInfo?.eligibleFriends[0]?.accountId || '')
    setIsModalOpen(true)
  }

  const handleSendGiftSubmit = () => {
    if (!currentAccount || !selectedItem || !selectedFriend) return

    if (giftingInfo && giftingInfo.vbucks < selectedItem.price) {
      toast.error('Insufficient V-Bucks balance on this account!')
      return
    }

    if (giftingInfo && giftingInfo.giftsRemainingToday <= 0) {
      toast.error('You have reached the 5 daily gift limit on this account.')
      return
    }

    setSendingGift(true)
    const payload: SendGiftPayload = {
      account: currentAccount,
      offerId: selectedItem.offerId,
      receiverAccountId: selectedFriend.accountId,
      receiverDisplayName: selectedFriend.displayName,
      itemName: selectedItem.name,
      price: selectedItem.price,
      giftWrapTemplateId: selectedGiftBox,
      personalMessage: customMessage.trim() || 'Enjoy your gift!',
    }

    window.electronAPI.sendGift(payload)
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <HomeBreadcrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Item Shop & Direct Gifting</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header & Gifter Account Info Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between pb-3 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="size-6 text-primary" />
            Fortnite Item Shop & Direct Gifting
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse today's rotating Item Shop cosmetics and dispatch gifts directly to friends without opening Fortnite.
          </p>
        </div>

        {/* Selected Gifter Account Summary Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border">
            <User className="size-4 text-muted-foreground" />
            <select
              value={currentAccount?.accountId || ''}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-transparent text-sm font-semibold focus:outline-none cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.accountId} value={acc.accountId} className="bg-popover text-popover-foreground">
                  {acc.customDisplayName || acc.displayName}
                </option>
              ))}
            </select>

            <span className="text-muted-foreground">|</span>

            {/* V-Bucks Balance */}
            <div className="flex items-center gap-1 text-sm font-bold text-blue-500">
              <span>{giftingInfo ? giftingInfo.vbucks.toLocaleString() : '...'}</span>
              <span className="text-xs uppercase">VB</span>
            </div>

            <span className="text-muted-foreground">|</span>

            {/* Daily Gift Slots */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Slots:</span>
              <span className="font-semibold">
                {giftingInfo ? `${giftingInfo.giftsRemainingToday}/5` : '...'}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchCatalog()
              fetchGiftingInfo()
            }}
            disabled={loadingCatalog || loadingGiftingInfo}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`size-4 ${loadingCatalog || loadingGiftingInfo ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.slice(0, 6).map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat)}
              className="text-xs shrink-0"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search cosmetics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Shop Grid */}
      {loadingCatalog ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="font-medium">Loading live Fortnite Item Shop...</span>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground gap-1">
          <Gift className="size-10 opacity-30 mb-2" />
          <span className="font-semibold text-base">No items match your filter</span>
          <span className="text-xs">Try selecting a different category or clearing your search.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filteredCatalog.map((item) => {
            const hasEnoughVBucks = giftingInfo ? giftingInfo.vbucks >= item.price : true
            const imageSrc = item.images.featured || item.images.icon

            return (
              <Card
                key={item.id}
                className="overflow-hidden flex flex-col justify-between group hover:border-primary/50 transition-all shadow-sm bg-card"
              >
                <div>
                  {/* Cosmetic Image Container */}
                  <div className="relative aspect-square w-full bg-muted/40 overflow-hidden flex items-center justify-center">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={item.name}
                        className="object-contain w-full h-full p-2 group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <Sparkles className="size-10 text-muted-foreground/30" />
                    )}

                    {/* Banner / Category Tag */}
                    {item.banner && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold uppercase">
                          {item.banner}
                        </Badge>
                      </div>
                    )}

                    {/* Rarity Tag */}
                    <div className="absolute bottom-2 left-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                        {item.rarity}
                      </span>
                    </div>
                  </div>

                  {/* Title & Price */}
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm font-semibold truncate" title={item.name}>
                      {item.name}
                    </CardTitle>
                    <CardDescription className="text-xs truncate" title={item.description}>
                      {item.type}
                    </CardDescription>
                  </CardHeader>
                </div>

                <CardFooter className="p-3 pt-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1 font-bold text-sm text-blue-500">
                      <span>{item.price.toLocaleString()}</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">VB</span>
                    </div>

                    {!hasEnoughVBucks && (
                      <span className="text-[10px] text-destructive font-medium">Need VB</span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="w-full text-xs font-semibold flex items-center gap-1.5"
                    disabled={!item.giftable}
                    onClick={() => openGiftModal(item)}
                  >
                    <Gift className="size-3.5" />
                    Gift Item
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* GIFTING MODAL DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="size-5 text-primary" />
              Gift Cosmetic
            </DialogTitle>
            <DialogDescription>
              Dispatch this cosmetic straight to your friend's Fortnite locker.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="flex flex-col gap-4 py-2">
              {/* Item Info Box */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
                <div className="size-16 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border">
                  {selectedItem.images.icon ? (
                    <img src={selectedItem.images.icon} alt={selectedItem.name} className="size-full object-contain" />
                  ) : (
                    <Sparkles className="size-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="font-bold text-base truncate">{selectedItem.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedItem.rarity} · {selectedItem.type}</span>
                  <div className="flex items-center gap-1 mt-1 text-sm font-bold text-blue-500">
                    <span>{selectedItem.price.toLocaleString()} V-Bucks</span>
                  </div>
                </div>
              </div>

              {/* Gifter Account Confirmation */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Gifter Account:</span>
                <span className="font-semibold">{currentAccount?.customDisplayName || currentAccount?.displayName}</span>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Remaining Balance After:</span>
                <span className="font-semibold text-blue-500">
                  {giftingInfo ? (giftingInfo.vbucks - selectedItem.price).toLocaleString() : '...'} V-Bucks
                </span>
              </div>

              {/* Recipient Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center justify-between">
                  <span>Select Recipient Friend</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {giftingInfo?.eligibleFriends.length || 0} friends loaded
                  </span>
                </label>

                {/* Recipient search */}
                <Input
                  placeholder="Filter friends by name..."
                  value={searchRecipient}
                  onChange={(e) => setSearchRecipient(e.target.value)}
                  className="h-8 text-xs mb-1"
                />

                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="h-10 px-3 rounded-md border bg-background text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {filteredFriends.map((f) => (
                    <option key={f.accountId} value={f.accountId}>
                      {f.displayName} {f.isEligible48h ? '✓ (48h Ready)' : `(Needs ${f.hoursRemaining}h)`}
                    </option>
                  ))}
                </select>

                {/* 48h Eligibility Indicator */}
                {selectedFriend && (
                  <div className="mt-1">
                    {selectedFriend.isEligible48h ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-500/10 px-2.5 py-1.5 rounded border border-green-500/20 font-medium">
                        <ShieldCheck className="size-4 shrink-0" />
                        <span>Eligible: Friends for over 48 hours. Ready to receive gift!</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600 bg-yellow-500/10 px-2.5 py-1.5 rounded border border-yellow-500/20 font-medium">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>
                          Cooldown active: Epic Games requires {selectedFriend.hoursRemaining} more hours of friendship before this user can receive gifts.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Gift Box Style */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Gift Wrap Box</label>
                <select
                  value={selectedGiftBox}
                  onChange={(e) => setSelectedGiftBox(e.target.value)}
                  className="h-9 px-3 rounded-md border bg-background text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {GIFT_BOXES.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Personalized Message */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Personalized Gift Message</label>
                <Input
                  placeholder="e.g. Enjoy your skin! - From Trimzy"
                  value={customMessage}
                  maxLength={100}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={sendingGift}>
              Cancel
            </Button>
            <Button
              onClick={handleSendGiftSubmit}
              disabled={
                sendingGift ||
                !selectedFriend ||
                !selectedFriend.isEligible48h ||
                (giftingInfo !== null && giftingInfo.vbucks < (selectedItem?.price || 0))
              }
              className="flex items-center gap-2 bg-primary"
            >
              {sendingGift ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Confirm & Send Gift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
