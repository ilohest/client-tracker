<script setup lang="ts">
import { ref, watch } from "vue";
import type { QuoteBlock, QuoteCondition } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import QuoteBlocksEditor from "@/components/quotes/QuoteBlocksEditor.vue";

const props = withDefaults(defineProps<{
  conditions: QuoteCondition[];
  sectionTitle?: string;
  addButtonLabel?: string;
  emptyLabel?: string;
  titlePlaceholder?: string;
  showTagInput?: boolean;
  tagPlaceholder?: string;
  reusableConditions?: QuoteCondition[];
  reusableConditionsLabel?: string;
  conditionBadges?: Record<string, string>;
  lockedConditionIds?: string[];
  lockLastConditionTitle?: boolean;
  lockedLastConditionTitle?: string;
}>(), {
  sectionTitle: "Conditions",
  addButtonLabel: "Ajouter une condition",
  emptyLabel: "Aucune condition pour l’instant.",
  titlePlaceholder: "Nouvelle condition",
  showTagInput: false,
  tagPlaceholder: "Tag / hashtag",
  reusableConditions: () => [],
  reusableConditionsLabel: "Ajouter depuis la base commune",
  conditionBadges: () => ({}),
  lockedConditionIds: () => [],
  lockLastConditionTitle: false,
  lockedLastConditionTitle: "",
});

const emit = defineEmits<{
  addCondition: [];
  addReusableCondition: [conditionId: string];
  moveCondition: [payload: { draggedId: string; targetId: string }];
  removeCondition: [id: string];
  updateConditionTitle: [payload: { id: string; value: string }];
  updateConditionTag: [payload: { id: string; value: string }];
  updateConditionBlocks: [payload: { conditionId: string; blocks: QuoteBlock[] }];
}>();

const draggedConditionId = ref<string | null>(null);
const topLevelDropTargetId = ref<string | null>(null);
const expandedConditionIds = ref<string[]>([]);

const startConditionDrag = (conditionId: string) => {
  draggedConditionId.value = conditionId;
};

const dropCondition = (targetId: string) => {
  const draggedId = draggedConditionId.value;
  draggedConditionId.value = null;
  topLevelDropTargetId.value = null;
  if (!draggedId || draggedId === targetId) return;
  emit("moveCondition", { draggedId, targetId });
};

const handleConditionDragOver = (targetId: string, event: DragEvent) => {
  if (!draggedConditionId.value) return;
  event.preventDefault();
  topLevelDropTargetId.value = targetId;
};

const handleConditionDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as Node | null;
  if (related && (event.currentTarget as Node).contains(related)) return;
  topLevelDropTargetId.value = null;
};

const syncExpandedConditions = (conditions: QuoteCondition[]) => {
  const existing = new Set(expandedConditionIds.value);
  expandedConditionIds.value = conditions
    .filter((condition) => existing.has(condition.id))
    .map((condition) => condition.id);
};

watch(
  () => props.conditions,
  (conditions) => syncExpandedConditions(conditions),
  { immediate: true },
);

const isConditionExpanded = (conditionId: string) =>
  expandedConditionIds.value.includes(conditionId);

const toggleCondition = (conditionId: string) => {
  if (isConditionExpanded(conditionId)) {
    expandedConditionIds.value = expandedConditionIds.value.filter(
      (id) => id !== conditionId,
    );
    return;
  }

  expandedConditionIds.value = [...expandedConditionIds.value, conditionId];
};

const stripAutoNumberPrefix = (value: string | undefined) =>
  (value || "").replace(/^\s*\d+\.\s*/, "").trim();

const isLockedLastCondition = (index: number) =>
  props.lockLastConditionTitle && index === props.conditions.length - 1;
const isLockedCondition = (conditionId: string) =>
  props.lockedConditionIds.includes(conditionId);
const isConditionContentLocked = (condition: QuoteCondition, index: number) =>
  isLockedLastCondition(index) || isLockedCondition(condition.id);

const getConditionTitle = (condition: QuoteCondition, index: number) =>
  isLockedLastCondition(index)
    ? props.lockedLastConditionTitle || condition.title
    : condition.title;
</script>

<template>
  <div class="rounded-3xl border border-surface-dark/5 bg-white p-4">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="font-heading font-bold text-surface-dark">{{ props.sectionTitle }}</h3>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="headerActions" />
        <Button severity="secondary" @click="emit('addCondition')" :label="props.addButtonLabel">
          <template #icon
            ><span class="material-symbols-outlined text-lg">add</span></template
          ></Button>
      </div>
    </div>

    <div
      v-if="props.reusableConditions.length"
      class="mb-4 rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-3"
    >
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/75">
        {{ props.reusableConditionsLabel }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="condition in props.reusableConditions"
          :key="condition.id"
          size="small"
          severity="secondary"
          outlined
          class="!rounded-xl"
          :label="condition.title || 'Condition commune'"
          @click="emit('addReusableCondition', condition.id)"
        >
          <template #icon>
            <span class="material-symbols-outlined text-base">library_add</span>
          </template>
        </Button>
      </div>
    </div>

    <div
      v-if="conditions.length === 0"
      class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-sm text-surface-dark/55"
    >
      {{ props.emptyLabel }}
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="(condition, index) in conditions"
        :key="condition.id"
        class="rounded-2xl border border-surface-dark/6 bg-surface-light p-3"
        :class="
          draggedConditionId === condition.id
            ? 'shadow-lg ring-2 ring-primary/20'
            : ''
        "
        @dragover="handleConditionDragOver(condition.id, $event)"
        @dragleave="handleConditionDragLeave"
        @drop="dropCondition(condition.id)"
      >
        <div
          v-if="topLevelDropTargetId === condition.id"
          class="mb-3 h-1 rounded-full bg-primary"
        ></div>
        <div
          class="flex cursor-pointer items-center justify-between gap-3"
          @click="toggleCondition(condition.id)"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              :draggable="!isLockedLastCondition(index)"
              class="text-surface-dark/35"
              :class="isLockedLastCondition(index) ? 'cursor-not-allowed opacity-35' : 'cursor-grab active:cursor-grabbing'"
              aria-label="Réordonner la condition"
              @click.stop
              @dragstart="!isLockedLastCondition(index) && startConditionDrag(condition.id)"
              @dragend="
                draggedConditionId = null;
                topLevelDropTargetId = null;
              "
            >
              <span class="material-symbols-outlined text-lg"
                >drag_indicator</span
              >
            </button>
            <div
              class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
              :class="isLockedLastCondition(index) ? 'bg-surface-dark/8 text-surface-dark/45' : 'bg-primary/10 text-primary'"
            >
              <span v-if="isLockedLastCondition(index)" class="material-symbols-outlined text-sm">lock</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <p class="truncate text-sm font-semibold text-surface-dark">
              {{ stripAutoNumberPrefix(getConditionTitle(condition, index)) || "Nouvelle condition" }}
            </p>
            <span
              v-if="props.conditionBadges[condition.id]"
              class="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
              :class="
                props.conditionBadges[condition.id] === 'Personnalisée'
                  ? 'border-amber-300/70 bg-amber-50 text-amber-700'
                  : 'border-primary/15 bg-primary/8 text-primary'
              "
            >
              {{ props.conditionBadges[condition.id] }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Button text severity="secondary" @click.stop="toggleCondition(condition.id)">
              <template #icon>
                <span class="material-symbols-outlined text-lg">
                  {{ isConditionExpanded(condition.id) ? "expand_less" : "expand_more" }}
                </span>
              </template>
            </Button>
            <Button
              v-if="!isLockedLastCondition(index)"
              text
              rounded
              severity="danger"
              aria-label="Supprimer"
              title="Supprimer"
              @click.stop="emit('removeCondition', condition.id)"
            >
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >delete</span
                ></template
              >
            </Button>
          </div>
        </div>

        <div
          v-if="isConditionExpanded(condition.id)"
          class="rounded-2xl border border-surface-dark/8 bg-white p-3"
          :class="isConditionExpanded(condition.id) ? 'mt-3' : ''"
        >
          <div class="mb-3 flex items-center gap-3">
            <InputText
              class="w-full"
              :model-value="getConditionTitle(condition, index)"
              :placeholder="props.titlePlaceholder"
              :disabled="isConditionContentLocked(condition, index)"
              @update:model-value="
                !isConditionContentLocked(condition, index) && emit('updateConditionTitle', {
                  id: condition.id,
                  value: $event || '',
                })
              "
            />
          </div>
          <div v-if="props.showTagInput" class="mb-3">
            <InputText
              class="w-full"
              :model-value="condition.tag || ''"
              :placeholder="props.tagPlaceholder"
              :disabled="isLockedCondition(condition.id)"
              @update:model-value="
                !isLockedCondition(condition.id) && emit('updateConditionTag', {
                  id: condition.id,
                  value: $event || '',
                })
              "
            />
          </div>
          <QuoteBlocksEditor
            :model-value="condition.blocks || []"
            :readonly="isLockedCondition(condition.id)"
            @update:model-value="
              emit('updateConditionBlocks', { conditionId: condition.id, blocks: $event })
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>
