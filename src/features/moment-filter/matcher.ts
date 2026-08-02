import type {
  MomentFilterCandidate,
  MomentFilterMatchResult,
  MomentFilterRule,
  MomentFilterSettingsV1,
  MomentRuleAction,
} from './types'

interface CompiledRule {
  id: string
  action: MomentRuleAction
  matches: (candidate: MomentFilterCandidate) => boolean
}

function normalize(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase()
}

function candidateValues(
  candidate: MomentFilterCandidate,
  field: MomentFilterRule['field'],
): string[] {
  switch (field) {
    case 'authorUid':
      return candidate.authorUid === undefined ? [] : [candidate.authorUid]
    case 'authorName':
      return candidate.authorName === undefined ? [] : [candidate.authorName]
    case 'content':
      return candidate.content === undefined ? [] : [candidate.content]
    case 'dynamicType':
      return candidate.dynamicType === undefined ? [] : [candidate.dynamicType]
    case 'commercialSignal':
      return candidate.commercialSignals ?? []
  }
}

function compileRule(rule: MomentFilterRule): CompiledRule {
  const caseSensitive = rule.caseSensitive ?? false
  const normalizedValues = (Array.isArray(rule.value) ? rule.value : [rule.value])
    .map(value => normalize(value, caseSensitive))
  const acceptedValues = new Set(normalizedValues)

  let regex: RegExp | undefined
  if (rule.operator === 'regex' && typeof rule.value === 'string') {
    try {
      regex = new RegExp(rule.value, caseSensitive ? '' : 'i')
    }
    catch {
      regex = undefined
    }
  }

  return {
    id: rule.id,
    action: rule.action,
    matches(candidate): boolean {
      const values = candidateValues(candidate, rule.field)
      if (values.length === 0)
        return false

      switch (rule.operator) {
        case 'equals':
          return normalizedValues.length === 1
            && values.some(value => normalize(value, caseSensitive) === normalizedValues[0])
        case 'contains':
          return normalizedValues.length === 1
            && values.some(value => normalize(value, caseSensitive).includes(normalizedValues[0]))
        case 'regex':
          return regex !== undefined && values.some(value => regex.test(value))
        case 'in': {
          return values.some(value => acceptedValues.has(normalize(value, caseSensitive)))
        }
      }
    },
  }
}

export function compileMomentFilter(
  settings: MomentFilterSettingsV1,
): (candidate: MomentFilterCandidate) => MomentFilterMatchResult {
  if (!settings.enabled)
    return () => ({ action: 'none', matchedRuleIds: [] })

  const compiledRules = settings.rules
    .filter(rule => rule.enabled)
    .map(compileRule)
  const allowRules = compiledRules.filter(rule => rule.action === 'allow')
  const hideRules = compiledRules.filter(rule => rule.action === 'hide')

  return (candidate) => {
    const matchedAllowRuleIds = allowRules
      .filter(rule => rule.matches(candidate))
      .map(rule => rule.id)
    if (matchedAllowRuleIds.length > 0) {
      return {
        action: 'allow',
        matchedRuleIds: matchedAllowRuleIds,
      }
    }

    const matchedHideRuleIds = hideRules
      .filter(rule => rule.matches(candidate))
      .map(rule => rule.id)
    const shouldHide = settings.mode === 'all'
      ? hideRules.length > 0 && matchedHideRuleIds.length === hideRules.length
      : matchedHideRuleIds.length > 0

    return {
      action: shouldHide ? 'hide' : 'none',
      matchedRuleIds: matchedHideRuleIds,
    }
  }
}
