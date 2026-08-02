<script setup lang="ts">
import type { MomentFilterRule, MomentFilterSettingsV1 } from '~/features/moment-filter/types'
import { useI18n } from 'vue-i18n'

import { createBrowserMomentFilterStorage } from '~/features/moment-filter/browser-storage'
import { createDefaultMomentFilterSettings } from '~/features/moment-filter/defaults'
import {
  exportMomentFilterSettings,
  planMomentFilterImport,
} from '~/features/moment-filter/transfer'

import SettingsItem from '../../components/SettingsItem.vue'
import SettingsItemGroup from '../../components/SettingsItemGroup.vue'
import MomentRuleEditor from './MomentRuleEditor.vue'
import MomentRuleTable from './MomentRuleTable.vue'

const { t } = useI18n()
const storage = createBrowserMomentFilterStorage()
const model = ref<MomentFilterSettingsV1>(createDefaultMomentFilterSettings())
const busy = ref(true)
const errorMessage = ref('')
const recoveredSettings = ref(false)
const showEditor = ref(false)
const editingRule = ref<MomentFilterRule>()
const importInput = ref<HTMLInputElement>()
const importMode = ref<'merge' | 'replace'>('merge')
const importPreview = ref<ReturnType<typeof planMomentFilterImport>>()
let unsubscribeStorage: (() => void) | undefined

onMounted(async () => {
  const result = await storage.load()
  model.value = result.value
  recoveredSettings.value = result.status === 'recovered'
  busy.value = false
  unsubscribeStorage = storage.subscribe((change) => {
    model.value = change.value
    recoveredSettings.value = change.status === 'recovered'
  })
})

onBeforeUnmount(() => unsubscribeStorage?.())

async function persist(next: MomentFilterSettingsV1): Promise<void> {
  busy.value = true
  errorMessage.value = ''
  try {
    model.value = await storage.save(next)
    recoveredSettings.value = false
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    busy.value = false
  }
}

function updateEnabled(enabled: boolean): void {
  void persist({ ...model.value, enabled })
}

function updateMode(mode: 'any' | 'all'): void {
  void persist({ ...model.value, mode })
}

function openNewRule(): void {
  editingRule.value = undefined
  showEditor.value = true
}

function openEditRule(rule: MomentFilterRule): void {
  editingRule.value = rule
  showEditor.value = true
}

function saveRule(rule: MomentFilterRule): void {
  const index = model.value.rules.findIndex(item => item.id === rule.id)
  const rules = [...model.value.rules]
  if (index === -1)
    rules.unshift(rule)
  else
    rules.splice(index, 1, rule)
  showEditor.value = false
  void persist({ ...model.value, rules })
}

function toggleRule(rule: MomentFilterRule): void {
  const rules = model.value.rules.map(item => item.id === rule.id ? { ...item, enabled: !item.enabled } : item)
  void persist({ ...model.value, rules })
}

function deleteRule(rule: MomentFilterRule): void {
  if (!window.confirm(t('settings.moment_filter_delete_confirm')))
    return
  const rules = model.value.rules.filter(item => item.id !== rule.id)
  if (editingRule.value?.id === rule.id)
    showEditor.value = false
  void persist({ ...model.value, rules })
}

function exportRules(): void {
  const blob = new Blob([exportMomentFilterSettings(model.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bewly-moment-filter.json'
  link.click()
  URL.revokeObjectURL(url)
}

function chooseImportFile(): void {
  importInput.value?.click()
}

async function readImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return

  errorMessage.value = ''
  try {
    importPreview.value = planMomentFilterImport(model.value, await file.text(), importMode.value)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    importPreview.value = undefined
  }
}

function confirmImport(): void {
  if (!importPreview.value)
    return
  const next = importPreview.value.value
  importPreview.value = undefined
  void persist(next)
}
</script>

<template>
  <div class="moments-settings" :aria-busy="busy">
    <SettingsItemGroup :title="$t('settings.moment_filter_title')">
      <SettingsItem
        :title="$t('settings.moment_filter_enabled')"
        :desc="$t('settings.moment_filter_enabled_desc')"
      >
        <Radio
          :model-value="model.enabled"
          :label="$t('settings.moment_filter_enabled')"
          @update:model-value="updateEnabled(Boolean($event))"
        />
      </SettingsItem>

      <SettingsItem :title="$t('settings.moment_filter_mode')" :desc="$t('settings.moment_filter_mode_desc')">
        <fieldset class="mode-control">
          <legend class="sr-only">
            {{ $t('settings.moment_filter_mode') }}
          </legend>
          <label for="moment-filter-mode-any">
            <input
              id="moment-filter-mode-any"
              type="radio"
              name="moment-filter-mode"
              value="any"
              :checked="model.mode === 'any'"
              @change="updateMode('any')"
            >
            {{ $t('settings.moment_filter_mode_any') }}
          </label>
          <label for="moment-filter-mode-all">
            <input
              id="moment-filter-mode-all"
              type="radio"
              name="moment-filter-mode"
              value="all"
              :checked="model.mode === 'all'"
              @change="updateMode('all')"
            >
            {{ $t('settings.moment_filter_mode_all') }}
          </label>
        </fieldset>
      </SettingsItem>
    </SettingsItemGroup>

    <section class="rules-section" aria-labelledby="moment-filter-rules-title">
      <div class="section-header">
        <div>
          <h2 id="moment-filter-rules-title">
            {{ $t('settings.moment_filter_rules') }}
          </h2>
          <p>{{ $t('settings.moment_filter_rules_desc') }}</p>
        </div>
        <Button type="primary" @click="openNewRule">
          <template #left>
            <i i-mingcute:add-line />
          </template>
          {{ $t('common.operation.add') }}
        </Button>
      </div>

      <MomentRuleEditor
        v-if="showEditor"
        :key="editingRule?.id ?? 'new'"
        :rule="editingRule"
        @cancel="showEditor = false"
        @save="saveRule"
      />

      <MomentRuleTable
        :rules="model.rules"
        @delete="deleteRule"
        @edit="openEditRule"
        @toggle="toggleRule"
      />
    </section>

    <section class="transfer-section" aria-labelledby="moment-filter-transfer-title">
      <div>
        <h2 id="moment-filter-transfer-title">
          {{ $t('settings.moment_filter_import_export') }}
        </h2>
        <p>{{ $t('settings.moment_filter_import_export_desc') }}</p>
      </div>
      <div class="transfer-controls">
        <label for="moment-filter-import-mode">
          <span>{{ $t('settings.moment_filter_import_mode') }}</span>
          <select id="moment-filter-import-mode" v-model="importMode">
            <option value="merge">
              {{ $t('settings.moment_filter_import_merge') }}
            </option>
            <option value="replace">
              {{ $t('settings.moment_filter_import_replace') }}
            </option>
          </select>
        </label>
        <Button type="secondary" @click="chooseImportFile">
          {{ $t('settings.moment_filter_import') }}
        </Button>
        <Button type="secondary" @click="exportRules">
          {{ $t('settings.moment_filter_export') }}
        </Button>
        <input
          ref="importInput"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          :aria-label="$t('settings.moment_filter_import')"
          @change="readImportFile"
        >
      </div>
    </section>

    <section v-if="importPreview" class="import-preview" role="dialog" aria-modal="false">
      <h3>{{ $t('settings.moment_filter_import_preview') }}</h3>
      <p>
        {{ $t('settings.moment_filter_import_counts', {
          added: importPreview.counts.added,
          updated: importPreview.counts.updated,
          unchanged: importPreview.counts.unchanged,
          removed: importPreview.counts.removed,
        }) }}
      </p>
      <div class="preview-actions">
        <Button type="tertiary" @click="importPreview = undefined">
          {{ $t('common.operation.cancel') }}
        </Button>
        <Button type="primary" @click="confirmImport">
          {{ $t('common.operation.confirm') }}
        </Button>
      </div>
    </section>

    <p v-if="recoveredSettings" class="warning-message" role="status">
      {{ $t('settings.moment_filter_recovered') }}
    </p>
    <p v-if="errorMessage" class="error-message" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.moments-settings,
.rules-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.rules-section,
.transfer-section,
.import-preview {
  padding: 16px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-content-solid);
}

.section-header,
.transfer-section,
.transfer-controls,
.preview-actions,
.mode-control {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

h2,
h3,
p {
  margin: 0;
}

.section-header p,
.transfer-section p {
  margin-top: 4px;
  color: var(--bew-text-2);
  font-size: 13px;
}

.mode-control {
  padding: 0;
  border: 0;
  justify-content: flex-end;
}

.mode-control label,
.transfer-controls label {
  display: flex;
  gap: 6px;
  align-items: center;
}

.transfer-controls select {
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  outline: none;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
}

.transfer-controls select:focus-visible {
  box-shadow: 0 0 0 2px var(--bew-theme-color);
}

.import-preview {
  background: var(--bew-fill-1);
}

.preview-actions {
  margin-top: 12px;
  justify-content: flex-end;
}

.error-message,
.warning-message {
  overflow-wrap: anywhere;
  padding: 10px;
  border-radius: var(--bew-radius);
}

.error-message {
  color: var(--bew-error-color);
  background: color-mix(in srgb, var(--bew-error-color) 12%, transparent);
}

.warning-message {
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

@media (max-width: 680px) {
  .section-header,
  .transfer-section,
  .transfer-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .transfer-controls label {
    justify-content: space-between;
  }
}
</style>
