import { S3Client } from '@aws-sdk/client-s3'
import { region } from '../env'

const s3Client = new S3Client({ region: region })
