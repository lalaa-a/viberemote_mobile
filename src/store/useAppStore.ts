import { create } from 'zustand'

interface AppState {
  // Which machine to filter requests by (null = all)
  selectedMachineId: string | null
  setSelectedMachineId: (id: string | null) => void

  // Toast notification
  toast: { message: string; type: 'success' | 'error' } | null
  showToast: (message: string, type?: 'success' | 'error') => void
  clearToast: () => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedMachineId: null,
  setSelectedMachineId: (id) => set({ selectedMachineId: id }),

  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3000)
  },
  clearToast: () => set({ toast: null }),
}))
