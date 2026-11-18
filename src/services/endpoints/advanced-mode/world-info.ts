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
  try {
    const response = await axios.get('https://stw.news', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    })

    const html =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data)

    // Next.js streams RSC chunks inside `self.__next_f.push([1,"..."])`
    // Concatenate all chunks together to reconstruct the full stream
    const pattern = /self\.__next_f\.push\(\[\d+,\s*"([\s\S]*?)"\]\)/g
    let fullStream = ''
    let match: RegExpExecArray | null
    while ((match = pattern.exec(html)) !== null) {
      try {
        fullStream += JSON.parse(`"${match[1]}"`)
      } catch {
        fullStream += match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
    }

    const theaterIdx = fullStream.indexOf('{"theaters":')
    if (theaterIdx !== -1) {
      let depth = 0
      let endIdx = -1
      for (let i = theaterIdx; i < fullStream.length; i++) {
        if (fullStream[i] === '{') depth++
        else if (fullStream[i] === '}') {
          depth--
          if (depth === 0) {
            endIdx = i + 1
            break
          }
        }
      }

      if (endIdx !== -1) {
        const parsed = JSON.parse(
          fullStream.slice(theaterIdx, endIdx)
        ) as WorldInfoData

        if (
          parsed.missionAlerts &&
          parsed.theaters &&
          parsed.missions &&
          parsed.theaters.length > 0 &&
          parsed.missionAlerts.length > 0
        ) {
          return parsed
        }
      }
    }
  } catch {
    //
  }

  return null
}
