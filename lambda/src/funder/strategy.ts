import { Duration, formatDuration, intervalToDuration, sub } from 'date-fns'
import {
  cancelFundingOffer,
  getActiveFundingOffers,
  getFundingAvailableBalance,
  getFundingInfo,
  getWallets,
  Offer,
  submitFundingOffer,
} from '../bitfinex/private'
import { getFundingTicker } from '../bitfinex/public'
import { publishAlert } from './alert'
import {
  saveCurrentIdleAmount as addCurrentIdleAmount,
  getIdleAmountsOrderedByMostOlder,
} from './idle-amount'

type Currency = 'USD' | 'EUR' | 'GBP'
const currencies: Currency[] = ['USD', 'EUR', 'GBP']

const frrOffset = (currency: Currency) =>
  ({
    USD: -0.000025,
    EUR: -0.000015,
    GBP: -0.000015,
  }[currency])

const desiredPeriod = (currency: Currency, desiredRate: number) =>
  ({
    USD: () => {
      if (desiredRate >= 0.0006) return 120
      if (desiredRate >= 0.0005) return 30
      if (desiredRate >= 0.0004) return 7
      return 2
    },
    EUR: () => {
      if (desiredRate >= 0.0008) return 120
      if (desiredRate >= 0.0007) return 30
      if (desiredRate >= 0.0006) return 7
      return 2
    },
    GBP: () => {
      if (desiredRate >= 0.00085) return 120
      if (desiredRate >= 0.00075) return 30
      if (desiredRate >= 0.00065) return 7
      return 2
    },
  }[currency]())

// estratégia para sempre estar emprestado com uma taxa levemente abaixo da ultima taxa frr (com mais dias se ela for boa)
export async function simple() {
  for (const currency of currencies) {
    console.group(`for ${currency}`)

    console.group('checking current situation...')
    const wallet = (await getWallets())
      .filter((w) => w.type === 'funding' && w.currency == currency)
      .at(0)
    const balanceTotal = wallet?.balance ?? 0

    const balanceOffered = (
      await getActiveFundingOffers(fSymbol(currency))
    ).reduce((acc, o) => acc + o.amount, 0)
    const balanceAvailable = wallet?.availableBalance ?? 0

    const balanceLended = balanceTotal - balanceOffered - balanceAvailable
    const balanceIdle = balanceTotal - balanceLended

    const fundingInfo = await getFundingInfo(fSymbol(currency))
    const yieldLendedInPercentage = (fundingInfo.yieldLend * 100).toPrecision(5)
    const yieldLendedAprInPercentage = (
      fundingInfo.yieldLend *
      100 *
      365
    ).toFixed(2)

    console.log(
      'balance lended:',
      balanceLended,
      `at ${yieldLendedInPercentage}% (apr = ${yieldLendedAprInPercentage}%) by ${fundingInfo.durationLend} days`
    )
    console.log('balance idle:', balanceIdle)

    console.groupEnd()

    await addCurrentIdleAmount(currency, balanceIdle)
    await alertIfThresholdAmountIsIdleInDuration(currency, 300, { days: 4 })

    console.group('re-positioning active offers...')
    const rate = await getDesiredRate(currency)
    const activeOffers = await getActiveFundingOffers(fSymbol(currency))
    await cancelActiveOffersWithoutDesiredRate(currency, rate, activeOffers)
    await offerAllAvailableBalance(currency, rate, activeOffers)
    console.groupEnd()

    console.groupEnd()
  }
}

// TODO: se o primeiro q esta salvo no banco nao for há tanto tempo atras nao alertar!!
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
  currency: Currency,
  desiredRate: number,
  activeOffers: Offer[]
) {
  const offersToCancel = activeOffers.filter(
    (offer) =>
      offer.rate != desiredRate ||
      offer.period != desiredPeriod(currency, desiredRate)
  )

  console.group(
    `${offersToCancel.length} of ${activeOffers.length} offers to be cancelled`
  )
  for (const offer of offersToCancel) await cancelFundingOffer(offer.id)
  console.groupEnd()
}

async function offerAllAvailableBalance(
  currency: Currency,
  desiredRate: number,
  activeOffers: Offer[]
) {
  const availableBalance = await getFundingAvailableBalance(currency)
  console.group(`balance available to offer: ${availableBalance}`)

  for (const amount of splitInParts(availableBalance, 300)) {
    await submitFundingOffer({
      type: 'LIMIT',
      symbol: fSymbol(currency),
      amount: amount.toString(),
      rate: desiredRate.toString(),
      period: desiredPeriod(currency, desiredRate),
    })
  }

  const remainingBalance = await getFundingAvailableBalance(currency)

  if (remainingBalance > 0 && activeOffers.length > 0) {
    const fistOffer = activeOffers[0]
    await cancelFundingOffer(fistOffer.id)

    await submitFundingOffer({
      type: 'LIMIT',
      symbol: fSymbol(currency),
      amount: (await getFundingAvailableBalance(currency)).toString(),
      rate: desiredRate.toString(),
      period: desiredPeriod(currency, desiredRate),
    })
  }

  console.groupEnd()
}

const getDesiredRate = async (currency: Currency) => {
  const ticker = await getFundingTicker(fSymbol(currency))
  const mostRecentFrr = ticker.frr

  const desiredRate = parseFloat(
    (mostRecentFrr + frrOffset(currency)).toFixed(5)
  )
  const desiredRateInPercentage = (desiredRate * 100).toPrecision(5)
  const aprInPercentage = (desiredRate * 100 * 365).toFixed(2)

  console.log(
    `most recent daily frr is ${mostRecentFrr}, so daily desired rate is ${desiredRate} (${desiredRateInPercentage}%) by ${desiredPeriod(
      currency,
      desiredRate
    )} days (apr = ${aprInPercentage}%)`
  )
  return desiredRate
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
