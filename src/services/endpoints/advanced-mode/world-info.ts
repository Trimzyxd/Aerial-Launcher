import type { WorldInfoData } from '../../../types/services/advanced-mode/world-info'

import axios from 'axios'
import { baseGameService } from '../../config/base-game'

export function getWorldInfoData({
  accessToken,
}: {
  accessToken: string
}) {
  return baseGameService.get<WorldInfoData>('/world/info', {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}

export async function getWorldInfoDataFromStwNews(): Promise<WorldInfoData | null> {
  // 1. Try Next.js RSC stream
  try {
    const response = await axios.get('https://stw.news', {
      headers: {
        RSC: '1',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    })
    const text =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data)
    const theaterIdx = text.indexOf('{"theaters":')
    if (theaterIdx !== -1) {
      let depth = 0
      let endIdx = -1
      for (let i = theaterIdx; i < text.length; i++) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') {
          depth--
          if (depth === 0) {
            endIdx = i + 1
            break
          }
        }
      }
      if (endIdx !== -1) {
        const parsed = JSON.parse(
          text.slice(theaterIdx, endIdx)
        ) as WorldInfoData
        if (
          parsed.missionAlerts?.length > 0 &&
          parsed.theaters?.length > 0 &&
          parsed.missions?.length > 0
        ) {
          return parsed
        }
      }
    }
  } catch {
    //
  }

  // 2. Fallback to HTML parsing if RSC stream format is not returned
  try {
    const htmlRes = await axios.get('https://stw.news', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    })
    const html = typeof htmlRes.data === 'string' ? htmlRes.data : ''
    const pattern = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(html)) !== null) {
      const rawChunk = match[1]
      if (rawChunk.includes('missionAlerts')) {
        const unescaped = rawChunk.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        const theaterIdx = unescaped.indexOf('{"theaters":')
        if (theaterIdx !== -1) {
          let depth = 0
          let endIdx = -1
          for (let i = theaterIdx; i < unescaped.length; i++) {
            if (unescaped[i] === '{') depth++
            else if (unescaped[i] === '}') {
              depth--
              if (depth === 0) {
                endIdx = i + 1
                break
              }
            }
          }
          if (endIdx !== -1) {
            const parsed = JSON.parse(
              unescaped.slice(theaterIdx, endIdx)
            ) as WorldInfoData
            if (
              parsed.missionAlerts?.length > 0 &&
              parsed.theaters?.length > 0 &&
              parsed.missions?.length > 0
            ) {
              return parsed
            }
          }
        }
      }
    }
  } catch {
    //
  }

  return null
}
