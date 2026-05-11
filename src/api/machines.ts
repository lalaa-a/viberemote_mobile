import { supabase } from './supabase'
import type { Machine } from '../types'

export async function fetchMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .order('last_seen', { ascending: false })

  if (error) throw error
  return (data ?? []) as Machine[]
}
