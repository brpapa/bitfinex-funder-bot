import { config } from 'dotenv'
import { z } from 'zod'

config()

export const bitfinexApiKey = z.string().parse(process.env.BITFINEX_API_KEY)
export const bitfinexApiSecret = z.string().parse(process.env.BITFINEX_API_SECRET)
export const region = z.string().parse(process.env.REGION)
export const awsAccountId = z.string().parse(process.env.AWS_ACCOUNT_ID)
export const topicName = z.string().parse(process.env.TOPIC_NAME)