import type { AccountData, AccountDataList } from '../../types/accounts'
import type {
  BulkAcceptResult,
  BulkSendResult,
  FriendsActionResult,
  FriendsSummaryData,
  FriendUser,
} from '../../types/friends-management'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'
import { LookupManager } from './lookup'

import {
  addFriend,
  getFriendsSummary,
  removeFriend,
} from '../../services/endpoints/friends'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'

export class FriendsCore {
  static async getSummary(account: AccountData) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.FriendsGetSummaryNotification,
          {
            accountId: account.accountId,
            displayName: account.displayName,
            friends: [],
            incoming: [],
            outgoing: [],
            blocklist: [],
          } as FriendsSummaryData
        )
        return
      }

      const summaryResponse = await getFriendsSummary({
        accessToken,
        accountId: account.accountId,
      })

      const raw = summaryResponse.data

      // Collect all account IDs that need display names
      const allIds = Array.from(
        new Set([
          ...raw.friends.map((item) => item.accountId),
          ...raw.incoming.map((item) => item.accountId),
          ...raw.outgoing.map((item) => item.accountId),
          ...raw.blocklist.map((item) => item.accountId),
        ])
      )

      const namesMap = new Map<string, string>()

      // Batch query account IDs in groups of 100
      const chunkSize = 100
      for (let i = 0; i < allIds.length; i += chunkSize) {
        const chunk = allIds.slice(i, i + chunkSize)
        try {
          const lookupResponse = await findUsersByAccountIds({
            accessToken,
            accountIds: chunk,
          })
          if (Array.isArray(lookupResponse.data)) {
            for (const user of lookupResponse.data) {
              if (user.id && user.displayName) {
                namesMap.set(user.id, user.displayName)
              }
            }
          }
        } catch {
          // Continue if any chunk lookup fails
        }
      }

      const mapItems = (
        items: Array<{ accountId: string; status: string; created: string; favorite?: boolean }>
      ): Array<FriendUser> =>
        items.map((item) => ({
          accountId: item.accountId,
          displayName: namesMap.get(item.accountId) || item.accountId,
          status: item.status,
          created: item.created,
          favorite: item.favorite,
        }))

      const result: FriendsSummaryData = {
        accountId: account.accountId,
        displayName: account.displayName,
        friends: mapItems(raw.friends),
        incoming: mapItems(raw.incoming),
        outgoing: mapItems(raw.outgoing),
        blocklist: mapItems(raw.blocklist),
      }

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsGetSummaryNotification,
        result
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsGetSummaryNotification,
        {
          accountId: account.accountId,
          displayName: account.displayName,
          friends: [],
          incoming: [],
          outgoing: [],
          blocklist: [],
        } as FriendsSummaryData
      )
    }
  }

  static async acceptRequest(account: AccountData, friendId: string) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.FriendsAcceptRequestNotification,
          {
            success: false,
            accountId: account.accountId,
            friendId,
            errorMessage: 'Authentication failed',
          } as FriendsActionResult
        )
        return
      }

      await addFriend({
        accessToken,
        accountId: account.accountId,
        friendId,
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsAcceptRequestNotification,
        {
          success: true,
          accountId: account.accountId,
          friendId,
          errorMessage: null,
        } as FriendsActionResult
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsAcceptRequestNotification,
        {
          success: false,
          accountId: account.accountId,
          friendId,
          errorMessage: error?.response?.data?.errorMessage || error?.message,
        } as FriendsActionResult
      )
    }
  }

  static async rejectRequest(account: AccountData, friendId: string) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.FriendsRejectRequestNotification,
          {
            success: false,
            accountId: account.accountId,
            friendId,
            errorMessage: 'Authentication failed',
          } as FriendsActionResult
        )
        return
      }

      await removeFriend({
        accessToken,
        accountId: account.accountId,
        friendId,
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsRejectRequestNotification,
        {
          success: true,
          accountId: account.accountId,
          friendId,
          errorMessage: null,
        } as FriendsActionResult
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsRejectRequestNotification,
        {
          success: false,
          accountId: account.accountId,
          friendId,
          errorMessage: error?.response?.data?.errorMessage || error?.message,
        } as FriendsActionResult
      )
    }
  }

  static async sendRequest(account: AccountData, displayNameOrId: string) {
    try {
      const lookupResult = await LookupManager.searchUserByDisplayName({
        account,
        displayName: displayNameOrId.trim(),
      })

      if (!lookupResult.success || !lookupResult.data) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.FriendsSendRequestNotification,
          {
            success: false,
            accountId: account.accountId,
            displayName: displayNameOrId,
            errorMessage: 'User not found in Epic Games directory',
          } as FriendsActionResult
        )
        return
      }

      const targetId = lookupResult.data.id
      const targetDisplayName = lookupResult.data.displayName

      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.FriendsSendRequestNotification,
          {
            success: false,
            accountId: account.accountId,
            displayName: targetDisplayName,
            errorMessage: 'Authentication failed',
          } as FriendsActionResult
        )
        return
      }

      await addFriend({
        accessToken,
        accountId: account.accountId,
        friendId: targetId,
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsSendRequestNotification,
        {
          success: true,
          accountId: account.accountId,
          friendId: targetId,
          displayName: targetDisplayName,
          errorMessage: null,
        } as FriendsActionResult
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsSendRequestNotification,
        {
          success: false,
          accountId: account.accountId,
          displayName: displayNameOrId,
          errorMessage: error?.response?.data?.errorMessage || error?.message,
        } as FriendsActionResult
      )
    }
  }

  static async removeFriend(account: AccountData, friendId: string) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)
      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.FriendsRemoveNotification,
          {
            success: false,
            accountId: account.accountId,
            friendId,
            errorMessage: 'Authentication failed',
          } as FriendsActionResult
        )
        return
      }

      await removeFriend({
        accessToken,
        accountId: account.accountId,
        friendId,
      })

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsRemoveNotification,
        {
          success: true,
          accountId: account.accountId,
          friendId,
          errorMessage: null,
        } as FriendsActionResult
      )
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsRemoveNotification,
        {
          success: false,
          accountId: account.accountId,
          friendId,
          errorMessage: error?.response?.data?.errorMessage || error?.message,
        } as FriendsActionResult
      )
    }
  }

  static async bulkAccept(accounts: AccountDataList) {
    let totalAccepted = 0
    const results: BulkAcceptResult['results'] = []

    for (const account of accounts) {
      try {
        const accessToken = await Authentication.verifyAccessToken(account)
        if (!accessToken) continue

        const summary = await getFriendsSummary({
          accessToken,
          accountId: account.accountId,
        })

        let count = 0
        for (const req of summary.data.incoming) {
          try {
            await addFriend({
              accessToken,
              accountId: account.accountId,
              friendId: req.accountId,
            })
            count++
            totalAccepted++
          } catch {
            // Continue with others
          }
        }

        results.push({
          accountId: account.accountId,
          displayName: account.displayName,
          acceptedCount: count,
        })
      } catch {
        results.push({
          accountId: account.accountId,
          displayName: account.displayName,
          acceptedCount: 0,
        })
      }
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.FriendsBulkAcceptNotification,
      {
        success: true,
        totalAccepted,
        results,
      } as BulkAcceptResult
    )
  }

  static async bulkSend(accounts: AccountDataList, displayNameOrId: string) {
    if (accounts.length === 0) return

    // Lookup user using first account
    const lookupResult = await LookupManager.searchUserByDisplayName({
      account: accounts[0],
      displayName: displayNameOrId.trim(),
    })

    if (!lookupResult.success || !lookupResult.data) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.FriendsBulkSendNotification,
        {
          success: false,
          targetDisplayName: displayNameOrId,
          targetAccountId: '',
          results: [],
        } as BulkSendResult
      )
      return
    }

    const targetId = lookupResult.data.id
    const targetDisplayName = lookupResult.data.displayName
    const results: BulkSendResult['results'] = []

    for (const account of accounts) {
      try {
        const accessToken = await Authentication.verifyAccessToken(account)
        if (!accessToken) {
          results.push({
            accountId: account.accountId,
            displayName: account.displayName,
            success: false,
            errorMessage: 'Auth failed',
          })
          continue
        }

        await addFriend({
          accessToken,
          accountId: account.accountId,
          friendId: targetId,
        })

        results.push({
          accountId: account.accountId,
          displayName: account.displayName,
          success: true,
          errorMessage: null,
        })
      } catch (error: any) {
        results.push({
          accountId: account.accountId,
          displayName: account.displayName,
          success: false,
          errorMessage: error?.response?.data?.errorMessage || error?.message,
        })
      }
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.FriendsBulkSendNotification,
      {
        success: true,
        targetDisplayName,
        targetAccountId: targetId,
        results,
      } as BulkSendResult
    )
  }
}
