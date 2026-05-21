import { createMMKV } from 'react-native-mmkv'
import type { Machine, PendingRequest, AgentSession, MobileCommand, FsNode } from '../types'

const storage = createMMKV({ id: 'machine-credentials' })

export interface MachineCredentials {
  machineId:   string
  apiKey:      string
  supabaseUrl: string
  apiUrl:      string
}

// ── Credential storage ─────────────────────────────────────────────────────────

export function getCredentials(): MachineCredentials | null {
  const raw = storage.getString('credentials')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function saveCredentials(creds: MachineCredentials): void {
  storage.set('credentials', JSON.stringify(creds))
}

export function clearCredentials(): void {
  storage.remove('credentials')
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

function getHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type':      'application/json',
    'x-machine-api-key': apiKey,
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const creds = getCredentials()
  if (!creds) throw new Error('Not authenticated')

  const url = `${creds.apiUrl}${path}`
  const res  = await fetch(url, {
    ...options,
    headers: { ...getHeaders(creds.apiKey), ...(options?.headers ?? {}) },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error ?? `Request failed (${res.status})`)
  }

  return res.json() as Promise<T>
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function verifyCredentials(creds: MachineCredentials): Promise<Machine> {
  const res = await fetch(`${creds.apiUrl}/mobile/machine`, {
    headers: getHeaders(creds.apiKey),
  })
  if (!res.ok) throw new Error('Invalid credentials — scan the QR again.')
  return res.json() as Promise<Machine>
}

// ── Requests ───────────────────────────────────────────────────────────────────

export function fetchPendingRequests(): Promise<PendingRequest[]> {
  return request<PendingRequest[]>('/mobile/requests')
}

export function fetchRequestById(id: string): Promise<PendingRequest> {
  return request<PendingRequest>(`/mobile/requests/${id}`)
}

export function fetchHistory(limit = 50): Promise<PendingRequest[]> {
  return request<PendingRequest[]>(`/mobile/history?limit=${limit}`)
}

export function decideRequest(
  requestId: string,
  decision:  'approved' | 'denied'
): Promise<void> {
  return request<void>('/mobile/decide', {
    method: 'POST',
    body:   JSON.stringify({ requestId, decision }),
  })
}

// ── Machines ───────────────────────────────────────────────────────────────────

export function fetchMachines(): Promise<Machine[]> {
  return request<Machine[]>('/mobile/machines')
}

// ── Push tokens ────────────────────────────────────────────────────────────────

export function registerPushToken(token: string, platform: string): Promise<void> {
  return request<void>('/mobile/push-token', {
    method: 'POST',
    body:   JSON.stringify({ token, platform }),
  })
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export function fetchSessions(): Promise<AgentSession[]> {
  return request<AgentSession[]>('/mobile/sessions')
}

export function fetchSessionRequests(sessionId: string): Promise<PendingRequest[]> {
  return request<PendingRequest[]>(`/mobile/sessions/${encodeURIComponent(sessionId)}/requests`)
}

// ── Prompt injection ───────────────────────────────────────────────────────────

export function sendPrompt(prompt: string, sessionId?: string): Promise<{ id: string }> {
  return request<{ id: string }>('/mobile/prompt', {
    method: 'POST',
    body:   JSON.stringify({ prompt, sessionId }),
  })
}

export function fetchPrompts(): Promise<MobileCommand[]> {
  return request<MobileCommand[]>('/mobile/prompts')
}

export function cancelPrompt(id: string): Promise<void> {
  return request<void>(`/mobile/prompt/${id}`, { method: 'DELETE' })
}

// ── File tree ──────────────────────────────────────────────────────────────────

export function requestFileTree(
  path: string,
  sessionId?: string
): Promise<{ requestId: string }> {
  return request<{ requestId: string }>('/mobile/fs/request', {
    method: 'POST',
    body:   JSON.stringify({ path, sessionId }),
  })
}

export function pollFileTreeResult(requestId: string): Promise<{
  status: 'pending' | 'ready' | 'error'
  result?: FsNode[]
  error?:  string
}> {
  return request(`/mobile/fs/result/${requestId}`)
}
