// public endpoints: https://docs.bitfinex.com/docs/rest-public

import { z } from 'zod'

export const getCandles = (candle: string) =>
  getPublicEndpoint(`v2/candles/${candle}/hist`).then((response) =>
    z
      .array(z.array(z.any()))
      .parse(response)
      .map((candle) => ({
        ts: new Date(z.number().parse(candle[0])),
        high: z.number().parse(candle[3]),
        low: z.number().parse(candle[4]),
      }))
  )

export const getFundingStats = (
  symbol: string,
  params: { start?: number; end?: number } = {}
) =>
  getPublicEndpoint(`v2/funding/stats/${symbol}/hist`, params).then(
    (response) =>
      z
        .array(z.array(z.any()))
        .parse(response)
        .map((stat) => ({
          ts: new Date(z.number().parse(stat[0])),
          frrDaily: z.number().parse(stat[3]) * 365,
          avgPeriod: z.number().parse(stat[4]),
        }))
  )

async function getPublicEndpoint<T>(
  path: string,
  params: Record<string, any> = {}
): Promise<unknown> {
  const hasParams = params !== undefined && Object.values(params).length > 0
  const paramsQueryString = hasParams
    ? `?${new URLSearchParams(params).toString()}`
    : ''

  const res = await fetch(
    `https://api-pub.bitfinex.com/${path}${paramsQueryString}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  return await res.json()
}
