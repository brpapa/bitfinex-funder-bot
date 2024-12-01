import crypto from 'crypto'
import { z } from 'zod'
import { env } from '../env'

// returns for current user (me): https://docs.bitfinex.com/docs/rest-auth

export const getFundingAvailableBalance = async (currency: string) => {
  const wallets = await getWallets()
  return (
    wallets.filter((w) => w.type === 'funding' && w.currency === currency).at(0)
      ?.availableBalance ?? 0
  )
}

export const getWallets = () =>
  postPrivateEndpoint('v2/auth/r/wallets').then((response) =>
    z
      .array(z.array(z.any()))
      .parse(response)
      .map((wallet) => ({
        type: z.enum(['exchange', 'margin', 'funding']).parse(wallet[0]),
        currency: z.string().parse(wallet[1]),
        balance: z.number().parse(wallet[2]),
        availableBalance: z.number().parse(wallet[4]),
      }))
  )

export const getActiveFundingOffers = (symbol: string) =>
  postPrivateEndpoint(`v2/auth/r/funding/offers/${symbol}`).then((response) =>
    z.array(z.array(z.any())).parse(response).map(parseOffer)
  )

export const cancelFundingOffer = (id: number) =>
  postPrivateEndpoint('v2/auth/w/funding/offer/cancel', { id: id })
    .then((response) => {
      const notification = z.array(z.any()).parse(response)
      return {
        ts: new Date(z.number().parse(notification[0])),
        type: z.string().parse(notification[1]),
        offer: parseOffer(z.array(z.any()).parse(notification[4])),
        status: z.enum(['SUCCESS', 'ERROR', 'FAILURE']).parse(notification[6]),
      }
    })
    .then((response) => {
      if (response?.status !== 'SUCCESS')
        throw new Error(
          `got status ${response.status} cancelling funding offer ${id}`
        )

      console.log(
        `cancelled funding offer of ${response.offer.amount} ${response.offer.symbol} at ${response.offer.rate} for ${response.offer.period} days`
      )
    })

export const submitFundingOffer = async (req: {
  type: 'LIMIT' | 'FRRDELTAVAR' | 'FRRDELTAFIX'
  symbol: string
  amount: string
  rate: string
  period: number
}) => {
  return postPrivateEndpoint('v2/auth/w/funding/offer/submit', req).then(
    (response) => {
      const notification = z.array(z.any()).parse(response)

      if (notification[0] === 'error') {
        const error = z.string().parse(notification[2])
        if (!error.startsWith('Invalid offer: incorrect amount, minimum is'))
          throw new Error(`got error submitting funding offer: ${error}`)

        console.log(
          `fail submitting funding offer of ${req.amount} ${req.symbol} at ${req.rate} for ${req.period} days because of \"${error}\"`
        )
        return
      }

      const status = z.string().parse(notification[6])
      if (status !== 'SUCCESS')
        throw new Error(`got status submitting funding offer: ${status} `)

      console.log(
        `submitted funding offer of ${req.amount} ${req.symbol} at ${req.rate} for ${req.period} days`
      )
    }
  )
}

export type Offer = ReturnType<typeof parseOffer>

const parseOffer = (offer: unknown[]) => ({
  id: z.number().parse(offer[0]),
  symbol: z.string().parse(offer[1]),
  tsCreated: new Date(z.number().parse(offer[2])),
  tsUpdated: new Date(z.number().parse(offer[3])),
  amount: z.number().parse(offer[4]),
  type: z.enum(['LIMIT', 'FRRDELTAVAR', 'FRRDELTAFIX']).parse(offer[6]),
  status: z
    .enum(['ACTIVE', 'EXECUTED', 'PARTIALLY FILLED', 'CANCELED'])
    .parse(offer[10]),
  rate: z.number().parse(offer[14]),
  period: z.number().parse(offer[15]),
})

export const getFundingInfo = (symbol: string) =>
  postPrivateEndpoint(`v2/auth/r/info/funding/${symbol}`).then((response) => {
    const fundingInfo = z.array(z.any()).parse(response)[2]
    return {
      yieldLend: z.number().parse(fundingInfo[1]),
      durationLend: z.number().parse(fundingInfo[3]),
    }
  })

const parseCredit = (credit: unknown[]) => ({
  id: z.number().parse(credit[0]),
  type: z.string().parse(credit[1]),
  side: z.number().parse(credit[2]),
  tsCreate: new Date(z.number().parse(credit[3])),
  tsUpdate: new Date(z.number().parse(credit[4])),
  amount: z.number().parse(credit[5]),
  rate: z.number().parse(credit[11]),
  period: z.number().parse(credit[12]),
  tsOpening: new Date(z.number().parse(credit[13])),
  tsLastPayout: new Date(z.number().parse(credit[14])),
})

async function postPrivateEndpoint(
  path: string,
  body: any = {}
): Promise<unknown> {
  const bodyJson = JSON.stringify(body)

  const nonce = (Date.now() * 1000).toString()
  const signaturePayload = `/api/${path}${nonce}${bodyJson}`
  const signature = crypto
    .createHmac('sha384', env.BITFINEX_API_SECRET)
    .update(signaturePayload)
    .digest('hex')

  const res = await fetch(`https://api.bitfinex.com/${path}`, {
    method: 'POST',
    body: bodyJson,
    headers: {
      'Content-Type': 'application/json',
      'bfx-nonce': nonce,
      'bfx-apikey': env.BITFINEX_API_KEY,
      'bfx-signature': signature,
    },
  })

  return await res.json()
}
