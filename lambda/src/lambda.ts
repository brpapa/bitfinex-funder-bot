import { publishAlert } from './funder/alert'
import { run } from './funder'

export const handler = async () => {
  try {
    await run()
  } catch (e) {
    console.error('got unexpected exception:', e)
    await publishAlert(`${e}`)
  }
  return { ok: true }
}
