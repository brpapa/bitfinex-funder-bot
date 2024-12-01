import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { env } from '../env'

const snsClient = new SNSClient({
  region: env.REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY_ID,
  },
})

export async function publishAlert(description: string) {
  if (!env.ENABLE_ALERTS) {
    console.log(`disabled ${publishAlert.name}(\"${description}\")`)
    return
  }

  const data = await snsClient.send(
    new PublishCommand({
      Message: `Bitfinex Bot Alert:\n\n${description}`,
      TopicArn: `arn:aws:sns:${env.REGION}:${env.AWS_ACCOUNT_ID}:${env.ALERTS_TOPIC_NAME}`,
    })
  )

  if (data.$metadata.httpStatusCode !== 200)
    throw new Error(
      `fail publishing alert to sns topic, got http status code ${data.$metadata.httpStatusCode}`
    )

  console.log(`alert sent: \"${description}\"`)
}
