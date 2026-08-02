import type { MomentPromotionActionLabels } from './promotion-actions'
import type { MomentQuickActionLabels } from './quick-actions'
import type { MomentFilterCandidate, MomentFilterRule, MomentRuleAction } from './types'
import { createBrowserMomentFilterStorage } from './browser-storage'
import { createMomentFilterController } from './controller'
import { createBrowserPromotionLearningStorage } from './promotion-browser-storage'
import { normalizePromotionKeywords, upsertPromotionSignature } from './promotion-learning'

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

function localizedPromotionReason(reason: string, language: string): string {
  const normalized = language.toLowerCase()
  const traditional = normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')
  const simplified = normalized.startsWith('zh') && !traditional
  if (reason.startsWith('signature '))
    return traditional ? '符合已確認嘅學習規則' : simplified ? '命中已确认的学习规则' : 'Matched a learned promotion signature'

  const explicitSignal = reason.match(/^explicit commercial signal: (.+)$/u)?.[1]
  if (explicitSignal) {
    const names: Record<string, [string, string, string]> = {
      'goods-card': ['商品卡片', '商品卡片', 'goods card'],
      'ad-card': ['廣告卡片', '广告卡片', 'advertising card'],
      'paid-promotion-label': ['付費推廣標記', '付费推广标记', 'paid-promotion label'],
    }
    const name = names[explicitSignal] ?? [explicitSignal, explicitSignal, explicitSignal]
    return traditional ? `明確商業訊號：${name[0]}` : simplified ? `明确商业信号：${name[1]}` : `Explicit commercial signal: ${name[2]}`
  }

  const heuristicGroup = reason.match(/^heuristic feature group: (.+)$/u)?.[1]
  if (heuristicGroup) {
    const names: Record<string, [string, string, string]> = {
      disclosure: ['包含推廣披露字眼', '包含推广披露字样', 'promotion disclosure wording'],
      transaction: ['包含交易導向字眼', '包含交易导向字样', 'transaction-oriented wording'],
      urgency: ['包含限時或稀缺字眼', '包含限时或稀缺字样', 'urgency or scarcity wording'],
      'external link': ['包含外部連結', '包含外部链接', 'external link'],
    }
    const name = names[heuristicGroup] ?? [heuristicGroup, heuristicGroup, heuristicGroup]
    return traditional ? name[0] : simplified ? name[1] : name[2]
  }
  return reason
}

function promotionActionLabels(language: string): MomentPromotionActionLabels {
  const normalized = language.toLowerCase()
  const formatReason = (reason: string) => localizedPromotionReason(reason, language)
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
    return {
      suspected: '疑似推廣',
      confirmed: '已確認推廣',
      show: '顯示本則',
      hide: '收起本則',
      learn: '加入學習庫',
      confirm: '確認學習',
      cancel: '取消',
      noKeywords: '沒有可選關鍵字',
      error: '儲存失敗',
      formatReason,
    }
  }
  if (normalized.startsWith('zh')) {
    return {
      suspected: '疑似推广',
      confirmed: '已确认推广',
      show: '显示本条',
      hide: '收起本条',
      learn: '加入学习库',
      confirm: '确认学习',
      cancel: '取消',
      noKeywords: '没有可选关键词',
      error: '保存失败',
      formatReason,
    }
  }
  return {
    suspected: 'Suspected promotion',
    confirmed: 'Confirmed promotion',
    show: 'Show',
    hide: 'Collapse',
    learn: 'Add to learning library',
    confirm: 'Confirm',
    cancel: 'Cancel',
    noKeywords: 'No keyword suggestions',
    error: 'Could not save',
    formatReason,
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
  const promotionStorage = createBrowserPromotionLearningStorage()
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

  const addPromotionSignature = async (candidate: MomentFilterCandidate, keywords: string[]): Promise<void> => {
    if (!candidate.authorUid || !/^\d+$/u.test(candidate.authorUid))
      return
    const normalizedKeywords = normalizePromotionKeywords(keywords)
    if (normalizedKeywords.length === 0)
      return
    const { value } = await promotionStorage.load()
    await promotionStorage.save(upsertPromotionSignature(value, {
      id: createRuleId(),
      authorUid: candidate.authorUid,
      keywords: normalizedKeywords,
      domains: [],
      commercialSignals: [],
      createdAt: Date.now(),
    }))
  }

  const controller = createMomentFilterController({
    window,
    document,
    storage,
    quickActions: {
      labels: quickActionLabels(document.documentElement.lang || navigator.language),
      onAction: addQuickRule,
    },
    promotion: {
      storage: promotionStorage,
      labels: promotionActionLabels(document.documentElement.lang || navigator.language),
      onLearn: addPromotionSignature,
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
