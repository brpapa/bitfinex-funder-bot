import { getCandles } from './bitfinex/public'

;(async () => {
  const candles = (await getCandles('trade:15m:tBTCUSD', 100)).reverse()
  console.log('from', candles[0].ts, 'to', candles[candles.length - 1].ts)

  const size = 15

  for (let i = size; i < candles.length; i++) {
    const candle = candles[i]

    const avgLastCloses = avg(
      candles.slice(Math.max(0, i - size), i).map((c) => c.close)
    )

    // diff = qtos % acima (+) ou abaixo (-) da media dos ultimos {size} candles
    const diff = ((candle.close - avgLastCloses) / avgLastCloses) * 100
    const x = Math.trunc(diff * 1000)

    console.log(candle.ts, x)
  }
})()

function avg(n: number[]) {
  const sum = n.reduce((acc, curr) => acc + curr, 0)
  return sum / n.length
}
