import {
  cancelFundingOffer,
  getActiveFundingOffers,
  getWallets,
  submitFundingOffer,
} from '../bitfinex/private'
import { getFundingStats } from '../bitfinex/public'

const symbol = 'fUSD'

// estratégia para sempre estar emprestado com uma taxa levemente abaixo da ultima taxa frr (com mais dias se ela for boa)
export async function basic() {
  const desiredRate = await getDesiredRate()
  await cancelAllActiveOffersWithRateNotDesired(desiredRate)
  await offerAllAvailableBalance(desiredRate)
}

async function offerAllAvailableBalance(desiredRate: number) {
  const wallets = await getWallets()
  const availableUSD = wallets.find(
    (w) => w.type === 'funding' && w.currency === 'USD'
  )!.availableBalance
  console.log('available usd balance:', availableUSD)

  for (const amount of splitInParts(availableUSD, 300)) {
    if (amount < 150) continue // because its not permitted offer with amount < 150

    await submitFundingOffer({
      type: 'LIMIT',
      symbol: symbol,
      amount: amount.toString(),
      rate: desiredRate.toString(),
      period: periodFromRate(desiredRate),
    })
  }
}

async function cancelAllActiveOffersWithRateNotDesired(desiredRate: number) {
  const offers = await getActiveFundingOffers(symbol)

  const offersToCancel = offers.filter((offer) => offer.rate != desiredRate)
  console.log(`${offersToCancel.length} offers to cancel`)

  for (const offer of offersToCancel) await cancelFundingOffer(offer.id)
}

const getDesiredRate = async () => {
  const stats = await getFundingStats(symbol)
  const mostRecentFrr = stats[0].frrDaily
  console.log('most recent frr:', mostRecentFrr)

  const offerRate = mostRecentFrr - 0.00002
  console.log('desired rate to offer:', offerRate)

  return offerRate
}

const periodFromRate = (rate: number) => {
  if (rate >= 0.0006) return 120
  if (rate >= 0.0005) return 30
  if (rate >= 0.0004) return 7
  return 2
}

const splitInParts = (total: number, part: number) => {
  const ret: number[] = []

  const x = Math.floor(total / part)
  for (let i = 0; i < x; i++) ret.push(part)

  const rest = total % part
  if (rest > 0) ret.push(rest)

  return ret
}
