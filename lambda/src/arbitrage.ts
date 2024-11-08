import { getTickers } from './bitfinex/public'
import { inspect } from 'util'

const log = (obj: any) => {
  console.log(inspect(obj, { showHidden: false, depth: null, colors: true }))
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

const repeat = async (f: () => Promise<void>) => {
  while (true) {
    await f()
    await delay(2000)
  }
}

const symbolsWithBtcPair = [
  'ETH',
  'ADA',
  'AVAX:',
  'BORG:',
  'DOGE:',
  'DSH',
  'EOS',
  'ETC',
  'IOT',
  'LEO',
  'LTC',
  'MATIC:',
  'NEXO:',
  'OMG',
  'SOL',
  'TRX',
  'UOS',
  'WBT',
  'XAUT:',
  'XLM',
  'XMR',
  'XRD',
  'XRP',
  'XTZ',
  'ZEC',
]

;(async () => {
  const tickers = await getTickers([
    'tBTCUSD',
    ...symbolsWithBtcPair.map((s) => `t${s}BTC`),
    ...symbolsWithBtcPair.map((s) => `t${s}USD`),
  ])

  const r = new Map<string, number>()
  for (const t of tickers) r.set(t.symbol, t.lastPrice)

  const c = symbolsWithBtcPair.map((symbol) => {
    // 1 BTC - 75473 USD
    // 1 IOT - 0,00000158 BTC
    // 1 IOT - 0,11991 USD
    // 75473 USD -> 1 BTC -> 632.911,3924050633 IOT -> 75.892,4050632911 USD

    // TODO: olhar pro bid/ask, e volume desse bid/ask
    // TODO: desconsiderar taxa do trade

    const steps = [
      { s: 'buy:BTCUSD', p: r.get('tBTCUSD')!!, x: r.get('tBTCUSD')!! },
      {
        s: `buy:${symbol}BTC`,
        p: r.get(`t${symbol}BTC`)!!,
        x: r.get(`t${symbol}BTC`)!!,
      },
      {
        s: `sell:${symbol}USD`,
        p: r.get(`t${symbol}USD`)!!,
        x: 1 / r.get(`t${symbol}USD`)!!,
      },
    ]
    const profitInPerc = (1 - steps.reduce((acc, p) => acc * p.x, 1)) * 100

    return {
      profitInPerc: profitInPerc,
      prices: steps,
    }
  })
  c.sort((a, b) => b.profitInPerc - a.profitInPerc)
  log(c.slice(0, 1))
})()
