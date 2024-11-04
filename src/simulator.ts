// https://support.bitfinex.com/hc/en-us/articles/115004554309-How-are-interest-and-fees-calculated-when-offering-margin-funding-

const FEE = 0.15

const discountFee = (earning: number) => earning * (1 - FEE)
const toPercent = (amount: number) => (amount * 100).toFixed(2) + ' %'

// rate: % de ganho por dia
// period: qte de dias emprestado: [2,120]  (quem pegou o emprestimo pode sair antes)

const finalAmount = (rate: number, period: number, initialAmount: number) => {
  const earningRate = discountFee((rate / 100) * period)
  return initialAmount + earningRate * initialAmount
}

// re-emprestando o montante total repeat vezes
const accPercentRate = (rate: number, period: number, repeat = 1) => {
  const finalRate = discountFee((rate / 100) * period)
  const accRate = Math.pow(1 + finalRate, repeat) - 1
  return toPercent(accRate)
}

console.log(`$ ${finalAmount(0.05, 30, 10000)}`)
// console.log(accPercentRate(0.1182, 120, 1))

const dailyRates = [
  0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.15,
]

console.table(
  Object.fromEntries(
    dailyRates.map((rate) => [
      `${rate.toFixed(2)} %`,
      {
        '1m / 1m': accPercentRate(rate, 30, 1),
        '1m / 2d': accPercentRate(rate, 2, 15), // 1 mes, reinvestindo a cada 2 dias
        '4m / 4m': accPercentRate(rate, 120, 1),
        '1y / 4m': accPercentRate(rate, 120, 3), // 1 ano, reinvestindo a cada 4 meses
        '1y / 2d': accPercentRate(rate, 2, 180),
        '5y / 4m': accPercentRate(rate, 120, 15),
        '5y / 2d': accPercentRate(rate, 2, 900),
      },
    ])
  )
)
