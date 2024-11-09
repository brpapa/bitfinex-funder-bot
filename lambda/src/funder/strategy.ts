import {
  Duration,
  formatDuration,
  intervalToDuration,
  sub,
  subHours,
} from 'date-fns'
import {
  cancelFundingOffer,
  getActiveFundingOffers,
  getFundingBalanceAvailable,
  Offer,
  submitFundingOffer as submitFundingOffer,
} from '../bitfinex/private'
import { getFundingStats } from '../bitfinex/public'
import { publishAlert } from './alert'
import {
  getIdleAmountsOrderedByMostOlder,
  saveCurrentIdleAmount as addCurrentIdleAmount,
} from './idle-amount'

type Currency = 'USD' | 'EUR'
const currencies: Currency[] = ['USD', 'EUR']

const frrOffset = (currency: Currency) =>
  ({
    USD: -0.000025,
    EUR: -0.000065,
  }[currency])

// estratégia para sempre estar emprestado com uma taxa levemente abaixo da ultima taxa frr (com mais dias se ela for boa)
export async function simple() {
  for (const currency of currencies) {
    console.group(`for ${currency}`)
    const activeOffers = await getActiveFundingOffers(fSymbol(currency))
    await persistIdleAmount(currency, activeOffers)
    await alertIfThresholdAmountIsIdleInDuration(currency, 300, { days: 2 })

    const rate = await getDesiredRate(currency)
    await cancelActiveOffersWithoutDesiredRate(rate, activeOffers)
    await offerAllAvailableBalance(currency, rate, activeOffers)
    console.groupEnd()
  }
}

async function persistIdleAmount(currency: Currency, activeOffers: Offer[]) {
  const offersAmount = activeOffers.reduce((acc, o) => acc + o.amount, 0)
  const walletAmount = await getFundingBalanceAvailable(fSymbol(currency))

  const idleAmount = offersAmount + walletAmount
  console.log(`idle amount is ${idleAmount}`)

  await addCurrentIdleAmount(currency, idleAmount)
}

async function alertIfThresholdAmountIsIdleInDuration(
  currency: Currency,
  thresholdAmount: number,
  duration: Duration
) {
  const idleAmountsBetweenDuration = (
    await getIdleAmountsOrderedByMostOlder(currency)
  ).filter((a) => a.ts >= sub(new Date(), duration))

  if (idleAmountsBetweenDuration.length === 0) return

  const lowestAmount = idleAmountsBetweenDuration.reduce(
    (acc, { value }) => (value < acc ? value : acc),
    Infinity
  )
  const olderIdleAmount = idleAmountsBetweenDuration[0]

  if (lowestAmount < thresholdAmount) return

  const durationFormatted = formatDuration(
    intervalToDuration({
      start: olderIdleAmount.ts,
      end: new Date(),
    }),
    {
      delimiter: ', ',
      zero: false,
    }
  )

  await publishAlert(
    `at least ${lowestAmount.toFixed(
      2
    )} ${currency} has been idle during the last ${durationFormatted}`
  )
}

async function cancelActiveOffersWithoutDesiredRate(
  desiredRate: number,
  activeOffers: Offer[]
) {
  const offersToCancel = activeOffers.filter(
    (offer) => offer.rate != desiredRate
  )

  console.group(`${offersToCancel.length} offers to cancel`)
  for (const offer of offersToCancel) await cancelFundingOffer(offer.id)
  console.groupEnd()
}

async function offerAllAvailableBalance(
  currency: Currency,
  desiredRate: number,
  activeOffers: Offer[]
) {
  const availableAmount = await getFundingBalanceAvailable(fSymbol(currency))
  console.group(`${availableAmount} ${currency} available to offer`)

  for (const amount of splitInParts(availableAmount, 300)) {
    await submitFundingOffer({
      type: 'LIMIT',
      symbol: fSymbol(currency),
      amount: amount.toString(),
      rate: desiredRate.toString(),
      period: periodFromRate(desiredRate),
    })
  }

  const remainingAmount = await getFundingBalanceAvailable(fSymbol(currency))

  if (remainingAmount > 0 && activeOffers.length > 0) {
    const fistOffer = activeOffers[0]
    await cancelFundingOffer(fistOffer.id)

    await submitFundingOffer({
      type: 'LIMIT',
      symbol: fSymbol(currency),
      amount: (await getFundingBalanceAvailable(fSymbol(currency))).toString(),
      rate: desiredRate.toString(),
      period: periodFromRate(desiredRate),
    })
  }

  console.groupEnd()
}

const getDesiredRate = async (currency: Currency) => {
  const stats = await getFundingStats(fSymbol(currency))
  const mostRecentFrr = stats[0].frrDaily
  const desiredRate = parseFloat(
    (mostRecentFrr + frrOffset(currency)).toFixed(5)
  )
  console.log(
    `most recent frr is ${mostRecentFrr}, so desire rate is ${desiredRate}`
  )
  return desiredRate
}

const periodFromRate = (rate: number) => {
  if (rate >= 0.0006) return 120
  if (rate >= 0.0005) return 30
  if (rate >= 0.0004) return 7
  return 2
}

const fSymbol = (currency: String) => `f${currency}`

const splitInParts = (total: number, part: number) => {
  const ret: number[] = []

  const x = Math.floor(total / part)
  for (let i = 0; i < x; i++) ret.push(part)

  const rest = total % part
  if (rest > 0) ret.push(rest)

  return ret
}
