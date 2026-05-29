import { createClient } from './client'

let cached: string | null | undefined = undefined

export async function getHouseholdId(): Promise<string | null> {
  if (cached !== undefined) return cached
  const supabase = createClient()
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .single()
  const id: string | null = (data as { household_id: string } | null)?.household_id ?? null
  cached = id
  return id
}
