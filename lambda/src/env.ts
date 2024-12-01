import { config } from 'dotenv'
import { z } from 'zod'

config()

export const env = z
  .object({
    BITFINEX_API_KEY: z.string(),
    BITFINEX_API_SECRET: z.string(),
    REGION: z.string(),
    AWS_ACCOUNT_ID: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY_ID: z.string(),
    ALERTS_TOPIC_NAME: z.string(),
    BUCKET_NAME: z.string(),
    ENABLE_ALERTS: z.string(),
  })
  .parse(process.env)
