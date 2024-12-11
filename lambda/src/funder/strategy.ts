import {
  add,
  differenceInMilliseconds,
  Duration,
  format,
  formatDuration,
  intervalToDuration,
  isAfter,
  sub,
} from 'date-fns'
import {
  cancelFundingOffer,
  getActiveFundingOffers,
  getFundingAvailableBalance,
  getFundingInfo,
  getWallets,
  Offer,
  submitFundingOffer,
} from '../bitfinex/private'
import { getAksOfFundingBook, getFundingTicker } from '../bitfinex/public'
import { publishAlert } from './alert'
import {
  registerIdleAmount,
  getIdleAmountsOrderedByMostRecent,
  idleAmountTTL,
} from './idle-amount'

export type Currency = 'USD' | 'EUR' | 'GBP'

// alerta é disparado se pelo menos `thresholdAmount` está parado por pelo menos `duration`
type IdleAmountAlert = {
  thresholdAmount: number
  duration: Duration
}

export type Params = {
  currency: Currency
  bbrMinAccAskAmount: number
  targetRate: (ffr: number, bbr: number) => number
  targetPeriod: (targetRate: number) => number
  idleAmountAlert: IdleAmountAlert
}

// estratégia para sempre estar emprestado com uma taxa levemente abaixo da ultima taxa frr (com mais dias se ela for boa)
export class Strategy {
  public static async run(params: Params) {
    if (isLongerThan(params.idleAmountAlert.duration, idleAmountTTL))
      throw new Error(
        `duration of "${formatDuration(
          params.idleAmountAlert.duration
        )}" is longer than the maximum supported of "${formatDuration(
          idleAmountTTL
        )}"`
      )

    await new Strategy(params).run()
  }

  constructor(private params: Params) {}

  private async run() {
    console.group(`${this.params.currency}:`)

    const { balanceIdle } = await this.checkCurrentSituation()

    await registerIdleAmount(this.params.currency, balanceIdle)
    await this.alertIfAtLeastThresholdIsIdleForAtLeastTheDuration(
      this.params.idleAmountAlert
    )

    await this.repositionActiveOffers()

    console.log()
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

    const idleSinceAt = (
      await getIdleAmountsOrderedByMostRecent(this.params.currency)
    ).find((v) => v.value < balanceIdle)?.ts

    console.log(
      'idle:',
      balanceIdle,
      idleSinceAt ? `for ${durationTextUntilNow(idleSinceAt)}` : ''
    )
    console.log(
      'lended:',
      balanceLended,
      `at ${yieldLend} rate for ${fundingInfo.durationLend} days (apr = ${yieldLendedAprInPercentage}%)`
    )

    return { balanceIdle }
  }

  private async alertIfAtLeastThresholdIsIdleForAtLeastTheDuration({
    thresholdAmount: thresholdIdleAmount,
    duration,
  }: IdleAmountAlert) {
    const idleAmounts = await getIdleAmountsOrderedByMostRecent(
      this.params.currency
    )

    let lowestAmount = Infinity
    for (const idleAmount of idleAmounts) {
      lowestAmount = Math.min(lowestAmount, idleAmount.value)

      if (idleAmount.value < thresholdIdleAmount) break

      if (idleAmount.ts <= sub(new Date(), duration)) {
        await publishAlert(
          `${lowestAmount.toFixed(2)} ${
            this.params.currency
          } has been idle for at least the last ${durationTextUntilNow(
            idleAmount.ts
          )}`
        )
        break
      }
    }
  }

  private async repositionActiveOffers() {
    const activeOffers = await getActiveFundingOffers(
      fSymbol(this.params.currency)
    )

    const ticker = await getFundingTicker(fSymbol(this.params.currency))
    const frr = parseFloat(ticker.frr.toFixed(8))

    const bookAsks = await getAksOfFundingBook(
      fSymbol(this.params.currency),
      'P3'
    )

    const bookAsksAccAmount = bookAsks.reduce<
      { rate: number; amount: number }[]
    >((acc, ask) => {
      if (acc.length === 0) return [{ rate: ask.rate, amount: ask.amount }]
      return [
        ...acc,
        {
          rate: ask.rate,
          amount: ask.amount + acc[acc.length - 1].amount,
        },
      ]
    }, [])

    const bbr =
      bookAsksAccAmount.find((a) => a.amount >= this.params.bbrMinAccAskAmount)
        ?.rate ?? bookAsksAccAmount[bookAsksAccAmount.length - 1].rate

    const targetRate = parseFloat(this.params.targetRate(frr, bbr).toFixed(6))
    const targetPeriod = this.params.targetPeriod(targetRate)
    const aprInPercentage = (targetRate * 100 * 365).toFixed(2)

    console.group(
      activeOffers.length,
      'offers actives',
      '| frr',
      frr,
      '| bbr',
      bbr,
      `-> positioning to match the target: ${targetRate} rate for ${targetPeriod} days (apr = ${aprInPercentage}%)`
    )

    await this.cancelActiveOffersWithoutTargetRatePeriod(
      targetRate,
      targetPeriod,
      activeOffers
    )
    await this.offerAllAvailableBalance(targetRate, activeOffers)
    console.groupEnd()
  }

  private async cancelActiveOffersWithoutTargetRatePeriod(
    targetRate: number,
    targetPeriod: number,
    activeOffers: Offer[]
  ) {
    const offersToCancel = activeOffers.filter(
      (offer) => offer.rate != targetRate || offer.period != targetPeriod
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

const durationTextUntilNow = (fromTs: Date) => {
  return formatDuration(
    intervalToDuration({
      start: fromTs,
      end: new Date(),
    }),
    {
      delimiter: ', ',
      zero: false,
    }
  )
}

// returns true if duration a is longer than b
const isLongerThan = (a: Duration, b: Duration) => {
  const start = new Date(0)
  return isAfter(add(start, a), add(start, b))
}
