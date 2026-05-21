import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  Alert, Platform,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack'
import { useFileTree } from '../../hooks/useFileTree'
import { Colors, Spacing, Radius, FontSize } from '../../constants/colors'
import type { SessionsStackParamList, FsNode } from '../../types'

type Route = RouteProp<SessionsStackParamList, 'FileBrowser'>
type Nav   = NativeStackNavigationProp<SessionsStackParamList>

// Flatten the nested tree into a renderable list, respecting expanded state
type FlatItem = { node: FsNode; depth: number }

function flattenTree(
  nodes: FsNode[],
  depth: number,
  expanded: Set<string>
): FlatItem[] {
  const result: FlatItem[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.type === 'dir' && expanded.has(node.path) && node.children) {
      result.push(...flattenTree(node.children, depth + 1, expanded))
    }
  }
  return result
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileBrowserScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { sessionId, cwd } = route.params

  const { tree, error, loadPath, loading } = useFileTree(sessionId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingPath, setLoadingPath] = useState<string | null>(null)

  useEffect(() => {
    loadPath('.')
  }, [])

  // Auto-expand top-level dirs when first tree loads
  useEffect(() => {
    if (!tree) return
    const topLevelDirs = tree
      .filter(n => n.type === 'dir')
      .map(n => n.path)
    setExpanded(new Set(topLevelDirs))
  }, [tree !== null])  // only on first load

  const handleNodePress = useCallback(async (item: FlatItem) => {
    const { node } = item
    if (node.type === 'file') return

    if (node.children === null) {
      // Not loaded yet — fetch this subtree
      setLoadingPath(node.path)
      await loadPath(node.path)
      setLoadingPath(null)
      // Expand the node once loaded
      setExpanded(prev => new Set([...prev, node.path]))
    } else {
      // Toggle expand/collapse
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(node.path)) next.delete(node.path)
        else next.add(node.path)
        return next
      })
    }
  }, [loadPath])

  const handleNodeLongPress = useCallback((node: FsNode) => {
    Alert.alert(
      node.name,
      node.path,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use in prompt',
          onPress: () => navigation.navigate('PromptCompose', {
            sessionId,
            prefill: `Look at ${node.path} and `,
          }),
        },
      ]
    )
  }, [sessionId, navigation])

  const flatItems = tree ? flattenTree(tree, 0, expanded) : []

  function renderItem({ item }: { item: FlatItem }) {
    const { node, depth } = item
    const isDir     = node.type === 'dir'
    const isExpand  = isDir ? expanded.has(node.path) : false
    const hasChildren = isDir && node.children !== null
    const isLoading = loadingPath === node.path

    return (
      <TouchableOpacity
        style={[styles.row, { paddingLeft: Spacing.lg + depth * 16 }]}
        onPress={() => handleNodePress(item)}
        onLongPress={() => handleNodeLongPress(node)}
        activeOpacity={0.6}
        delayLongPress={400}
      >
        <Text style={styles.nodeIcon}>
          {isDir ? (isExpand ? '▼' : '▶') : '·'}
        </Text>
        <Text style={[styles.nodeName, isDir && styles.dirName]} numberOfLines={1}>
          {node.name}
        </Text>
        {isLoading && (
          <ActivityIndicator size="small" color={Colors.primary} style={styles.rowLoader} />
        )}
        {!isDir && node.size !== undefined && (
          <Text style={styles.fileSize}>{formatSize(node.size)}</Text>
        )}
        {isDir && node.children === null && !isLoading && (
          <Text style={styles.lazyHint}>tap to load</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Path header */}
      <View style={styles.pathBar}>
        <Text style={styles.pathText} numberOfLines={1}>
          {cwd ?? '~'}/
        </Text>
        {loading && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadPath('.')}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading && !tree ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading file tree…</Text>
        </View>
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={item => item.node.path}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Empty directory</Text>
            </View>
          }
        />
      )}

      <View style={styles.hint}>
        <Text style={styles.hintText}>Long-press any item → use path in prompt</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.bgSecondary,
  },
  pathBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
    backgroundColor:   Colors.bgPrimary,
    borderBottomWidth: 0.5,
    borderColor:       Colors.border,
  },
  pathText: {
    fontFamily: 'monospace',
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    flex:       1,
  },
  list: {
    paddingVertical: Spacing.sm,
    paddingBottom:   Spacing.xxxl,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingRight:    Spacing.lg,
    paddingVertical: Spacing.sm,
    gap:             Spacing.sm,
    borderBottomWidth: 0.5,
    borderColor:     Colors.borderLight,
  },
  nodeIcon: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
    width:     12,
    textAlign: 'center',
  },
  nodeName: {
    flex:      1,
    fontFamily:'monospace',
    fontSize:  FontSize.sm,
    color:     Colors.textPrimary,
  },
  dirName: {
    fontWeight: '600',
    color:      Colors.primary,
  },
  fileSize: {
    fontFamily: 'monospace',
    fontSize:   FontSize.xs,
    color:      Colors.textTertiary,
    minWidth:   50,
    textAlign:  'right',
  },
  lazyHint: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
    fontStyle: 'italic',
  },
  rowLoader: {
    marginLeft: Spacing.xs,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.sm,
    padding:        Spacing.xxxl,
  },
  loadingText: {
    fontSize:  FontSize.sm,
    color:     Colors.textSecondary,
  },
  emptyText: {
    fontSize:  FontSize.sm,
    color:     Colors.textTertiary,
  },
  error: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.md,
    padding:        Spacing.xxxl,
  },
  errorText: {
    fontSize:  FontSize.sm,
    color:     Colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
    borderRadius:      Radius.md,
    backgroundColor:   Colors.primary,
  },
  retryText: {
    fontSize:   FontSize.sm,
    fontWeight: '600',
    color:      Colors.white,
  },
  hint: {
    paddingVertical:   Spacing.sm,
    alignItems:        'center',
    borderTopWidth:    0.5,
    borderColor:       Colors.border,
    backgroundColor:   Colors.bgPrimary,
  },
  hintText: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
})
