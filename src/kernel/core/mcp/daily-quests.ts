import type { AccountData } from '../../../types/accounts'
import type {
  AutoRerollConfig,
  AutoRerollItemResult,
  AutoRerollSummaryResult,
  DailyQuest,
  DailyQuestRerollResponse,
  DailyQuestsAccountData,
} from '../../../types/daily-quests'
import type { MCPQueryProfileChanges } from '../../../types/services/mcp'

import { ElectronAPIEventKeys } from '../../../config/constants/main-process'

import questRewards from '../../../data/quest-rewards.json'
import { MainWindow } from '../../startup/windows/main'
import { DataDirectory } from '../../startup/data-directory'
import { Authentication } from '../authentication'

import {
  getQueryProfile,
  setFortRerollDailyQuest,
} from '../../../services/endpoints/mcp'

import { isMCPQueryProfileChangesQuest } from '../../../lib/check-objects'

const dailyQuestPrefix = 'quest:daily_'

export class MCPDailyQuests {
  static async request(accounts: Array<AccountData>) {
    try {
      const responses = await Promise.allSettled(
        accounts.map(async (account) => {
          return MCPDailyQuests.requestAccount(account)
        }),
      )

      const data = responses
        .filter((response) => response.status === 'fulfilled')
        .map((response) => response.value)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.DailyQuestsNotification,
        data,
      )

      return

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.DailyQuestsNotification,
      [],
    )
  }

  static async reroll(account: AccountData, questId: string) {
    const response: DailyQuestRerollResponse = {
      accountId: account.accountId,
      success: false,
      errorMessage: 'Unknown Error',
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.DailyQuestRerollNotification,
          response,
        )

        return
      }

      await setFortRerollDailyQuest({
        accessToken,
        accountId: account.accountId,
        questId,
      })

      const profileResponse = await getQueryProfile({
        accessToken,
        accountId: account.accountId,
      })
      const profile =
        profileResponse.data.profileChanges?.[0]?.profile ?? null

      if (!profile) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.DailyQuestRerollNotification,
          response,
        )

        return
      }

      const quests = parseDailyQuests(profile)
      const rerolls =
        profile.stats?.attributes?.quest_manager?.dailyQuestRerolls ?? 0

      const data: DailyQuestsAccountData = {
        accountId: account.accountId,
        available: true,
        rerolls,
        quests,
      }

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.DailyQuestRerollNotification,
        {
          accountId: account.accountId,
          success: true,
          errorMessage: null,
          data,
        } as DailyQuestRerollResponse,
      )

      return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.response?.data?.errorMessage) {
        response.errorMessage =
          error.response?.data?.errorMessage ?? 'Unknown Error'
      }
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.DailyQuestRerollNotification,
      response,
    )
  }

  static async getAutoRerollConfig(): Promise<AutoRerollConfig> {
    return DataDirectory.getAutoRerollSettings()
  }

  static async saveAutoRerollConfig(config: AutoRerollConfig): Promise<void> {
    await DataDirectory.updateAutoRerollSettings(config)
  }

  static async autoRerollAll(
    accounts: Array<AccountData>,
    customConfig?: AutoRerollConfig,
  ) {
    if (customConfig) {
      await DataDirectory.updateAutoRerollSettings(customConfig)
    }

    const config = customConfig || (await DataDirectory.getAutoRerollSettings())
    const results: AutoRerollItemResult[] = []
    let totalRerolled = 0

    if (!config.enabled || accounts.length === 0) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.DailyQuestsAutoRerollNotification,
        {
          success: true,
          totalRerolled: 0,
          results: [],
        } as AutoRerollSummaryResult,
      )
      return
    }

    for (const account of accounts) {
      try {
        const accessToken = await Authentication.verifyAccessToken(account)
        if (!accessToken) continue

        const profileResponse = await getQueryProfile({
          accessToken,
          accountId: account.accountId,
        })
        const profile = profileResponse.data?.profileChanges?.[0]?.profile
        if (!profile) continue

        const quests = parseDailyQuests(profile)
        let rerolls =
          profile.stats?.attributes?.quest_manager?.dailyQuestRerolls ?? 0

        if (rerolls <= 0 || quests.length === 0) continue

        for (const quest of quests) {
          if (rerolls <= 0) break

          const questId = quest.templateId.replace(/^Quest:/i, '')
          const questName = formatQuestName(quest.templateId)

          let shouldReroll = false

          // 1. Check direct blacklist match
          if (config.blacklistedQuestIds.includes(questId)) {
            shouldReroll = true
          }

          // 2. Check keywords match
          if (!shouldReroll && config.customKeywords?.length > 0) {
            const lowerId = questId.toLowerCase()
            const lowerName = questName.toLowerCase()
            if (
              config.customKeywords.some(
                (kw) =>
                  kw.trim() &&
                  (lowerId.includes(kw.trim().toLowerCase()) ||
                    lowerName.includes(kw.trim().toLowerCase())),
              )
            ) {
              shouldReroll = true
            }
          }

          // 3. Check low V-Bucks match
          if (!shouldReroll && config.rerollLowVBucks) {
            const rewards =
              (
                questRewards as Record<
                  string,
                  Array<{ templateId: string; quantity: number }>
                >
              )[quest.templateId] || []
            const vbucksReward = rewards.find(
              (r) =>
                r.templateId.includes('MtxPurchased') ||
                r.templateId.includes('Currency:MtxComplimentary'),
            )?.quantity
            if (vbucksReward === 50) {
              shouldReroll = true
            }
          }

          if (shouldReroll) {
            try {
              await setFortRerollDailyQuest({
                accessToken,
                accountId: account.accountId,
                questId: quest.questId,
              })

              rerolls--
              totalRerolled++

              const updatedProfileRes = await getQueryProfile({
                accessToken,
                accountId: account.accountId,
              })
              const updatedProfile =
                updatedProfileRes.data?.profileChanges?.[0]?.profile
              const updatedQuests = updatedProfile
                ? parseDailyQuests(updatedProfile)
                : []
              const newQuest = updatedQuests.find(
                (q) => q.questId !== quest.questId,
              )

              results.push({
                accountId: account.accountId,
                displayName:
                  account.customDisplayName || account.displayName,
                oldQuestTemplateId: quest.templateId,
                oldQuestName: questName,
                newQuestTemplateId: newQuest?.templateId,
                newQuestName: newQuest
                  ? formatQuestName(newQuest.templateId)
                  : undefined,
                success: true,
                errorMessage: null,
              })
            } catch (err: any) {
              results.push({
                accountId: account.accountId,
                displayName:
                  account.customDisplayName || account.displayName,
                oldQuestTemplateId: quest.templateId,
                oldQuestName: questName,
                success: false,
                errorMessage: err?.message,
              })
            }
          }
        }
      } catch {
        // Continue
      }
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.DailyQuestsAutoRerollNotification,
      {
        success: true,
        totalRerolled,
        results,
      } as AutoRerollSummaryResult,
    )
  }

  private static async requestAccount(
    account: AccountData,
  ): Promise<DailyQuestsAccountData> {
    const result: DailyQuestsAccountData = {
      accountId: account.accountId,
      available: true,
      rerolls: 0,
      quests: [],
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        result.available = false
        result.errorMessage = 'Unknown Error'

        return result
      }

      const profileResponse = await getQueryProfile({
        accessToken,
        accountId: account.accountId,
      })

      const profile =
        profileResponse.data.profileChanges?.[0]?.profile ?? null

      if (!profile) {
        result.available = false
        result.errorMessage = 'Unknown Error'

        return result
      }

      result.quests = parseDailyQuests(profile)
      result.rerolls =
        profile.stats?.attributes?.quest_manager?.dailyQuestRerolls ?? 0

      return result

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      result.available = false
      result.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    return result
  }
}

function parseDailyQuests(
  profile: MCPQueryProfileChanges['profile'],
): Array<DailyQuest> {
  const items = Object.entries(profile?.items ?? {})
  const quests: Array<DailyQuest> = []

  items.forEach(([id, item]) => {
    if (!isMCPQueryProfileChangesQuest(item)) {
      return
    }

    const templateId = item.templateId ?? ''

    if (!templateId.toLowerCase().startsWith(dailyQuestPrefix)) {
      return
    }

    const attributes = item.attributes as Record<string, unknown>
    const questState = `${attributes.quest_state ?? ''}`

    if (questState.toLowerCase() !== 'active') {
      return
    }

    const progress = parseDailyQuestProgress(attributes)

    quests.push({
      questId: id,
      templateId,
      name: formatQuestName(templateId),
      state: questState,
      progress,
    })
  })

  return quests
}

function parseDailyQuestProgress(
  attributes: Record<string, unknown>,
): number {
  return Object.entries(attributes)
    .filter(
      ([key, value]) =>
        key.startsWith('completion_') && typeof value === 'number',
    )
    .reduce((accumulator, [, value]) => {
      accumulator += value as number

      return accumulator
    }, 0)
}

function formatQuestName(templateId: string) {
  const cleaned = templateId
    .replace(/^Quest:/i, '')
    .replace(/^Daily_/i, '')
    .replace(/_/g, ' ')
    .trim()

  if (!cleaned) {
    return templateId
  }

  return toTitleCase(cleaned)
}

// function formatObjectiveLabel(value: string) {
//   const cleaned = value
//     .replace(/^completion_/i, '')
//     .replace(/_/g, ' ')
//     .trim()

//   if (!cleaned) {
//     return value
//   }

//   return toTitleCase(cleaned)
// }

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
