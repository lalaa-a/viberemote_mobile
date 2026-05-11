import { supabase } from './supabase'
import type { PendingRequest } from '../types'

export async function fetchPendingRequests(): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('pending_requests')
    .select('*, machines(id, label, is_online)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PendingRequest[]
}

export async function fetchRequestById(id: string): Promise<PendingRequest> {
  const { data, error } = await supabase
    .from('pending_requests')
    .select('*, machines(id, label, is_online)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as PendingRequest
}

export async function fetchHistory(limit = 50): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('pending_requests')
    .select('*, machines(id, label, is_online)')
    .in('status', ['approved', 'denied', 'timeout', 'cli_pending'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as PendingRequest[]
}

export async function decideRequest(
  id:       string,
  decision: 'approved' | 'denied'
): Promise<void> {
  const { error } = await supabase
    .from('pending_requests')
    .update({
      status:     decision,
      decided_at: new Date().toISOString(),
      decided_by: 'mobile',
    })
    .eq('id', id)
    .eq('status', 'pending')   // guard: only update if still pending

  if (error) throw error
}

export async function batchDecide(
  ids:      string[],
  decision: 'approved' | 'denied'
): Promise<void> {
  const { error } = await supabase.rpc('batch_decide', {
    request_ids: ids,
    decision,
  })
  if (error) throw error
}
