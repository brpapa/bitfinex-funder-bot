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

export type Currency = 'USD' | 'EUR' | 'GBP'

// alerta é disparado se pelo menos `thresholdAmount` está parado por pelo menos `duration`
type IdleAmountAlert = {
  thresholdAmount: number
  duration: Duration
}

export type Params = {
  currency: Currency
  targetRate: (frr: number) => number
  targetPeriod: (targetRate: number) => number
  idleAmountAlert: IdleAmountAlert
}

// estratégia para sempre estar emprestado com uma taxa levemente abaixo da ultima taxa frr (com mais dias se ela for boa)
export class SimpleStrategy {
  public static async run(params: Params) {
    await new SimpleStrategy(params).run()
  }

  constructor(private params: Params) {}

  private async run() {
    console.group(`for ${this.params.currency}`)
    const { balanceIdle } = await this.checkCurrentSituation()

    await addCurrentIdleAmount(this.params.currency, balanceIdle)
    await this.alertIfAtLeastThresholdIsIdleForAtLeastTheDuration(
      this.params.idleAmountAlert
    )

    await this.repositionActiveOffers()
    console.groupEnd()
  }

  private async checkCurrentSituation() {
    const wallet = (await getWallets())
      .filter((w) => w.type === 'funding' && w.currency == this.params.currency)
      .at(0)
    const balanceTotal = wallet?.balance ?? 0

    const balanceOffered = (
      await getActiveFundingOffers(fSymbol(this.params.currency))
    ).reduce((acc, o) => acc + o.amount, 0)
    const balanceAvailable = wallet?.availableBalance ?? 0

    const balanceLended = balanceTotal - balanceOffered - balanceAvailable
    const balanceIdle = balanceTotal - balanceLended

    const fundingInfo = await getFundingInfo(fSymbol(this.params.currency))
    const yieldLend = fundingInfo.yieldLend
    const yieldLendedAprInPercentage = (yieldLend * 100 * 365).toFixed(2)

    console.log('balance idle:', balanceIdle)
    console.log(
      'balance lended:',
      balanceLended,
      `at ${yieldLend} rate by ${fundingInfo.durationLend} days (apr = ${yieldLendedAprInPercentage}%)`
    )
    return { balanceIdle }
  }

  private async alertIfAtLeastThresholdIsIdleForAtLeastTheDuration({
    thresholdAmount: thresholdIdleAmount,
    duration,
  }: IdleAmountAlert) {
    const idleAmounts = await getIdleAmountsOrderedByMostOlder(
      this.params.currency
    )
    const idleAmountsOrderedByMostRecent = idleAmounts.reverse()

    let lowestAmount = Infinity
    for (const { ts, value } of idleAmountsOrderedByMostRecent) {
      if (value < thresholdIdleAmount) break

      lowestAmount = Math.min(lowestAmount, value)

      if (ts <= sub(new Date(), duration)) {
        const durationFormatted = formatDuration(
          intervalToDuration({
            start: ts,
            end: new Date(),
          }),
          {
            delimiter: ', ',
            zero: false,
          }
        )

        await publishAlert(
          `${lowestAmount.toFixed(2)} ${
            this.params.currency
          } has been idle for at least the last ${durationFormatted}`
        )
      }
    }
  }

  private async repositionActiveOffers() {
    const ticker = await getFundingTicker(fSymbol(this.params.currency))
    const frr = parseFloat(ticker.frr.toFixed(8))

    const targetRate = parseFloat(this.params.targetRate(frr).toFixed(6))
    const aprInPercentage = (targetRate * 100 * 365).toFixed(2)

    console.group(
      `frr is ${frr}, then re-positioning active offers aiming the target: ${targetRate} rate by ${this.params.targetPeriod(
        targetRate
      )} days (apr = ${aprInPercentage}%)`
    )
    const activeOffers = await getActiveFundingOffers(
      fSymbol(this.params.currency)
    )
    await this.cancelActiveOffersWithoutTargetRate(targetRate, activeOffers)
    await this.offerAllAvailableBalance(targetRate, activeOffers)
    console.groupEnd()
  }

  private async cancelActiveOffersWithoutTargetRate(
    targetRate: number,
    activeOffers: Offer[]
  ) {
    const offersToCancel = activeOffers.filter(
      (offer) =>
        offer.rate != targetRate ||
        offer.period != this.params.targetPeriod(targetRate)
    )

    for (const offer of offersToCancel) await cancelFundingOffer(offer.id)
  }

  private async offerAllAvailableBalance(
    targetRate: number,
    activeOffers: Offer[]
  ) {
    const availableBalance = await getFundingAvailableBalance(
      this.params.currency
    )

    for (const amount of splitInParts(availableBalance, 300)) {
      await submitFundingOffer({
        type: 'LIMIT',
        symbol: fSymbol(this.params.currency),
        amount: amount.toString(),
        rate: targetRate.toString(),
        period: this.params.targetPeriod(targetRate),
      })
    }

    const remainingBalance = await getFundingAvailableBalance(
      this.params.currency
    )

    if (remainingBalance > 0 && activeOffers.length > 0) {
      const fistOffer = activeOffers[0]
      await cancelFundingOffer(fistOffer.id)

      await submitFundingOffer({
        type: 'LIMIT',
        symbol: fSymbol(this.params.currency),
        amount: (
          await getFundingAvailableBalance(this.params.currency)
        ).toString(),
        rate: targetRate.toString(),
        period: this.params.targetPeriod(targetRate),
      })
    }

    console.groupEnd()
  }
}

const fSymbol = (currency: String) => `f${currency}`

const splitInParts = (total: number, part: number) => {
  const ret: number[] = []

  const x = Math.floor(total / part)
  for (let i = 0; i < x; i++) ret.push(part)

  const rest = total % part
  if (rest > 0) {
    if (ret.length > 0) ret[ret.length - 1] += rest
    else ret.push(rest)
  }

  return ret
}
