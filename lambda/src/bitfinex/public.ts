// public endpoints: https://docs.bitfinex.com/docs/rest-public

import { z } from 'zod'

// ordered by the lowest rate
export const getAksOfFundingBook = (symbol: string, precision: string) =>
  getPublicEndpoint(`v2/book/${symbol}/${precision}`, { len: 100 }).then(
    (response) =>
      z
        .array(z.array(z.any()))
        .parse(response)
        .map((b) => ({
          rate: z.number().parse(b[0]),
          period: z.number().parse(b[1]),
          count: z.number().parse(b[2]),
          amount: z.number().parse(b[3]),
        }))
        .filter((b) => b.amount > 0)
  )

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

export const getTradingTickers = (symbols: string[]) =>
  getPublicEndpoint('v2/tickers', { symbols }).then((response) =>
    z
      .array(z.array(z.any()))
      .parse(response)
      .map((ticker) => ({
        symbol: z.string().parse(ticker[0]),
        bid: z.number().parse(ticker[1]),
        bid25Size: z.number().parse(ticker[2]),
        ask: z.number().parse(ticker[3]),
        ask25Size: z.number().parse(ticker[4]),
        lastPrice: z.number().parse(ticker[7]),
      }))
  )

export const getFundingTicker = (symbol: string) =>
  getPublicEndpoint(`v2/ticker/${symbol}`).then((response) => {
    const ticker = z.array(z.any()).parse(response)

    return {
      frr: z.number().parse(ticker[0]),
      bid: z.number().parse(ticker[1]),
      bidPeriod: z.number().parse(ticker[2]),
      ask: z.number().parse(ticker[4]),
      askPeriod: z.number().parse(ticker[5]),
      frrAmountAvaiable: z.number().parse(ticker[15]),
    }
  })

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
