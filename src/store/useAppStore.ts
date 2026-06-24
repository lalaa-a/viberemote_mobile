import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

interface AppState {
  // Supabase user session — kept in sync via onAuthStateChange
  session:    Session | null
  setSession: (s: Session | null) => void

  // Device ID persisted after first registration
  deviceId:    string | null
  setDeviceId: (id: string | null) => void

  // Which machine to filter chats by (null = all)
  selectedMachineId:    string | null
  setSelectedMachineId: (id: string | null) => void

  // Toast notification
  toast:       { message: string; type: 'success' | 'error' } | null
  showToast:   (message: string, type?: 'success' | 'error') => void
  clearToast:  () => void
}

export const useAppStore = create<AppState>((set) => ({
  session:    null,
  setSession: (session) => set({ session }),

  deviceId:    null,
  setDeviceId: (deviceId) => set({ deviceId }),

  selectedMachineId:    null,
  setSelectedMachineId: (id) => set({ selectedMachineId: id }),

  toast:      null,
  showToast:  (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3000)
  },
  clearToast: () => set({ toast: null }),
}))
