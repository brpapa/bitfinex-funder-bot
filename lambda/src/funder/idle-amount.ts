import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { bucketName, region } from '../env'
import { z } from 'zod'
import { Duration, sub } from 'date-fns'

const s3Client = new S3Client({ region: region })
const s3ObjKey = (currency: string) => `idle-amounts-${currency}.json`
const ttlDuration: Duration = { years: 2 }

type IdleAmount = z.infer<typeof IdleAmountsType>[0]
const IdleAmountsType = z.array(
  z.object({
    ts: z.coerce.date(),
    value: z.number(),
  })
)

export async function saveCurrentIdleAmount(currency: string, amount: number) {
  const prev = await getIdleAmountsOrderedByMostOlder(currency)
  const newest = [...prev, { ts: new Date(), value: amount }].filter(
    ({ ts }) => ts > sub(new Date(), ttlDuration)
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
