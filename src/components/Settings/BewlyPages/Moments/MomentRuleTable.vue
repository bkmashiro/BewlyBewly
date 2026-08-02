<script setup lang="ts">
import type { MomentFilterRule } from '~/features/moment-filter/types'

const props = defineProps<{
  rules: MomentFilterRule[]
}>()
const emit = defineEmits<{
  delete: [rule: MomentFilterRule]
  edit: [rule: MomentFilterRule]
  toggle: [rule: MomentFilterRule]
}>()

function displayValue(rule: MomentFilterRule): string {
  return Array.isArray(rule.value) ? rule.value.join(', ') : rule.value
}
</script>

<template>
  <div v-if="props.rules.length === 0" class="empty-state" role="status">
    {{ $t('settings.moment_filter_empty') }}
  </div>

  <ul v-else class="rule-list" :aria-label="$t('settings.moment_filter_rules')">
    <li v-for="(rule, index) in props.rules" :key="rule.id" class="rule-row">
      <div class="rule-summary">
        <div class="rule-badges">
          <span class="action-badge" :class="`action-${rule.action}`">
            {{ $t(`settings.moment_filter_action_${rule.action}`) }}
          </span>
          <span>{{ $t(`settings.moment_filter_field_${rule.field}`) }}</span>
          <span>{{ $t(`settings.moment_filter_operator_${rule.operator}`) }}</span>
        </div>
        <strong class="rule-value">{{ displayValue(rule) }}</strong>
        <p v-if="rule.note" class="rule-note">
          {{ rule.note }}
        </p>
      </div>

      <div class="rule-actions">
        <label class="enabled-control" :for="`moment-rule-toggle-${index}`">
          <input
            :id="`moment-rule-toggle-${index}`"
            type="checkbox"
            :checked="rule.enabled"
            @change="emit('toggle', rule)"
          >
          <span>{{ $t('settings.moment_filter_rule_enabled') }}</span>
        </label>
        <Button
          size="small"
          type="tertiary"
          :aria-label="$t('common.operation.edit')"
          :title="$t('common.operation.edit')"
          @click="emit('edit', rule)"
        >
          <template #left>
            <i i-mingcute:edit-2-line />
          </template>
        </Button>
        <Button
          size="small"
          type="tertiary"
          :aria-label="$t('common.operation.delete')"
          :title="$t('common.operation.delete')"
          @click="emit('delete', rule)"
        >
          <template #left>
            <i i-mingcute:delete-2-line />
          </template>
        </Button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  list-style: none;
}

.rule-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-fill-1);
}

.rule-summary {
  min-width: 0;
}

.rule-badges,
.rule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.rule-badges span {
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--bew-text-2);
  background: var(--bew-fill-2);
  font-size: 12px;
}

.rule-badges .action-hide {
  color: var(--bew-error-color);
}

.rule-badges .action-allow {
  color: var(--bew-success-color);
}

.rule-value,
.rule-note {
  display: block;
  overflow-wrap: anywhere;
  margin-top: 7px;
}

.rule-note {
  color: var(--bew-text-2);
  font-size: 13px;
}

.enabled-control {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 12px;
}

.empty-state {
  padding: 32px 16px;
  border: 1px dashed var(--bew-border-color);
  border-radius: var(--bew-radius);
  color: var(--bew-text-2);
  text-align: center;
}

@media (max-width: 680px) {
  .rule-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .rule-actions {
    justify-content: flex-start;
  }
}
</style>
