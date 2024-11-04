import { basic } from './strategies/basic'

export const handler = async () => {
  try {
    await basic()
  } catch (e) {
    console.error(e)
    throw e
  }
  return { ok: true }
}
