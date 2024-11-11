import { SimpleStrategy } from './strategy'

export async function run() {
  await SimpleStrategy.run({
    currency: 'USD',
    targetRate: (frr: number) => Math.max(frr - 0.000025, 0.0003), // target rate de pelo menos 10,95% ao ano
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0006) return 120
      if (targetRate >= 0.0005) return 30
      if (targetRate >= 0.0004) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { days: 1 },
    },
  })

  await SimpleStrategy.run({
    currency: 'EUR',
    targetRate: (frr: number) => Math.max(frr - 0.000015, 0.0004),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0007) return 120
      if (targetRate >= 0.0006) return 30
      if (targetRate >= 0.0005) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { hours: 18 },
    },
  })

  await SimpleStrategy.run({
    currency: 'GBP',
    targetRate: (frr: number) => Math.max(frr - 0.000015, 0.0004),
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0008) return 120
      if (targetRate >= 0.0007) return 30
      if (targetRate >= 0.0006) return 7
      return 2
    },
    idleAmountAlert: {
      thresholdAmount: 200,
      duration: { hours: 12 },
    },
  })
}
