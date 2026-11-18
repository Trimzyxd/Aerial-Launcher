import { createRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Route as RootRoute } from '../__root'

import { AccountCombobox } from '../../components/selectors/account-combobox'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandListWithScrollArea,
} from '../../components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'

import { useAccountListStore } from '../../state/accounts/list'
import { cn } from '../../lib/utils'
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

function CategoryScrollPills({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: string[]
  selectedCategory: string
  onSelectCategory: (cat: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    const resizeObserver = new ResizeObserver(checkScroll)
    resizeObserver.observe(el)
    el.addEventListener('scroll', checkScroll, { passive: true })
    return () => {
      resizeObserver.disconnect()
      el.removeEventListener('scroll', checkScroll)
    }
  }, [categories, checkScroll])

  const handleScrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div className="relative flex items-center min-w-0 flex-1 group">
      {/* Left Scroll Chevron with Fade Gradient */}
      {canScrollLeft && (
        <div className="absolute left-0 z-10 flex items-center pr-2 bg-gradient-to-r from-background via-background/90 to-transparent h-full">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleScrollBy(-180)}
            className="size-7 rounded-full bg-background/90 hover:bg-accent shadow-sm border"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Pill Row */}
      <div
        ref={scrollRef}
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY
          }
        }}
        className="flex items-center gap-1.5 overflow-x-auto min-w-0 w-full no-scrollbar py-1 scroll-smooth"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat
          return (
            <Button
              key={cat}
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              onClick={() => onSelectCategory(cat)}
              className={cn(
                'text-xs shrink-0 h-8 whitespace-nowrap transition-all duration-150',
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              {cat}
            </Button>
          )
        })}
      </div>

      {/* Right Scroll Chevron with Fade Gradient */}
      {canScrollRight && (
        <div className="absolute right-0 z-10 flex items-center pl-2 bg-gradient-to-l from-background via-background/90 to-transparent h-full">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleScrollBy(180)}
            className="size-7 rounded-full bg-background/90 hover:bg-accent shadow-sm border"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

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
  const [friendPopoverOpen, setFriendPopoverOpen] = useState(false)
  const [selectedGiftBox, setSelectedGiftBox] = useState<string>(GIFT_BOXES[0].id)
  const [customMessage, setCustomMessage] = useState<string>('Enjoy your gift!')
  const [safeTestMode, setSafeTestMode] = useState<boolean>(true)
  const [sendingGift, setSendingGift] = useState(false)

  // Buy Modal State
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false)
  const [buyingItem, setBuyingItem] = useState(false)
  const [buySafeTestMode, setBuySafeTestMode] = useState<boolean>(true)

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
        if (res.isDryRun) {
          toast.success(
            `Safe Test Passed! (0 V-Bucks used) Eligible to gift ${res.itemName} to ${res.receiverDisplayName}.`,
            { duration: 5000 }
          )
        } else {
          toast.success(`Successfully gifted ${res.itemName} to ${res.receiverDisplayName}!`)
        }
        setIsModalOpen(false)
        if (currentAccount) fetchGiftingInfo(currentAccount)
      } else {
        toast.error(`Gifting failed: ${res.errorMessage || 'Please check V-Bucks or daily limit'}`)
      }
    })

    const subBuyItem = window.electronAPI.notificationBuyItem(async (res: BuyItemResult) => {
      setBuyingItem(false)
      if (res.success) {
        if (res.isDryRun) {
          toast.success(
            `Safe Test Passed! (0 V-Bucks used) Ready to purchase ${res.itemName} for ${res.price} VB.`,
            { duration: 5000 }
          )
        } else {
          toast.success(`Successfully purchased ${res.itemName} on this account!`)
        }
        setIsBuyModalOpen(false)
        if (currentAccount) fetchGiftingInfo(currentAccount)
      } else {
        toast.error(`Purchase failed: ${res.errorMessage || 'Please check V-Bucks balance'}`)
      }
    })

    return () => {
      subCatalog.removeListener()
      subGiftingInfo.removeListener()
      subSendGift.removeListener()
      subBuyItem.removeListener()
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

  const openBuyModal = (item: ShopItemEntry) => {
    setSelectedItem(item)
    setIsBuyModalOpen(true)
  }

  const handleBuyItemSubmit = () => {
    if (!currentAccount || !selectedItem) return

    if (!buySafeTestMode && giftingInfo && giftingInfo.vbucks < selectedItem.price) {
      toast.error('Insufficient V-Bucks balance on this account!')
      return
    }

    setBuyingItem(true)
    const payload: BuyItemPayload = {
      account: currentAccount,
      offerId: selectedItem.offerId,
      itemName: selectedItem.name,
      price: selectedItem.price,
      isDryRun: buySafeTestMode,
    }

    window.electronAPI.buyItem(payload)
  }

  const handleSendGiftSubmit = () => {
    if (!currentAccount || !selectedItem || !selectedFriend) return

    if (!safeTestMode && giftingInfo && giftingInfo.vbucks < selectedItem.price) {
      toast.error('Insufficient V-Bucks balance on this account!')
      return
    }

    if (!safeTestMode && giftingInfo && giftingInfo.giftsRemainingToday <= 0) {
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
      isDryRun: safeTestMode,
    }

    window.electronAPI.sendGift(payload)
  }

  return (
    <div className="flex flex-col gap-4 w-full min-w-0 overflow-x-hidden">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <HomeBreadcrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Item Shop</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header & Gifter Account Info Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b w-full min-w-0">
        <h1 className="text-xl font-bold tracking-tight shrink-0">Fortnite Item Shop & Gifting</h1>

        {/* Selected Gifter Account Summary Pill */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <AccountCombobox
            accounts={accounts}
            selectedAccountId={currentAccount?.accountId}
            onSelectAccount={(accId) => setSelectedAccountId(accId)}
            triggerClassName="w-40 sm:w-44"
          />

          <div className="flex items-center gap-2 bg-muted/60 px-2.5 py-1 rounded-md border text-xs h-8 shrink-0">
            {/* V-Bucks Balance */}
            <div className="flex items-center gap-1 font-bold text-blue-500">
              <span>{giftingInfo ? giftingInfo.vbucks.toLocaleString() : '...'}</span>
              <span className="uppercase text-[10px]">VB</span>
            </div>

            <span className="text-muted-foreground">|</span>

            {/* Daily Gift Slots */}
            <div className="flex items-center gap-1">
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
            className="h-8 px-2.5 text-xs flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`size-3.5 ${loadingCatalog || loadingGiftingInfo ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 min-w-0 w-full">
        {/* Category Tabs: Smooth scroll with chevron controls & zero native scrollbar */}
        <CategoryScrollPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
        />

        {/* Search */}
        <div className="relative w-full md:w-56 shrink-0 min-w-0">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search cosmetics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs w-full"
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 w-full min-w-0 max-w-full">
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
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
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

                  {/* 2 Buttons: 1st Gray Buy Item, 2nd White Gift Item */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full text-xs font-semibold bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white border border-neutral-700/60"
                      onClick={() => openBuyModal(item)}
                    >
                      Buy Item
                    </Button>

                    <Button
                      size="sm"
                      className="w-full text-xs font-semibold flex items-center justify-center gap-1.5 bg-white text-black hover:bg-white/90 shadow-sm border"
                      disabled={!item.giftable}
                      onClick={() => openGiftModal(item)}
                    >
                      <Gift className="size-3.5" />
                      Gift Item
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* GIFTING MODAL DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Gift className="size-4 text-primary" />
              Gift Cosmetic
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="flex flex-col gap-3 py-1">
              {/* Item Info Box */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/40">
                <div className="size-14 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border">
                  {selectedItem.images.icon ? (
                    <img
                      src={selectedItem.images.icon}
                      alt={selectedItem.name}
                      className="size-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <Sparkles className="size-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="font-semibold text-sm truncate">{selectedItem.name}</span>
                  <span className="text-[11px] text-muted-foreground">{selectedItem.rarity} · {selectedItem.type}</span>
                  <div className="flex items-center gap-1 mt-0.5 text-xs font-bold text-blue-500">
                    <span>{selectedItem.price.toLocaleString()} V-Bucks</span>
                  </div>
                </div>
              </div>

              {/* Safe Test Mode Switch */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-xs">
                <div className="flex flex-col">
                  <span className="font-semibold flex items-center gap-1.5 text-green-500">
                    <ShieldCheck className="size-4" />
                    Safe Test Mode (0 V-Bucks)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {safeTestMode
                      ? 'Verifies session & friendship eligibility with 0 V-Bucks consumed.'
                      : 'Live Mode: Real V-Bucks will be spent!'}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={safeTestMode ? 'default' : 'outline'}
                  onClick={() => setSafeTestMode(!safeTestMode)}
                  className={`h-7 px-2.5 text-xs font-semibold ${
                    safeTestMode ? 'bg-green-600 hover:bg-green-700 text-white' : ''
                  }`}
                >
                  {safeTestMode ? 'Safe Test: ON' : 'Safe Test: OFF'}
                </Button>
              </div>

              {/* Gifter Account Confirmation */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Gifter Account:</span>
                <span className="font-semibold">{currentAccount?.customDisplayName || currentAccount?.displayName}</span>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Remaining Balance After:</span>
                <span className="font-semibold text-blue-500">
                  {safeTestMode
                    ? `${giftingInfo?.vbucks.toLocaleString() || '...'} V-Bucks (0 spent)`
                    : `${giftingInfo ? (giftingInfo.vbucks - selectedItem.price).toLocaleString() : '...'} V-Bucks`}
                </span>
              </div>

              {/* Recipient Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold flex items-center justify-between">
                  <span>Select Recipient Friend</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {giftingInfo?.eligibleFriends.length || 0} friends loaded
                  </span>
                </label>

                {/* Combobox for recipient friend */}
                <Popover open={friendPopoverOpen} onOpenChange={setFriendPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={friendPopoverOpen}
                      className="w-full justify-between h-9 text-xs font-normal border bg-background hover:bg-muted/50"
                    >
                      {selectedFriend ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-medium truncate">{selectedFriend.displayName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {selectedFriend.isEligible48h ? '(48h Ready)' : `(Needs ${selectedFriend.hoursRemaining}h)`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Choose a friend...</span>
                      )}
                      <ChevronsUpDown className="size-3.5 opacity-50 shrink-0 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[380px] max-w-[90vw]" align="start">
                    <Command
                      filter={(value, search) => {
                        const f = giftingInfo?.eligibleFriends.find((item) => item.accountId === value)
                        if (!f) return 0
                        const q = search.toLowerCase().trim()
                        return f.displayName.toLowerCase().includes(q) || f.accountId.toLowerCase().includes(q) ? 1 : 0
                      }}
                      loop
                    >
                      <CommandInput placeholder="Search friends list..." className="h-9 text-xs" />
                      <CommandListWithScrollArea>
                        <CommandEmpty className="py-2.5 text-center text-xs text-muted-foreground">
                          No friends found
                        </CommandEmpty>
                        <CommandGroup>
                          {giftingInfo?.eligibleFriends.map((f) => (
                            <CommandItem
                              key={f.accountId}
                              value={f.accountId}
                              onSelect={() => {
                                setSelectedRecipientId(f.accountId)
                                setFriendPopoverOpen(false)
                              }}
                              className="text-xs flex items-center justify-between py-1.5 px-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Check
                                  className={cn(
                                    'size-3.5 shrink-0',
                                    selectedRecipientId === f.accountId ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <span className="truncate font-medium">{f.displayName}</span>
                              </div>
                              <Badge
                                variant={f.isEligible48h ? 'default' : 'secondary'}
                                className="text-[10px] px-1 py-0 ml-2 shrink-0 font-normal"
                              >
                                {f.isEligible48h ? '48h Ready' : `${f.hoursRemaining}h left`}
                              </Badge>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandListWithScrollArea>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* 48h Eligibility Indicator */}
                {selectedFriend && (
                  <div>
                    {selectedFriend.isEligible48h ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-500/10 px-2.5 py-1.5 rounded border border-green-500/20 font-medium">
                        <ShieldCheck className="size-3.5 shrink-0" />
                        <span>Eligible: Friends for over 48 hours. Ready to receive gift!</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600 bg-yellow-500/10 px-2.5 py-1.5 rounded border border-yellow-500/20 font-medium">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span>
                          Cooldown active: {selectedFriend.hoursRemaining}h remaining before this friend can receive gifts.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Gift Box Style */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Gift Wrap Box</label>
                <div className="grid grid-cols-4 gap-2">
                  {GIFT_BOXES.map((box) => (
                    <Button
                      key={box.id}
                      type="button"
                      variant={selectedGiftBox === box.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedGiftBox(box.id)}
                      className="text-xs h-8 px-2 font-normal"
                    >
                      {box.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Personalized Message */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Personalized Gift Message</label>
                <Input
                  placeholder="e.g. Enjoy your skin! - From Trimzy"
                  value={customMessage}
                  maxLength={100}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={sendingGift} className="h-8 text-xs">
              Cancel
            </Button>
            {safeTestMode ? (
              <Button
                size="sm"
                onClick={handleSendGiftSubmit}
                disabled={sendingGift || !selectedFriend || !selectedFriend.isEligible48h}
                className="h-8 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
              >
                {sendingGift ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                Run Safe Test (0 V-Bucks)
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSendGiftSubmit}
                disabled={
                  sendingGift ||
                  !selectedFriend ||
                  !selectedFriend.isEligible48h ||
                  (giftingInfo !== null && giftingInfo.vbucks < (selectedItem?.price || 0))
                }
                className="h-8 flex items-center gap-1.5 bg-primary text-xs font-semibold"
              >
                {sendingGift ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Confirm & Send Gift
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BUY ITEM MODAL DIALOG */}
      <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
        <DialogContent className="sm:max-w-[420px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <span>Purchase Item for Current Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Buy this item directly for your active account using V-Bucks.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="flex flex-col gap-3 py-1">
              {/* Cosmetic Preview */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/40">
                <div className="size-14 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border">
                  {selectedItem.images.icon ? (
                    <img
                      src={selectedItem.images.icon}
                      alt={selectedItem.name}
                      className="size-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <Sparkles className="size-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold text-sm truncate">{selectedItem.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedItem.type} • {selectedItem.rarity}</span>
                  <div className="flex items-center gap-1 font-bold text-xs text-blue-500 mt-1">
                    <span>{selectedItem.price.toLocaleString()}</span>
                    <span>V-Bucks</span>
                  </div>
                </div>
              </div>

              {/* Safe Dry-Run Toggle Banner */}
              <div
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-colors',
                  buySafeTestMode
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                    : 'bg-muted border-border text-muted-foreground'
                )}
                onClick={() => setBuySafeTestMode(!buySafeTestMode)}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Safe Test Mode (0 V-Bucks)</span>
                    <span className="text-[10px] opacity-80">
                      {buySafeTestMode ? 'Validates purchase eligibility with zero spend.' : 'Disabled: Real V-Bucks will be deducted.'}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={buySafeTestMode ? 'default' : 'outline'}
                  className="h-6 text-[11px] px-2"
                  type="button"
                >
                  {buySafeTestMode ? 'Test: ON' : 'Test: OFF'}
                </Button>
              </div>

              {/* Account Confirmation */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Purchasing Account:</span>
                <span className="font-semibold">{currentAccount?.customDisplayName || currentAccount?.displayName}</span>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-semibold text-blue-500">
                  {giftingInfo ? `${giftingInfo.vbucks.toLocaleString()} V-Bucks` : '...'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Balance After Purchase:</span>
                <span className="font-semibold text-blue-500">
                  {buySafeTestMode
                    ? `${giftingInfo?.vbucks.toLocaleString() || '...'} V-Bucks (0 spent)`
                    : `${giftingInfo ? (giftingInfo.vbucks - selectedItem.price).toLocaleString() : '...'} V-Bucks`}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBuyModalOpen(false)} disabled={buyingItem} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBuyItemSubmit}
              disabled={buyingItem || (!buySafeTestMode && !!giftingInfo && giftingInfo.vbucks < (selectedItem?.price || 0))}
              className="h-8 text-xs flex items-center gap-1.5 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white border border-neutral-700/60"
            >
              {buyingItem ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : buySafeTestMode ? (
                <>
                  <ShieldCheck className="size-3.5" />
                  <span>Test Purchase (0 VB)</span>
                </>
              ) : (
                <span>Confirm Purchase ({selectedItem?.price.toLocaleString()} VB)</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
