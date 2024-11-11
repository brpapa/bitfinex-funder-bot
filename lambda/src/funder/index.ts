import { SimpleStrategy } from './strategy'

export async function run() {
  await SimpleStrategy.run({
    currency: 'USD',
    targetRate: (frr: number) => frr - 0.000025,
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0006) return 120
      if (targetRate >= 0.0005) return 30
      if (targetRate >= 0.0004) return 7
      return 2
    },
    idleAlert: {
      thresholdIdleAmount: 300,
      duration: { days: 1 },
    },
  })

  await SimpleStrategy.run({
    currency: 'EUR',
    targetRate: (frr: number) => frr - 0.000015,
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0007) return 120
      if (targetRate >= 0.0006) return 30
      if (targetRate >= 0.0005) return 7
      return 2
    },
    idleAlert: {
      thresholdIdleAmount: 300,
      duration: { hours: 18 },
    },
  })

  await SimpleStrategy.run({
    currency: 'GBP',
    targetRate: (frr: number) => frr - 0.000015,
    targetPeriod: (targetRate: number) => {
      if (targetRate >= 0.0008) return 120
      if (targetRate >= 0.0007) return 30
      if (targetRate >= 0.0006) return 7
      return 2
    },
    idleAlert: {
      thresholdIdleAmount: 300,
      duration: { hours: 12 },
    },
  })
}
