<script setup lang="ts">
import { ref, watch } from "vue";
import type { QuoteCondition } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";

const props = withDefaults(defineProps<{
  conditions: QuoteCondition[];
  sectionTitle?: string;
  addButtonLabel?: string;
  emptyLabel?: string;
  itemEmptyLabel?: string;
  itemPlaceholder?: string;
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
  itemEmptyLabel: "Aucun point pour cette condition.",
  itemPlaceholder: "Texte du point",
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
  addConditionItem: [conditionId: string];
  updateConditionItem: [
    payload: { conditionId: string; itemId: string; value: string },
  ];
  removeConditionItem: [payload: { conditionId: string; itemId: string }];
  moveConditionItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  nestConditionItemUnderItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  addConditionSubItem: [payload: { conditionId: string; itemId: string }];
  updateConditionSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removeConditionSubItem: [
    payload: { conditionId: string; itemId: string; subItemId: string },
  ];
  moveConditionSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  moveConditionSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promoteConditionSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
}>();

const draggedConditionId = ref<string | null>(null);
const topLevelDropTargetId = ref<string | null>(null);
const draggedItem = ref<{ conditionId: string; itemId: string } | null>(null);
const draggedSubItem = ref<{
  conditionId: string;
  itemId: string;
  subItemId: string;
} | null>(null);
const expandedConditionIds = ref<string[]>([]);
const dropState = ref<{
  conditionId: string;
  targetType: "item" | "subitem";
  targetId: string;
  parentItemId?: string;
  mode: "before" | "nested";
} | null>(null);

const clearDragState = () => {
  draggedItem.value = null;
  draggedSubItem.value = null;
  dropState.value = null;
};

const startConditionDrag = (conditionId: string) => {
  draggedConditionId.value = conditionId;
  topLevelDropTargetId.value = null;
};

const dropCondition = (targetId: string) => {
  if (!draggedConditionId.value || draggedConditionId.value === targetId) return;
  emit("moveCondition", { draggedId: draggedConditionId.value, targetId });
  draggedConditionId.value = null;
  topLevelDropTargetId.value = null;
};

const handleConditionDragOver = (targetId: string, event: DragEvent) => {
  event.preventDefault();
  if (!draggedConditionId.value || draggedConditionId.value === targetId) {
    topLevelDropTargetId.value = null;
    return;
  }
  topLevelDropTargetId.value = targetId;
};

const handleConditionDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as Node | null;
  const current = event.currentTarget as HTMLElement | null;
  if (related && current?.contains(related)) return;
  topLevelDropTargetId.value = null;
};

const handleDragEnd = () => {
  clearDragState();
};

const startItemDrag = (conditionId: string, itemId: string) => {
  if (isLockedCondition(conditionId)) return;
  draggedItem.value = { conditionId, itemId };
};

const startSubItemDrag = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  if (isLockedCondition(conditionId)) return;
  draggedSubItem.value = { conditionId, itemId, subItemId };
};

const handleItemDragOver = (
  conditionId: string,
  targetId: string,
  event: DragEvent,
) => {
  if (isLockedCondition(conditionId)) return;
  event.preventDefault();
  const currentTarget = event.currentTarget as HTMLElement | null;
  if (!currentTarget) return;
  const rect = currentTarget.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const mode = offsetX > 96 ? "nested" : "before";
  dropState.value = { conditionId, targetType: "item", targetId, mode };
};

const handleSubItemDragOver = (
  conditionId: string,
  itemId: string,
  targetId: string,
  event: DragEvent,
) => {
  if (isLockedCondition(conditionId)) return;
  event.preventDefault();
  dropState.value = {
    conditionId,
    targetType: "subitem",
    parentItemId: itemId,
    targetId,
    mode: "before",
  };
};

const dropItem = (conditionId: string, targetId: string) => {
  if (isLockedCondition(conditionId)) {
    clearDragState();
    return;
  }
  if (
    draggedItem.value &&
    draggedItem.value.conditionId === conditionId &&
    draggedItem.value.itemId !== targetId
  ) {
    if (
      dropState.value?.targetType === "item" &&
      dropState.value.mode === "nested"
    ) {
      emit("nestConditionItemUnderItem", {
        conditionId,
        draggedId: draggedItem.value.itemId,
        targetId,
      });
    } else {
      emit("moveConditionItem", {
        conditionId,
        draggedId: draggedItem.value.itemId,
        targetId,
      });
    }
  } else if (
    draggedSubItem.value &&
    draggedSubItem.value.conditionId === conditionId
  ) {
    if (
      dropState.value?.targetType === "item" &&
      dropState.value.mode === "nested"
    ) {
      emit("moveConditionSubItemToItem", {
        conditionId,
        fromItemId: draggedSubItem.value.itemId,
        subItemId: draggedSubItem.value.subItemId,
        targetItemId: targetId,
      });
    } else {
      emit("promoteConditionSubItemToItem", {
        conditionId,
        fromItemId: draggedSubItem.value.itemId,
        subItemId: draggedSubItem.value.subItemId,
        targetId,
      });
    }
  }
  clearDragState();
};

const dropSubItem = (conditionId: string, itemId: string, targetId: string) => {
  if (isLockedCondition(conditionId)) {
    clearDragState();
    return;
  }
  if (!draggedSubItem.value) return;
  if (
    draggedSubItem.value.conditionId !== conditionId ||
    draggedSubItem.value.itemId !== itemId ||
    draggedSubItem.value.subItemId === targetId
  )
    return;
  emit("moveConditionSubItem", {
    conditionId,
    itemId,
    draggedId: draggedSubItem.value.subItemId,
    targetId,
  });
  clearDragState();
};

const handleContainerDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as Node | null;
  const current = event.currentTarget as HTMLElement | null;
  if (related && current?.contains(related)) return;
  dropState.value = null;
};

const isItemDropBefore = (conditionId: string, targetId: string) =>
  dropState.value?.conditionId === conditionId &&
  dropState.value?.targetType === "item" &&
  dropState.value?.targetId === targetId &&
  dropState.value?.mode === "before";

const isItemDropNested = (conditionId: string, targetId: string) =>
  dropState.value?.conditionId === conditionId &&
  dropState.value?.targetType === "item" &&
  dropState.value?.targetId === targetId &&
  dropState.value?.mode === "nested";

const isSubItemDropBefore = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) =>
  dropState.value?.conditionId === conditionId &&
  dropState.value?.targetType === "subitem" &&
  dropState.value?.parentItemId === itemId &&
  dropState.value?.targetId === subItemId;

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
  <div class="mt-6 rounded-3xl border border-surface-dark/5 bg-white p-4">
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
              class="shrink-0 rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary"
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
          @dragleave="handleContainerDragLeave"
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
          <div v-if="condition.items.length" class="space-y-2">
            <div
              v-for="item in condition.items"
              :key="item.id"
              class="rounded-2xl border border-surface-dark/8 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
              :class="[
                draggedItem?.itemId === item.id
                  ? 'shadow-md ring-2 ring-primary/20'
                  : '',
                isItemDropNested(condition.id, item.id)
                  ? 'bg-primary/5 ring-2 ring-primary/15'
                  : '',
              ]"
              @dragover="handleItemDragOver(condition.id, item.id, $event)"
              @drop="dropItem(condition.id, item.id)"
            >
              <div
                v-if="isItemDropBefore(condition.id, item.id)"
                class="mb-2 h-0.5 rounded-full bg-primary"
              ></div>
              <div class="flex items-start gap-3">
                <button
                  type="button"
                  :draggable="!isLockedCondition(condition.id)"
                  class="mt-3 shrink-0 cursor-grab text-surface-dark/35 active:cursor-grabbing"
                  :class="isLockedCondition(condition.id) ? 'cursor-not-allowed opacity-35' : ''"
                  aria-label="Réordonner le point"
                  @dragstart="startItemDrag(condition.id, item.id)"
                  @dragend="handleDragEnd"
                >
                  <span class="material-symbols-outlined text-lg"
                    >drag_indicator</span
                  >
                </button>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start gap-2">
                    <Textarea
                      class="flex-1"
                      :model-value="item.text"
                      :placeholder="props.itemPlaceholder"
                      rows="2"
                      auto-resize
                      :disabled="isLockedCondition(condition.id)"
                      @update:model-value="
                        !isLockedCondition(condition.id) && emit('updateConditionItem', {
                          conditionId: condition.id,
                          itemId: item.id,
                          value: $event || '',
                        })
                      "
                    />
                    <div class="flex shrink-0 flex-col items-center gap-1 pt-1">
                      <Button
                        text
                        severity="danger"
                        class="!h-10 !w-10 !rounded-xl"
                        aria-label="Supprimer"
                        title="Supprimer"
                        :disabled="isLockedCondition(condition.id)"
                        @click="
                          !isLockedCondition(condition.id) && emit('removeConditionItem', {
                            conditionId: condition.id,
                            itemId: item.id,
                          })
                        "
                      >
                        <template #icon
                          ><span class="material-symbols-outlined text-lg"
                            >delete</span
                          ></template
                        >
                      </Button>
                    </div>
                  </div>

                  <div v-if="item.subItems.length" class="mt-3 ml-4 pl-6">
                    <div class="space-y-2">
                      <div
                        v-for="subItem in item.subItems"
                        :key="subItem.id"
                        class="relative rounded-2xl border border-surface-dark/8 bg-surface-light p-3"
                        :class="
                          draggedSubItem?.subItemId === subItem.id
                            ? 'shadow-md ring-2 ring-primary/20'
                            : ''
                        "
                        @dragover="
                          handleSubItemDragOver(
                            condition.id,
                            item.id,
                            subItem.id,
                            $event,
                          )
                        "
                        @drop="dropSubItem(condition.id, item.id, subItem.id)"
                      >
                        <div
                          v-if="
                            isSubItemDropBefore(
                              condition.id,
                              item.id,
                              subItem.id,
                            )
                          "
                          class="mb-2 h-0.5 rounded-full bg-primary"
                        ></div>
                        <div class="flex items-start gap-2">
                          <button
                            type="button"
                            :draggable="!isLockedCondition(condition.id)"
                            class="mt-3 shrink-0 cursor-grab text-surface-dark/35 active:cursor-grabbing"
                            :class="isLockedCondition(condition.id) ? 'cursor-not-allowed opacity-35' : ''"
                            aria-label="Réordonner le sous-point"
                            @dragstart="
                              startSubItemDrag(condition.id, item.id, subItem.id)
                            "
                            @dragend="handleDragEnd"
                          >
                            <span class="material-symbols-outlined text-lg"
                              >drag_indicator</span
                            >
                          </button>
                          <Textarea
                            class="flex-1"
                            :model-value="subItem.text"
                            placeholder="Texte du sous-point"
                            rows="2"
                            auto-resize
                            :disabled="isLockedCondition(condition.id)"
                            @update:model-value="
                              !isLockedCondition(condition.id) && emit('updateConditionSubItem', {
                                conditionId: condition.id,
                                itemId: item.id,
                                subItemId: subItem.id,
                                value: $event || '',
                              })
                            "
                          />
                          <div
                            class="flex shrink-0 flex-col items-center gap-1 pt-1"
                          >
                            <Button
                              text
                              severity="danger"
                              class="!h-10 !w-10 !rounded-xl"
                              aria-label="Supprimer"
                              title="Supprimer"
                              :disabled="isLockedCondition(condition.id)"
                              @click="
                                !isLockedCondition(condition.id) && emit('removeConditionSubItem', {
                                  conditionId: condition.id,
                                  itemId: item.id,
                                  subItemId: subItem.id,
                                })
                              "
                            >
                              <template #icon
                                ><span class="material-symbols-outlined text-lg"
                                  >delete</span
                                ></template
                              >
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      text
                      severity="secondary"
                      class="mt-2 w-full justify-start rounded-xl border border-surface-dark/8 bg-white px-3 py-2"
                      @click="
                        !isLockedCondition(condition.id) && emit('addConditionSubItem', {
                          conditionId: condition.id,
                          itemId: item.id,
                        })
                      " label="Ajouter un sous-point"
                      :disabled="isLockedCondition(condition.id)">
                      <template #icon
                        ><span class="material-symbols-outlined text-lg"
                          >add_circle</span
                        ></template
                      ></Button>
                  </div>

                  <Button
                    v-else
                    text
                    severity="secondary"
                    class="mt-3 w-[calc(100%-1rem)] justify-start rounded-xl border border-surface-dark/8 bg-surface-light px-3 py-2"
                    @click="
                      !isLockedCondition(condition.id) && emit('addConditionSubItem', {
                        conditionId: condition.id,
                        itemId: item.id,
                      })
                    " label="Ajouter un sous-point"
                    :disabled="isLockedCondition(condition.id)">
                    <template #icon
                      ><span class="material-symbols-outlined text-lg"
                        >add_circle</span
                      ></template
                    ></Button>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-surface-dark/55">
            {{ props.itemEmptyLabel }}
          </p>

          <Button
            text
            severity="secondary"
            class="mt-3 w-full justify-start rounded-xl border border-surface-dark/8 bg-surface-light px-3 py-2"
            :disabled="isLockedCondition(condition.id)"
            @click="!isLockedCondition(condition.id) && emit('addConditionItem', condition.id)" label="Ajouter un point">
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >add_circle</span
              ></template
            ></Button>
        </div>
      </div>
    </div>
  </div>
</template>
