import { cookies } from 'next/headers'
import { normalizeLang, type Lang } from './shared'

export async function getLang(): Promise<Lang> {
  const cookieStore = await cookies()
  const c = cookieStore.get('hog_lang')?.value
  return normalizeLang(c)
}
