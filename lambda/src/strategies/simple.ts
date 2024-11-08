import {
  cancelFundingOffer,
  getActiveFundingOffers,
  getFundingBalanceAvailable,
  Offer,
  submitFundingOffer as submitFundingOffer,
} from '../bitfinex/private'
import { getFundingStats } from '../bitfinex/public'
import { publishAlert } from '../notification/sns'

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
    await persistIdleAmount(currency)
    await alertIfSomeAmountIsIdleForALongTime(currency)

    const rate = await getDesiredRate(currency)
    const offers = await getActiveFundingOffers(fSymbol(currency))
    await cancelActiveOffersWithoutDesiredRate(rate, offers)
    await offerAllAvailableBalance(currency, rate, offers)
    console.groupEnd()
  }
}

async function persistIdleAmount(currency: Currency) {
  // TODO: pegar saldo disponivel + soma de todas ofertas ativas, salvar esse valor + timestamp da execucao no s3 (manter só ultimos 180d)
}

async function alertIfSomeAmountIsIdleForALongTime(currency: Currency) {
  // TODO: alertar se o minimo do money idle nos ultimas 24h é maior que 150
  // await publishAlert(`150 ${currency} has been idle for 5 days`)
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
