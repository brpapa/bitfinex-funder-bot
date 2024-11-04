import {
  cancelFundingOffer,
  getActiveFundingOffers,
  getBalanceAvailable,
  getWallets,
  submitFundingOffer,
} from '../bitfinex/private'
import { getFundingStats } from '../bitfinex/public'

// TODO: me mandar sms se der qualquer exception

// TODO: me mandar sms se pelo menos 150 usd está há mais de 5 dias sem conseguir emprestar
//    pega saldo disponivel + total de todas ofertas ativas, guarda esse valor a cada 1h, a cada execucao se o minimo desse valor nos ultimos 3 dias é maior que 150 alertar

type Currency = 'USD' | 'EUR'
const currencies: Currency[] = ['USD', 'EUR']

const frrOffset = (currency: Currency) =>
  ({
    USD: -0.000025,
    EUR: -0.000065,
  }[currency])

// estratégia para sempre estar emprestado com uma taxa levemente abaixo da ultima taxa frr (com mais dias se ela for boa)
export async function basic() {
  for (const currency of currencies) {
    console.log(`running for ${currency}`)
    const desiredRate = await getDesiredRate(currency)
    await cancelActiveOffersWithoutDesiredRate(currency, desiredRate)
    await offerAllAvailableBalance(currency, desiredRate)
  }
}

async function offerAllAvailableBalance(
  currency: Currency,
  desiredRate: number
) {
  const availableAmountToOffer = await getBalanceAvailable(
    symbol(currency),
    'FUNDING'
  )
  console.log(`${availableAmountToOffer} ${currency} available to offer`)

  for (const amount of splitInParts(availableAmountToOffer, 300)) {
    await submitFundingOffer({
      type: 'LIMIT',
      symbol: symbol(currency),
      amount: amount.toString(),
      rate: desiredRate.toString(),
      period: periodFromRate(desiredRate),
    })
  }
}

async function cancelActiveOffersWithoutDesiredRate(
  currency: Currency,
  desiredRate: number
) {
  const offers = await getActiveFundingOffers(symbol(currency))

  const offersToCancel = offers.filter((offer) => offer.rate != desiredRate)
  console.log(`${offersToCancel.length} offers to cancel`)

  for (const offer of offersToCancel) await cancelFundingOffer(offer.id)
}

const getDesiredRate = async (currency: Currency) => {
  const stats = await getFundingStats(symbol(currency))
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

const symbol = (currency: String) => `f${currency}`

const splitInParts = (total: number, part: number) => {
  const ret: number[] = []

  const x = Math.floor(total / part)
  for (let i = 0; i < x; i++) ret.push(part)

  const rest = total % part
  if (rest > 0) ret.push(rest)

  return ret
}
