<script setup lang="ts">
import type {
  MomentFilterRule,
  MomentRuleAction,
  MomentRuleField,
  MomentRuleOperator,
} from '~/features/moment-filter/types'
import {
  allowedMomentRuleOperators,
  MomentFilterSettingsValidationError,
  parseMomentFilterSettings,
} from '~/features/moment-filter/validation'

const props = defineProps<{
  rule?: MomentFilterRule
}>()
const emit = defineEmits<{
  cancel: []
  save: [rule: MomentFilterRule]
}>()

const fields: MomentRuleField[] = ['authorUid', 'authorName', 'content', 'dynamicType', 'commercialSignal']
const actions: MomentRuleAction[] = ['hide', 'allow']
const field = ref<MomentRuleField>(props.rule?.field ?? 'authorUid')
const operator = ref<MomentRuleOperator>(props.rule?.operator ?? 'equals')
const action = ref<MomentRuleAction>(props.rule?.action ?? 'hide')
const enabled = ref(props.rule?.enabled ?? true)
const valueText = ref(Array.isArray(props.rule?.value) ? props.rule.value.join('\n') : (props.rule?.value ?? ''))
const note = ref(props.rule?.note ?? '')
const caseSensitive = ref(props.rule?.caseSensitive ?? false)
const errorMessage = ref('')

function createUuid(): string {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const instanceId = createUuid()
const actionId = `moment-rule-action-${instanceId}`
const fieldId = `moment-rule-field-${instanceId}`
const operatorId = `moment-rule-operator-${instanceId}`
const valueId = `moment-rule-value-${instanceId}`
const noteId = `moment-rule-note-${instanceId}`
const enabledId = `moment-rule-enabled-${instanceId}`
const caseSensitiveId = `moment-rule-case-${instanceId}`

const operators = computed(() => allowedMomentRuleOperators(field.value))
const usesListValue = computed(() => operator.value === 'in')
const supportsCaseSensitivity = computed(() => field.value === 'authorName' || field.value === 'content')

watch(field, () => {
  if (!operators.value.includes(operator.value))
    operator.value = operators.value[0]
})

function createRuleId(): string {
  return props.rule?.id ?? createUuid()
}

function parseValue(): string | string[] {
  if (usesListValue.value) {
    return valueText.value
      .split(/[\n,]/)
      .map(value => value.trim())
      .filter(Boolean)
  }
  return valueText.value.trim()
}

function handleSubmit(): void {
  const rule: MomentFilterRule = {
    id: createRuleId(),
    enabled: enabled.value,
    action: action.value,
    field: field.value,
    operator: operator.value,
    value: parseValue(),
    caseSensitive: supportsCaseSensitivity.value ? caseSensitive.value : undefined,
    note: note.value.trim() || undefined,
    createdAt: props.rule?.createdAt ?? Date.now(),
  }

  try {
    const parsed = parseMomentFilterSettings({
      schemaVersion: 1,
      enabled: false,
      mode: 'any',
      rules: [rule],
    })
    emit('save', parsed.rules[0])
  }
  catch (error) {
    errorMessage.value = error instanceof MomentFilterSettingsValidationError
      ? error.issues[0]?.message ?? error.message
      : String(error)
  }
}
</script>

<template>
  <form class="moment-rule-editor" @submit.prevent="handleSubmit">
    <div class="editor-grid">
      <label :for="actionId">
        <span>{{ $t('settings.moment_filter_action') }}</span>
        <select :id="actionId" v-model="action">
          <option v-for="item in actions" :key="item" :value="item">
            {{ $t(`settings.moment_filter_action_${item}`) }}
          </option>
        </select>
      </label>

      <label :for="fieldId">
        <span>{{ $t('settings.moment_filter_field') }}</span>
        <select :id="fieldId" v-model="field">
          <option v-for="item in fields" :key="item" :value="item">
            {{ $t(`settings.moment_filter_field_${item}`) }}
          </option>
        </select>
      </label>

      <label :for="operatorId">
        <span>{{ $t('settings.moment_filter_operator') }}</span>
        <select :id="operatorId" v-model="operator">
          <option v-for="item in operators" :key="item" :value="item">
            {{ $t(`settings.moment_filter_operator_${item}`) }}
          </option>
        </select>
      </label>

      <label class="value-field" :for="valueId">
        <span>{{ $t('settings.moment_filter_value') }}</span>
        <textarea
          :id="valueId"
          v-model="valueText"
          rows="3"
          :placeholder="usesListValue ? $t('settings.moment_filter_value_list_hint') : ''"
        />
      </label>

      <label class="note-field" :for="noteId">
        <span>{{ $t('settings.moment_filter_note') }}</span>
        <input :id="noteId" v-model="note" type="text" maxlength="500">
      </label>
    </div>

    <div class="editor-options">
      <label :for="enabledId"><input :id="enabledId" v-model="enabled" type="checkbox"> {{ $t('settings.moment_filter_rule_enabled') }}</label>
      <label v-if="supportsCaseSensitivity" :for="caseSensitiveId">
        <input :id="caseSensitiveId" v-model="caseSensitive" type="checkbox"> {{ $t('settings.moment_filter_case_sensitive') }}
      </label>
    </div>

    <p v-if="errorMessage" role="alert" class="error-message">
      {{ errorMessage }}
    </p>

    <div class="editor-actions">
      <Button type="tertiary" @click.prevent="emit('cancel')">
        {{ $t('common.operation.cancel') }}
      </Button>
      <Button type="primary" @click.prevent="handleSubmit">
        {{ $t('common.operation.confirm') }}
      </Button>
    </div>
  </form>
</template>

<style scoped>
.moment-rule-editor {
  padding: 16px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-fill-1);
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  color: var(--bew-text-2);
  font-size: 13px;
}

select,
input[type="text"],
textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  outline: none;
  color: var(--bew-text-1);
  background: var(--bew-content-solid);
}

select:focus-visible,
input:focus-visible,
textarea:focus-visible {
  box-shadow: 0 0 0 2px var(--bew-theme-color);
}

.value-field,
.note-field {
  grid-column: 1 / -1;
}

textarea {
  resize: vertical;
}

.editor-options,
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.editor-options label {
  flex-direction: row;
  align-items: center;
  color: var(--bew-text-1);
}

.editor-actions {
  justify-content: flex-end;
}

.error-message {
  margin-top: 10px;
  color: var(--bew-error-color);
}

@media (max-width: 680px) {
  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
