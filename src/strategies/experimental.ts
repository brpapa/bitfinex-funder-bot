import { getCandles } from '../bitfinex/public'

// ESTRATEGIA PRA TENTAR BUSCAR MAIOR TAXA MAS ESPERANDO MAIS
// para todo o saldo disponivel que ainda nao esta emprestado
//   ofertar na taxa mais alta dos que bateu 80% das vezes nos ultimos 10 dias, deixar oferta nela por até 7 dias
//   ordernar o high do maior pro menor e pegar o por exemplo quinto maior
// para todas as ofertas abertas
//   se esta aberta ha muito tempo, cancelar e ofertar na taxa frr

export async function experimental() {
  const candles = await getCandles('trade:12h:fUSD:a30:p2:p30')
  console.log(candles[0].ts, candles[candles.length - 1].ts)
  candles.sort((a, b) => b.high - a.high)
  console.log(candles)
}
