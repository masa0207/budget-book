import { createClient } from './client'

let cached: string | null | undefined = undefined

export async function getHouseholdId(): Promise<string | null> {
  if (cached !== undefined) return cached
  const supabase = createClient()
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .single()
  cached = data?.household_id ?? null
  return cached
}
