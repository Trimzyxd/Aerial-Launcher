import { UpdateIcon } from '@radix-ui/react-icons'
import { createRoute } from '@tanstack/react-router'
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Sliders,
  Square,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import dailyQuestsTotal from '../../../data/dailiy-quests.json'
import questRewards from '../../../data/quest-rewards.json'

import { Route as RootRoute } from '../../__root'

import { HomeBreadcrumb } from '../../../components/navigations/breadcrumb/home'
import { AccountSelectors } from '../../../components/selectors/accounts'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../../components/ui/breadcrumb'
import { Button } from '../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Badge } from '../../../components/ui/badge'
import { GoToTop } from '../../../components/go-to-top'

import { parseResource } from '../../../lib/parsers/resources'
import { parseCustomDisplayName } from '../../../lib/utils'

import type { AutoRerollConfig } from '../../../types/daily-quests'
import { useDailyQuestsData } from './-hooks'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/daily-quests',
  component: () => {
    const { t } = useTranslation(['sidebar'])

    return (
      <>
        <Breadcrumb>
          <BreadcrumbList>
            <HomeBreadcrumb />
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('stw-operations.title')}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {t('stw-operations.options.daily-quests')}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Content />
      </>
    )
  },
})

function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    accounts,
    accountList,
    dailyQuests,
    fetchButtonIsDisabled,
    isLoading,
    isAutoRerolling,
    parsedSelectedAccounts,
    parsedSelectedTags,
    rerollIsDisabled,
    rerollingQuest,
    tags,

    dailyQuestsUpdateAccounts,
    dailyQuestsUpdateTags,
    handleFetch,
    handleReroll,
    handleAutoReroll,
  } = useDailyQuestsData()

  // Auto-Reroll Configuration State
  const [showSettings, setShowSettings] = useState(false)
  const [rerollLowVBucks, setRerollLowVBucks] = useState(true)
  const [blacklistedIds, setBlacklistedIds] = useState<string[]>([
    'daily_explorezones',
    'daily_partyof50',
    'daily_mission_specialist_anyhero_2',
    'daily_huskextermination_anyhero',
  ])
  const [keywordInput, setKeywordInput] = useState('explore, play with others')
  const [searchQuest, setSearchQuest] = useState('')

  const allQuestsList = useMemo(() => {
    return Object.keys(dailyQuestsTotal)
  }, [])

  const filteredQuestsList = useMemo(() => {
    if (!searchQuest.trim()) return allQuestsList
    const q = searchQuest.toLowerCase()
    return allQuestsList.filter(
      (id) =>
        id.toLowerCase().includes(q) ||
        (t(`daily-quests.quests.${id}`) || '').toLowerCase().includes(q)
    )
  }, [allQuestsList, searchQuest, t])

  const toggleQuest = (id: string) => {
    setBlacklistedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const applyPresetTedious = () => {
    setBlacklistedIds([
      'daily_explorezones',
      'daily_partyof50',
      'daily_mission_specialist_anyhero_2',
      'daily_huskextermination_anyhero',
      'daily_mission_specialist_anyhero_1',
    ])
    setKeywordInput('explore, play with others')
    setRerollLowVBucks(true)
  }

  return (
    <>
      <div className="flex flex-grow mb-10">
        <div className="flex items-center justify-center w-full">
          <div className="max-w-2xl space-y-4 w-full">
            <Card className="w-full">
              <CardHeader className="border-b">
                <CardDescription>
                  {t('daily-quests.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6">
                <AccountSelectors
                  accounts={{
                    options: accounts,
                    value: parsedSelectedAccounts,
                  }}
                  tags={{
                    options: tags,
                    value: parsedSelectedTags,
                  }}
                  onUpdateAccounts={dailyQuestsUpdateAccounts}
                  onUpdateTags={dailyQuestsUpdateTags}
                />
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="w-full sm:w-1/2"
                  onClick={handleFetch}
                  disabled={fetchButtonIsDisabled}
                  id="load-dailies-button"
                >
                  {isLoading ? (
                    <UpdateIcon className="animate-spin" />
                  ) : (
                    t('daily-quests.form.submit-button')
                  )}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full sm:w-1/2 flex items-center justify-center gap-2"
                  onClick={() => {
                    const customConfig: AutoRerollConfig = {
                      enabled: true,
                      rerollLowVBucks,
                      blacklistedQuestIds: blacklistedIds,
                      customKeywords: keywordInput
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }
                    handleAutoReroll(customConfig)
                  }}
                  disabled={fetchButtonIsDisabled || isAutoRerolling}
                >
                  {isAutoRerolling ? (
                    <UpdateIcon className="animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Auto-Reroll Blacklisted ({blacklistedIds.length})
                </Button>
              </CardFooter>
            </Card>

            {/* Auto-Reroll Rules Card */}
            <Card className="w-full">
              <CardHeader
                className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors flex flex-row items-center justify-between"
                onClick={() => setShowSettings(!showSettings)}
              >
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">
                    Auto-Reroll Rules & Blacklist
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {blacklistedIds.length} quests blacklisted
                  </Badge>
                </div>

                <Button variant="ghost" size="icon" className="size-7">
                  {showSettings ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              </CardHeader>

              {showSettings && (
                <CardContent className="pt-4 border-t space-y-4">
                  {/* Presets and Low V-Bucks */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                    <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={rerollLowVBucks}
                        onChange={(e) => setRerollLowVBucks(e.target.checked)}
                        className="rounded"
                      />
                      <span>Always reroll low V-Bucks quests (50 VB quests)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={applyPresetTedious}
                      >
                        Reset to Tedious Quests Preset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setBlacklistedIds([])}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  {/* Custom Keyword Filters */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">
                      Custom Keywords (comma separated)
                    </label>
                    <Input
                      placeholder="e.g. explore, play with others"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Any daily quest matching these keywords will be automatically rerolled.
                    </p>
                  </div>

                  {/* Quest Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold">
                        Select Specific Daily Quests to Auto-Reroll
                      </label>
                      <div className="relative w-48">
                        <Search className="absolute left-2 top-2 size-3 text-muted-foreground" />
                        <Input
                          placeholder="Search daily quests..."
                          value={searchQuest}
                          onChange={(e) => setSearchQuest(e.target.value)}
                          className="h-7 pl-6 text-xs"
                        />
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto border rounded-md p-2 divide-y text-xs">
                      {filteredQuestsList.map((questId) => {
                        const isChecked = blacklistedIds.includes(questId)
                        const questTitle =
                          t(`daily-quests.quests.${questId}`) || questId

                        return (
                          <div
                            key={questId}
                            onClick={() => toggleQuest(questId)}
                            className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 cursor-pointer rounded transition-colors"
                          >
                            <span className="font-medium truncate mr-2">
                              {questTitle}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {questId}
                              </span>
                              {isChecked ? (
                                <CheckSquare className="size-4 text-destructive" />
                              ) : (
                                <Square className="size-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="w-full">
              <CardHeader className="border-b">
                <CardDescription>
                  {t('daily-quests.list.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {dailyQuests.length <= 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {t('daily-quests.list.empty')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {dailyQuests.map((account) => {
                      const accountData = accountList[account.accountId]
                      const displayName = accountData
                        ? parseCustomDisplayName(accountData)
                        : account.accountId

                      return (
                        <div
                          key={account.accountId}
                          className="space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">
                              {displayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t('daily-quests.list.rerolls', {
                                count: account.rerolls,
                              })}
                            </div>
                          </div>

                          {account.errorMessage ? (
                            <div className="border-l-4 border-red-400 ml-2 pl-2 text-red-400 text-sm">
                              {account.errorMessage}
                            </div>
                          ) : account.quests.length <= 0 ? (
                            <div className="text-sm text-muted-foreground">
                              {t('daily-quests.list.no-quests')}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {account.quests.map((quest) => {
                                const isRerolling =
                                  rerollingQuest?.accountId ===
                                    account.accountId &&
                                  rerollingQuest?.questId === quest.questId
                                const questId = quest.templateId.replace(
                                  'Quest:',
                                  '',
                                )
                                const questTotal = (
                                  dailyQuestsTotal as Record<
                                    string,
                                    number
                                  >
                                )[questId]

                                const rewards =
                                  (
                                    questRewards as unknown as Record<
                                      string,
                                      Array<{
                                        quantity: number
                                        questTemplateId: string
                                        templateId: string
                                      }>
                                    >
                                  )?.[quest.templateId] ?? []

                                return (
                                  <div
                                    key={quest.questId}
                                    className="border rounded-md p-3 space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="font-medium truncate">
                                          {t(
                                            `daily-quests.quests.${questId}`,
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {quest.templateId}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        disabled={
                                          rerollIsDisabled ||
                                          account.rerolls <= 0
                                        }
                                        onClick={() =>
                                          handleReroll(
                                            account.accountId,
                                            quest.questId,
                                          )
                                        }
                                      >
                                        {isRerolling ? (
                                          <UpdateIcon className="animate-spin" />
                                        ) : (
                                          t(
                                            'daily-quests.form.replace-button',
                                          )
                                        )}
                                      </Button>
                                    </div>
                                    <div className="">
                                      <ul className="flex gap-2">
                                        {rewards.map((reward) => {
                                          if (
                                            !reward.templateId.startsWith(
                                              'AccountResource:',
                                            )
                                          ) {
                                            return null
                                          }

                                          const resource = parseResource({
                                            key: reward.templateId,
                                            quantity: reward.quantity,
                                          })

                                          return (
                                            <li
                                              className="flex gap-1 items-center"
                                              key={reward.templateId}
                                            >
                                              <img
                                                src={resource.imgUrl}
                                                className="size-5"
                                                alt="icon"
                                              />
                                              {resource.quantity}
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    </div>
                                    <div className="flex justify-end">
                                      {quest.progress}/{questTotal}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <GoToTop containerId="load-dailies-button" />
    </>
  )
}
