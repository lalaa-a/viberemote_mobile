import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  Alert, Platform, StatusBar,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFileTree } from '../../hooks/useFileTree'
import { GradientBackground } from '../../components/GradientBackground'
import { BackButton } from '../../components/ui/BackButton'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../../constants/colors'
import type { SessionsStackParamList, FsNode } from '../../types'

type Route = RouteProp<SessionsStackParamList, 'FileBrowser'>
type Nav   = NativeStackNavigationProp<SessionsStackParamList>

type FlatItem = { node: FsNode; depth: number }

function flattenTree(nodes: FsNode[], depth: number, expanded: Set<string>): FlatItem[] {
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
  const insets     = useSafeAreaInsets()
  const { sessionId, cwd } = route.params

  const { tree, error, loadPath, loading } = useFileTree(sessionId)
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set())
  const [loadingPath, setLoadingPath] = useState<string | null>(null)

  useEffect(() => { loadPath('.') }, [])

  useEffect(() => {
    if (!tree) return
    const topDirs = tree.filter(n => n.type === 'dir').map(n => n.path)
    setExpanded(new Set(topDirs))
  }, [tree !== null])

  const handleNodePress = useCallback(async (item: FlatItem) => {
    const { node } = item
    if (node.type === 'file') return

    if (node.children === null) {
      setLoadingPath(node.path)
      await loadPath(node.path)
      setLoadingPath(null)
      setExpanded(prev => new Set([...prev, node.path]))
    } else {
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(node.path)) next.delete(node.path)
        else next.add(node.path)
        return next
      })
    }
  }, [loadPath])

  const handleNodeLongPress = useCallback((node: FsNode) => {
    Alert.alert(node.name, node.path, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use in prompt',
        onPress: () => {
          navigation.navigate('Chat', {
            ...route.params,
            sessionId:       route.params.sessionId,
            machineLabel:    route.params.machineLabel,
            cwd:             route.params.cwd,
            machineIsOnline: true,
            harness:         'claude-code' as any,
            status:          'idle' as any,
            prefill:         `Look at ${node.path} and `,
          } as any)
        },
      },
    ])
  }, [navigation])

  const flatItems = tree ? flattenTree(tree, 0, expanded) : []

  function renderItem({ item }: { item: FlatItem }) {
    const { node, depth } = item
    const isDir      = node.type === 'dir'
    const isExpanded = isDir && expanded.has(node.path)
    const isLoading  = loadingPath === node.path

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleNodePress(item)}
        onLongPress={() => handleNodeLongPress(node)}
        activeOpacity={0.6}
        delayLongPress={400}
      >
        {/* Depth connector guides — the "tree" rails */}
        {Array.from({ length: depth }).map((_, i) => (
          <View key={i} style={styles.guide} />
        ))}

        <Ionicons
          name={isDir ? (isExpanded ? 'chevron-down' : 'chevron-forward') : 'document-text-outline'}
          size={14}
          color={isDir ? DarkColors.online : DarkColors.textTertiary}
          style={styles.nodeIcon}
        />
        <Text style={[styles.nodeName, isDir && styles.dirName]} numberOfLines={1}>
          {node.name}
        </Text>
        {isLoading && <ActivityIndicator size="small" color={DarkColors.online} />}
        {!isDir && node.size !== undefined && (
          <Text style={styles.fileSize}>{formatSize(node.size)}</Text>
        )}
        {isDir && node.children === null && !isLoading && (
          <Text style={styles.lazyHint}>tap</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top bar — BackButton + path pill (matches Chat / Details) */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton />
        <View style={styles.pathPill}>
          <Ionicons name="folder-open-outline" size={14} color={DarkColors.textSecondary} />
          <Text style={styles.pathText} numberOfLines={1}>{cwd ?? '~'}/</Text>
          {loading && <ActivityIndicator size="small" color={DarkColors.online} />}
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadPath('.')}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading && !tree ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DarkColors.online} />
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

      {/* Hint bar */}
      <View style={[styles.hintBar, { paddingBottom: insets.bottom + Spacing.px12 }]}>
        <Ionicons name="finger-print-outline" size={12} color={DarkColors.textTertiary} />
        <Text style={styles.hintText}>Long-press any item to use path in a prompt</Text>
      </View>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: DarkColors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px10,
    paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px8,
  },
  pathPill: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.px8,
    paddingHorizontal: Spacing.px16, borderRadius: Radius.full,
    backgroundColor: DarkColors.surfaceRaised,
  },
  pathText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.monoSmall, color: DarkColors.textSecondary },

  list: { paddingTop: Spacing.px8, paddingBottom: Spacing.px16, paddingHorizontal: Spacing.px16 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.px10, gap: Spacing.px8,
    borderBottomWidth: 1, borderColor: DarkColors.border,
  },
  // One vertical rail per depth level → tree connector look
  guide: { width: 16, alignSelf: 'stretch', borderLeftWidth: 1, borderLeftColor: DarkColors.border, marginLeft: 4 },
  nodeIcon: { width: 16, textAlign: 'center' },
  nodeName: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.monoSmall, color: DarkColors.textSecondary },
  dirName: { fontWeight: '600', color: DarkColors.textPrimary },
  fileSize: { fontFamily: FontFamily.mono, fontSize: FontSize.microLabel, color: DarkColors.textTertiary, minWidth: 48, textAlign: 'right' },
  lazyHint: { fontSize: FontSize.microLabel, color: DarkColors.textTertiary, fontStyle: 'italic' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.px12, padding: Spacing.px32 },
  loadingText: { fontSize: FontSize.label, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans },
  emptyText: { fontSize: FontSize.label, color: DarkColors.textTertiary, fontStyle: 'italic' },
  errorText: { fontSize: FontSize.label, color: DarkColors.danger, textAlign: 'center', fontFamily: FontFamily.googleSans },
  retryBtn: {
    paddingHorizontal: Spacing.px20, paddingVertical: Spacing.px8,
    borderRadius: Radius.full, borderWidth: 1, borderColor: DarkColors.danger + '80',
  },
  retryText: { fontSize: FontSize.label, fontWeight: '600', color: DarkColors.danger, fontFamily: FontFamily.googleSans },

  hintBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.px4,
    paddingTop: Spacing.px12,
    backgroundColor: DarkColors.surface,
    borderTopWidth: 1, borderTopColor: DarkColors.border,
  },
  hintText: { fontSize: FontSize.microLabel, color: DarkColors.textTertiary, fontStyle: 'italic' },
})
