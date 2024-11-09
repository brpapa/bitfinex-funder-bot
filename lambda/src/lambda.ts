import { publishAlert } from './notification/sns'
import { simple } from './strategies/simple'

export const handler = async () => {
  try {
    await simple()
  } catch (e) {
    console.error('got unexpected exception:', e)
    await publishAlert(`${e}`)
  }
  return { ok: true }
}
