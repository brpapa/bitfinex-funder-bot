import { config } from 'dotenv'
import path from 'path'
import { z } from 'zod'

const base = {
  BITFINEX_API_KEY: z.string().min(1),
  BITFINEX_API_SECRET: z.string().min(1),
  REGION: z.string().min(1),
  AWS_ACCOUNT_ID: z.string().min(1),
  ALERTS_TOPIC_NAME: z.string().min(1),
  BUCKET_NAME: z.string().min(1),
  ENABLE_ALERTS: z.enum(['true', 'false']).transform((v) => v === 'true'),
}

const prodSchema = z.object({
  ...base,
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SESSION_TOKEN: z.string().min(1),
})

const localSchema = z.object({
  ...base,
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY_ID: z.string().min(1),
})

const loadEnvVars = () => {
  const NODE_ENV = z.enum(['prod', 'local']).parse(process.env.NODE_ENV)
  config({ path: path.resolve(process.cwd(), `.env.${NODE_ENV}`) })

  switch (NODE_ENV) {
    case 'local':
      return { NODE_ENV: NODE_ENV, ...localSchema.parse(process.env) }
    case 'prod':
      return { NODE_ENV: NODE_ENV, ...prodSchema.parse(process.env) }
  }
}

export const env = loadEnvVars()

export const awsCredentials =
  env.NODE_ENV === 'prod'
    ? undefined // because aws-sdk automatically resolve
    : {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY_ID,
      }
