import { publishAlert } from './funder/alert'
import { simple } from './funder/strategy'

export const handler = async () => {
  try {
    await simple()
  } catch (e) {
    console.error('got unexpected exception:', e)
    await publishAlert(`${e}`)
  }
  return { ok: true }
}
