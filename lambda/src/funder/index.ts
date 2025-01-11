import { Strategy } from './strategy'

// 0.0002 = 0.6%/mês = 7.30%/ano
// 0.0003 = 0.9%/mês = 10.95%/ano
// 0.0004 = 1.2%/mes = 14.60%/ano
// 0.0005 = 1.5%/mes = 18.25%/ano
// 0.0006 = 1.8%/mes = 21.90%/ano
// 0.0008 = 2.4%/mes = 29.20%/ano
export async function run() {
  await Strategy.run({
    currency: 'USD',
    bbrMinAccAskAmount: 5e6,
    targetRate: (frr: number, bbr: number) =>
      Math.max(Math.max(frr, bbr) - 0.000025, 0.0002),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0008) return 120
      if (targetRate >= 0.0007) return 60
      if (targetRate >= 0.0005) return 15
      if (targetRate >= 0.0004) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { days: 30 },
    },
  })

  await Strategy.run({
    currency: 'EUR',
    bbrMinAccAskAmount: 2e5,
    targetRate: (frr: number, bbr: number) =>
      Math.max(Math.max(frr, bbr) - 0.00003, 0.00035),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0007) return 120
      if (targetRate >= 0.0006) return 90
      if (targetRate >= 0.0005) return 30
      return 14
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { days: 14 },
    },
  })

  await Strategy.run({
    currency: 'GBP',
    bbrMinAccAskAmount: 1e4,
    targetRate: (frr: number, bbr: number) =>
      Math.max(Math.max(frr, bbr) - 0.000015, 0.0004),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0008) return 120
      if (targetRate >= 0.0007) return 60
      if (targetRate >= 0.0006) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { days: 30 },
    },
  })
}
