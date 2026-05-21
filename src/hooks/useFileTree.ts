import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { requestFileTree, pollFileTreeResult } from '../api/server'
import type { FsNode } from '../types'

export function useFileTree(sessionId: string) {
  const [requestId, setRequestId] = useState<string | null>(null)
  const [tree,      setTree]      = useState<FsNode[] | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const { data } = useQuery({
    queryKey:        ['fs', requestId],
    queryFn:         () => pollFileTreeResult(requestId!),
    enabled:         !!requestId,
    staleTime:       0,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 2_000 : false,
  })

  useEffect(() => {
    if (!data) return
    if (data.status === 'ready') {
      setTree(data.result ?? null)
      setRequestId(null)
    } else if (data.status === 'error') {
      setError(data.error ?? 'Unknown error')
      setRequestId(null)
    }
  }, [data])

  async function loadPath(path: string) {
    setTree(null)
    setError(null)
    try {
      const { requestId: id } = await requestFileTree(path, sessionId)
      setRequestId(id)
    } catch (err: any) {
      setError(err.message ?? 'Failed to request file tree')
    }
  }

  return { tree, error, loadPath, loading: !!requestId }
}
