import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Duration, sub } from 'date-fns'
import { z } from 'zod'
import { bucketName, region } from '../env'

const s3Client = new S3Client({ region: region })
const s3ObjKey = (currency: string) => `idle-amounts-${currency}.json`
const idleAmountTTL: Duration = { months: 3 }

type IdleAmount = z.infer<typeof IdleAmountsType>[0]
const IdleAmountsType = z.array(
  z.object({
    ts: z.coerce.date(),
    value: z.number(),
  })
)

export async function registerIdleAmount(currency: string, amount: number) {
  const prev = await getIdleAmountsOrderedByMostOlder(currency)
  const newest = [...prev, { ts: new Date(), value: amount }].filter(
    ({ ts }) => ts > sub(new Date(), idleAmountTTL)
  )

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3ObjKey(currency),
      Body: JSON.stringify(newest),
    })
  )
}

export async function getIdleAmountsOrderedByMostOlder(
  currency: string
): Promise<IdleAmount[]> {
  try {
    const output = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3ObjKey(currency),
      })
    )
    const json = await output.Body?.transformToString()
    if (!json) throw new Error('no body from s3')

    return IdleAmountsType.parse(JSON.parse(json))
  } catch (e: any) {
    if (e?.name == 'NoSuchKey') return []
    throw e
  }
}

export async function getIdleAmountsOrderedByMostRecent(
  currency: string
): Promise<IdleAmount[]> {
  return (await getIdleAmountsOrderedByMostOlder(currency)).reverse()
}
