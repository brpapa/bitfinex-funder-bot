import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { awsAccountId, region, alertsTopicName, enableAlerts } from '../env'

const snsClient = new SNSClient({ region: region })

export async function publishAlert(description: string) {
  if (!enableAlerts) {
    console.log(`disabled ${publishAlert.name}(\"${description}\")`)
    return
  }

  const data = await snsClient.send(
    new PublishCommand({
      Message: `Bitfinex Bot Alert:\n\n${description}`,
      TopicArn: `arn:aws:sns:${region}:${awsAccountId}:${alertsTopicName}`,
    })
  )

  if (data.$metadata.httpStatusCode !== 200)
    throw new Error(
      `fail publishing alert to sns topic, got http status code ${data.$metadata.httpStatusCode}`
    )

  console.log(`alert sent: \"${description}\"`)
}
