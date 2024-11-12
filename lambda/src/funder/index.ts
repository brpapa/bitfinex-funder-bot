import { SimpleStrategy } from './strategy'

// 0.0003 = 0.9%/mês = 10.95%/ano
// 0.0004 = 1.2%/mes = 14.60%/ano
// 0.0006 = 1.8%/mes = 21.90%/ano
// 0.0008 = 2.4%/mes = 29.20%/ano
export async function run() {
  await SimpleStrategy.run({
    currency: 'USD',
    targetRate: (rate: number) => Math.max(rate - 0.000025, 0.0003),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0006) return 120
      if (targetRate >= 0.0005) return 30
      if (targetRate >= 0.0004) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { days: 5 },
    },
  })

  await SimpleStrategy.run({
    currency: 'EUR',
    targetRate: (rate: number) => Math.max(rate - 0.000015, 0.0004),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0007) return 120
      if (targetRate >= 0.0006) return 90
      if (targetRate >= 0.0005) return 30
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { hours: 18 },
    },
  })

  await SimpleStrategy.run({
    currency: 'GBP',
    targetRate: (rate: number) => Math.max(rate - 0.000015, 0.0004),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0008) return 120
      if (targetRate >= 0.0007) return 60
      if (targetRate >= 0.0006) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { hours: 12 },
    },
  })
}
