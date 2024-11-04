import crypto from 'crypto'
import { z } from 'zod'
import { config } from 'dotenv'
config()

// returns for current user (me): https://docs.bitfinex.com/docs/rest-auth

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
  return postPrivateEndpoint('v2/auth/w/funding/offer/submit', req)
    .then((response) => {
      const notification = z.array(z.any()).parse(response)
      return {
        ts: new Date(z.number().parse(notification[0])),
        type: z.string().parse(notification[1]),
        offer: parseOffer(z.array(z.any()).parse(notification[4])),
        status: z.enum(['SUCCESS', 'ERROR', 'FAILURE']).parse(notification[6]),
        text: z.string().parse(notification[7]),
      }
    })
    .then((response) => {
      if (response?.status !== 'SUCCESS')
        throw new Error(
          `got status ${response.status} submitting funding offer`
        )

      console.log(
        `submitted funding offer of ${req.amount} ${req.symbol} at ${req.rate} for ${req.period} days`
      )
    })
}

const parseOffer = (offer: any[]) => ({
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

async function postPrivateEndpoint(
  path: string,
  body: any = {}
): Promise<unknown> {
  const bodyJson = JSON.stringify(body)

  const nonce = (Date.now() * 1000).toString()
  const signaturePayload = `/api/${path}${nonce}${bodyJson}`
  const signature = crypto
    .createHmac('sha384', apiSecret)
    .update(signaturePayload)
    .digest('hex')

  const res = await fetch(`https://api.bitfinex.com/${path}`, {
    method: 'POST',
    body: bodyJson,
    headers: {
      'Content-Type': 'application/json',
      'bfx-nonce': nonce,
      'bfx-apikey': apiKey,
      'bfx-signature': signature,
    },
  })

  return await res.json()
}

const apiKey = z.string().parse(process.env.BITFINEX_API_KEY)
const apiSecret = z.string().parse(process.env.BITFINEX_API_SECRET)
