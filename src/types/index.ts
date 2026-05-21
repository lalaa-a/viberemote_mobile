export type RiskLevel    = 'low' | 'medium' | 'high' | 'critical'
export type ToolName     = 'Bash' | 'Write' | 'Edit' | 'MultiEdit'
export type DisplayType  = 'bash' | 'write' | 'edit' | 'multi_edit' | 'unknown'
export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'timeout'
  | 'cli_pending'

export interface DiffHunk {
  type:     'add' | 'remove' | 'context'
  content:  string
  line_old?: number
  line_new?: number
}

export interface FileDiff {
  type:         string
  file_path:    string
  language:     string
  stats:        { added: number; removed: number }
  hunks:        DiffHunk[]
  is_new_file?: boolean
  word_diff?:   Array<{ value: string; added: boolean; removed: boolean }>
  // multi_edit_diff only
  files?:       FileDiff[]
  file_count?:  number
  edit_count?:  number
  grand_stats?: { added: number; removed: number }
  // edit_diff only
  edits?:       FileDiff[]
}

export interface Machine {
  id:        string
  user_id:   string
  label:     string
  is_online: boolean
  last_seen: string
  created_at: string
}

export interface PendingRequest {
  id:             string
  user_id:        string
  machine_id:     string
  session_id:     string | null
  tool_name:      ToolName
  display_type:   DisplayType
  summary:        string
  risk_level:     RiskLevel
  risk_reason:    string
  risk_icon:      string
  files_affected: string[]
  diff:           FileDiff | null
  command:        string | null
  file_path:      string | null
  new_content:    string | null
  old_content:    string | null
  raw_input:      Record<string, unknown> | null
  status:         RequestStatus
  response_mode:  string
  decided_at:     string | null
  decided_by:     'pc' | 'mobile' | null
  created_at:     string
  // joined
  machines?:      Pick<Machine, 'id' | 'label' | 'is_online'>
}

// QR code payload scanned from the desktop app
export interface QRPayload {
  machineId:   string
  apiKey:      string
  supabaseUrl: string
  apiUrl:      string
}

// ── Sessions / agents ─────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'idle' | 'finished'

export interface AgentSession {
  id:               string
  machine_id:       string
  machine_label:    string
  session_id:       string
  cwd:              string | null
  status:           SessionStatus
  pending_count:    number
  last_activity_at: string
  started_at:       string
}

export interface MobileCommand {
  id:           string
  session_id:   string | null
  prompt:       string
  status:       'pending' | 'delivered' | 'cancelled'
  created_at:   string
  delivered_at: string | null
}

export interface FsNode {
  name:      string
  path:      string
  type:      'file' | 'dir'
  size?:     number
  children?: FsNode[] | null
}

// ── Navigation param types ─────────────────────────────────────────────────────

export type RootStackParamList = {
  SignIn: undefined
  App:    undefined
}

export type TabParamList = {
  RequestsTab:  undefined
  SessionsTab:  undefined
  MachinesTab:  undefined
  HistoryTab:   undefined
}

export type RequestsStackParamList = {
  RequestsList:  undefined
  RequestDetail: { id: string }
}

export type SessionsStackParamList = {
  SessionsList:  undefined
  SessionDetail: { sessionId: string; machineLabel: string; cwd: string | null }
  RequestDetail: { id: string }
  FileBrowser:   { sessionId: string; machineLabel: string; cwd: string | null }
  PromptCompose: { sessionId: string; prefill?: string }
}
