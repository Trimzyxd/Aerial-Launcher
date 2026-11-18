export type DailyQuestProgress = {
  key: string
  label: string
  value: number
}

export type DailyQuest = {
  questId: string
  templateId: string
  name: string
  state: string
  // progress: Array<DailyQuestProgress>
  progress: number
}

export type DailyQuestsAccountData = {
  accountId: string
  available: boolean
  rerolls: number
  quests: Array<DailyQuest>
  errorMessage?: string
}

export type DailyQuestRerollResponse =
  | {
      accountId: string
      success: false
      errorMessage: string
      data?: DailyQuestsAccountData
    }
  | {
      accountId: string
      success: true
      errorMessage: null
      data: DailyQuestsAccountData
    }

export type AutoRerollConfig = {
  enabled: boolean
  rerollLowVBucks: boolean
  blacklistedQuestIds: Array<string>
  customKeywords: Array<string>
}

export type AutoRerollItemResult = {
  accountId: string
  displayName: string
  oldQuestTemplateId: string
  oldQuestName: string
  newQuestTemplateId?: string
  newQuestName?: string
  success: boolean
  errorMessage?: string | null
}

export type AutoRerollSummaryResult = {
  success: boolean
  totalRerolled: number
  results: Array<AutoRerollItemResult>
}
