# Aerial Ecosystem: Project Dossier & Architecture Specification

## 1. Executive Summary & Project Lineage

* **Desktop Application:** **Aerial Launcher**
  * **Upstream Repository:** `https://github.com/Ciensprog/Aerial-Launcher.git` (v1.13.0)
  * **Active Fork Repository:** `https://github.com/Trimzyxd/Aerial-Launcher.git` (branch `main`)
  * **Local Workspace:** `C:\Users\franz\.gemini\antigravity\scratch\Aerial-Launcher`
  * **Installer Output:** `out/make/squirrel.windows/x64/Aerial Launcher-1.13.0 Setup.exe`
* **Mobile Application:** **Aerial Mobile**
  * **Architecture:** React Native / Expo SDK
  * **Target Platforms:** Android & iOS
  * **Core Scope:** Save the World (STW) Mission Alerts, Daily Quests & Rerolling, Friends & Request Management, Item Shop & Gifting.

---

## 2. Desktop Launcher Custom Implementations

### A. Friends & Friend Requests Management
* **Route:** `/friends` (`src/routes/friends/route.tsx`)
* **Kernel Core:** `src/kernel/core/friends.ts`
* **Preload Bridge:** `src/kernel/preload.ts` (`friendsActions`)
* **Key Capabilities:**
  * Real-time query of friends list (`friends.getFriends()`).
  * Inbound pending friend requests with one-click **Accept** and **Reject**.
  * Outbound pending friend requests with **Cancel Request** option.
  * Direct player search by Epic Games display name and instant request dispatch.
  * Remove friend (unfriend) confirmation dialog.

### B. Fortnite Item Shop & Gifting Platform
* **Route:** `/item-shop` (`src/routes/item-shop/route.tsx`)
* **Kernel Core:** `src/kernel/core/item-shop.ts`
* **Preload Bridge:** `src/kernel/preload.ts` (`itemShopActions`)
* **Key Capabilities:**
  * Category navigation pills (Featured, Daily, Jam Tracks, LEGO, Special Offers) with auto-scroll.
  * Modern card grid with rarity gradients, pricing, and bundle item indicators.
  * Neutral centered confirmation modal with gray button aesthetics.
  * Recipient search picker filtering current friends.
  * Customizable Gift Box selection (`DefaultBox`, `BirthdayBox`, `HeartBox`, `FestiveBox`, etc.).
  * Optimistic V-Bucks deduction updating local balance immediately upon gift dispatch.
  * Gift history and daily gift limit tracking.

### C. STW News Real-Time Alerts Stream
* **Module:** `src/kernel/core/world-info.ts`
* **Route:** `src/routes/stw-operations/current-alerts/`
* **Key Capabilities:**
  * Primary ingestion via direct HTTP stream from `https://stw.news/api/v1/missions`.
  * Public zero-authentication access ensures alerts load even when Epic servers are throttled or during session timeouts.
  * Automatic fallback to multi-account Epic Games API (`fortnite/api/game/v2/world/info`).
  * Instant highlighting of V-Bucks alerts, Upgrade Llamas, Mythic/Legendary Survivors, and Perk-UP.

### D. Daily Quest Automation & Reroll Blacklist
* **Module:** `src/kernel/core/auto-reroll.ts`
* **Route:** `src/routes/stw-operations/daily-quests/`
* **Key Capabilities:**
  * Persistent quest blacklist storage.
  * Automatic reroll of 50 V-Bucks quests to target high-yield 60/100 V-Bucks daily missions.
  * Safe profile query execution via Epic MCP `ClientQuestLogin`.

### E. Window Dimensions & CSP Protection
* **Main Process (`src/main.ts`):** Enforced `minWidth: 980`, `minHeight: 620`.
* **Renderer Header (`index.html`):** CSP configured with `img-src 'self' data: https:;` to allow dynamic Fortnite CDN images.

---

## 3. Upstream 1.13.0 Merge & Synchronization

* **Upstream Merged Commit:** `ae8e895` (`1.13.0`)
* **Integrated Features:**
  * **Games Launcher:** Epic Games launcher integration for launching games with automatic exchange code handling.
  * **Appearance Settings:** Themes, accent colors, and reorderable draggable sidebar sections (`sidebarOrder`).
  * **Japanese Localization:** Full `ja-JP` translations.
  * **User-Agent:** Synced with Fortnite client version 43.10.
* **Resolved Merge Conflicts:**
  * `src/kernel/preload.ts`: Merged `friendsActions`, `gamesLauncherActions`, and `itemShopActions`.
  * `src/components/menu/sidebar.tsx`: Integrated `/friends` and `/item-shop` inside reorderable `sections.currentAlerts`.
  * `src/routeTree.gen.ts`: Cleanly linked route tree without duplicate declarations.
  * `src/kernel/core/item-shop.ts`: Cast `stats.gift_history` for TypeScript 5.6 compatibility.

---

## 4. Mobile Companion Architecture (Aerial Mobile)

### Mobile Architecture Diagram
```
+-------------------------------------------------------+
|                    AERIAL MOBILE                      |
|             (React Native / Expo SDK 52)             |
+-------------------------------------------------------+
        |                  |                 |
+----------------+ +---------------+ +---------------+
|   STW Alerts   | | Daily Quests  | |   Item Shop   |
| (stw.news API) | | (Epic MCP)    | | & Gifting     |
+----------------+ +---------------+ +---------------+
        |                  |                 |
        +------------------+-----------------+
                           |
+-------------------------------------------------------+
|                 Epic Auth Engine                      |
|       (Device Auth / In-App Browser Exchange)         |
|             + expo-secure-store Storage               |
+-------------------------------------------------------+
```

### Module Breakdown
1. **STW Alerts (`/alerts`):**
   * Calls `https://stw.news/api/v1/missions`.
   * Displays Stonewood, Plankerton, Canny Valley, Twine Peaks, and Ventres.
   * Filter chips: [V-Bucks Only], [Llamas], [Perk-UP], [Survivors].
2. **Daily Quests (`/quests`):**
   * Uses Epic MCP `campaign` profile.
   * Displays active quests, reward icons, and remaining rerolls.
   * Re-roll action triggers `ClientQuestLogin` / `RerollDailyQuest`.
3. **Friends (`/friends`):**
   * Queries Epic Friends service.
   * Tabs: [Friends], [Requests Received], [Requests Sent].
   * Fast actions: Accept, Deny, Unfriend, Add Friend by display name.
4. **Item Shop (`/shop`):**
   * Ingests Fortnite Catalog.
   * View daily items, prices, timers.
   * Gift to friends with custom gift wrap selector.
5. **Account & Security (`/settings`):**
   * Multi-account management.
   * Persistent credential encryption via `expo-secure-store`.
