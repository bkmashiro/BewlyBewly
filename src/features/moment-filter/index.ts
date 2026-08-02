import type { MomentQuickActionLabels } from './quick-actions'
import type { MomentFilterCandidate, MomentFilterRule, MomentRuleAction } from './types'
import { createBrowserMomentFilterStorage } from './browser-storage'
import { createMomentFilterController } from './controller'

let cleanupActiveController: (() => void) | undefined

function quickActionLabels(language: string): MomentQuickActionLabels {
  const normalized = language.toLowerCase()
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
    return {
      allow: '永遠允許此作者',
      error: '儲存失敗',
      hide: '隱藏此作者',
      open: 'BewlyBewly 動態過濾快捷操作',
    }
  }
  if (normalized.startsWith('zh')) {
    return {
      allow: '始终允许此作者',
      error: '保存失败',
      hide: '隐藏此作者',
      open: 'BewlyBewly 动态过滤快捷操作',
    }
  }
  return {
    allow: 'Always allow this author',
    error: 'Could not save the rule',
    hide: 'Hide this author',
    open: 'BewlyBewly Moments filter actions',
  }
}

function createRuleId(): string {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sameQuickRule(rule: MomentFilterRule, action: MomentRuleAction, field: 'authorName' | 'authorUid', value: string): boolean {
  if (typeof rule.value !== 'string')
    return false
  const valuesMatch = rule.caseSensitive
    ? rule.value === value
    : rule.value.toLowerCase() === value.toLowerCase()
  return rule.action === action
    && rule.field === field
    && rule.operator === 'equals'
    && valuesMatch
}

export function setupMomentFilter(): () => void {
  cleanupActiveController?.()
  cleanupActiveController = undefined

  if (window.top !== window || window.location.origin !== 'https://t.bilibili.com')
    return () => {}

  const storage = createBrowserMomentFilterStorage()
  const addQuickRule = async (candidate: MomentFilterCandidate, action: MomentRuleAction): Promise<void> => {
    const field = candidate.authorUid ? 'authorUid' : 'authorName'
    const value = candidate.authorUid ?? candidate.authorName
    if (!value)
      return

    const { value: settings } = await storage.load()
    const rules = settings.rules.map(rule => ({ ...rule, value: Array.isArray(rule.value) ? [...rule.value] : rule.value }))
    const existing = rules.find(rule => sameQuickRule(rule, action, field, value))
    if (existing)
      existing.enabled = true
    else
      rules.unshift({ id: createRuleId(), enabled: true, action, field, operator: 'equals', value, createdAt: Date.now() })
    await storage.save({ ...settings, rules })
  }

  const controller = createMomentFilterController({
    window,
    document,
    storage,
    quickActions: {
      labels: quickActionLabels(document.documentElement.lang || navigator.language),
      onAction: addQuickRule,
    },
    onDiagnostic: (message) => {
      if (import.meta.env.DEV)
        console.warn(`[BewlyBewly moment filter] ${message}`)
    },
  })
  const cleanup = () => {
    controller.cleanup()
    if (cleanupActiveController === cleanup)
      cleanupActiveController = undefined
  }
  cleanupActiveController = cleanup
  return cleanup
}
