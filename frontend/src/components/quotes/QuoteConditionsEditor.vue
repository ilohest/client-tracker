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
}>(), {
  sectionTitle: "Conditions",
  addButtonLabel: "Ajouter une condition",
  emptyLabel: "Aucune condition pour l’instant.",
  itemEmptyLabel: "Aucun point pour cette condition.",
  itemPlaceholder: "Texte du point",
  titlePlaceholder: "Nouvelle condition",
});

const emit = defineEmits<{
  addCondition: [];
  moveCondition: [payload: { draggedId: string; targetId: string }];
  removeCondition: [id: string];
  updateConditionTitle: [payload: { id: string; value: string }];
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
  draggedItem.value = { conditionId, itemId };
};

const startSubItemDrag = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  draggedSubItem.value = { conditionId, itemId, subItemId };
};

const handleItemDragOver = (
  conditionId: string,
  targetId: string,
  event: DragEvent,
) => {
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
</script>

<template>
  <div class="mt-6 rounded-3xl border border-surface-dark/5 bg-white p-5">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 class="font-heading font-bold text-surface-dark">{{ props.sectionTitle }}</h3>
      </div>
      <Button severity="secondary" @click="emit('addCondition')">
        <template #icon
          ><span class="material-symbols-outlined text-lg">add</span></template
        >
        {{ props.addButtonLabel }}
      </Button>
    </div>

    <div
      v-if="conditions.length === 0"
      class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-sm text-surface-dark/55"
    >
      {{ props.emptyLabel }}
    </div>

    <div v-else class="flex flex-col gap-4">
      <div
        v-for="(condition, index) in conditions"
        :key="condition.id"
        class="rounded-3xl border border-surface-dark/6 bg-surface-light p-5"
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
          class="mb-4 h-1 rounded-full bg-primary"
        ></div>
        <div
          class="flex cursor-pointer items-center justify-between gap-3"
          @click="toggleCondition(condition.id)"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              draggable="true"
              class="cursor-grab text-surface-dark/35 active:cursor-grabbing"
              aria-label="Réordonner la condition"
              @click.stop
              @dragstart="startConditionDrag(condition.id)"
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
              class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
            >
              {{ index + 1 }}
            </div>
            <p class="truncate text-sm font-semibold text-surface-dark">
              {{ stripAutoNumberPrefix(condition.title) || "Nouvelle condition" }}
            </p>
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
              text
              severity="danger"
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
          class="rounded-3xl border border-surface-dark/8 bg-white p-4"
          :class="isConditionExpanded(condition.id) ? 'mt-4' : ''"
          @dragleave="handleContainerDragLeave"
        >
          <div class="mb-4 flex items-center gap-3">
            <InputText
              class="w-full"
              :model-value="condition.title"
              :placeholder="props.titlePlaceholder"
              @update:model-value="
                emit('updateConditionTitle', {
                  id: condition.id,
                  value: $event || '',
                })
              "
            />
          </div>
          <div v-if="condition.items.length" class="space-y-3">
            <div
              v-for="item in condition.items"
              :key="item.id"
              class="rounded-3xl border border-surface-dark/8 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
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
                class="mb-3 h-0.5 rounded-full bg-primary"
              ></div>
              <div class="flex items-start gap-4">
                <button
                  type="button"
                  draggable="true"
                  class="mt-3 shrink-0 cursor-grab text-surface-dark/35 active:cursor-grabbing"
                  aria-label="Réordonner le point"
                  @dragstart="startItemDrag(condition.id, item.id)"
                  @dragend="handleDragEnd"
                >
                  <span class="material-symbols-outlined text-lg"
                    >drag_indicator</span
                  >
                </button>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start gap-3">
                    <Textarea
                      class="flex-1"
                      :model-value="item.text"
                      :placeholder="props.itemPlaceholder"
                      rows="2"
                      auto-resize
                      @update:model-value="
                        emit('updateConditionItem', {
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
                        @click="
                          emit('removeConditionItem', {
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

                  <div v-if="item.subItems.length" class="mt-4 ml-5 pl-8">
                    <div class="space-y-3">
                      <div
                        v-for="subItem in item.subItems"
                        :key="subItem.id"
                        class="relative rounded-3xl border border-surface-dark/8 bg-surface-light p-4"
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
                          class="mb-3 h-0.5 rounded-full bg-primary"
                        ></div>
                        <div class="flex items-start gap-3">
                          <button
                            type="button"
                            draggable="true"
                            class="mt-3 shrink-0 cursor-grab text-surface-dark/35 active:cursor-grabbing"
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
                            @update:model-value="
                              emit('updateConditionSubItem', {
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
                              @click="
                                emit('removeConditionSubItem', {
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
                      class="mt-3 w-full justify-start rounded-2xl border border-surface-dark/8 bg-white px-4 py-3"
                      @click="
                        emit('addConditionSubItem', {
                          conditionId: condition.id,
                          itemId: item.id,
                        })
                      "
                    >
                      <template #icon
                        ><span class="material-symbols-outlined text-lg"
                          >add_circle</span
                        ></template
                      >
                      Ajouter un sous-point
                    </Button>
                  </div>

                  <Button
                    v-else
                    text
                    severity="secondary"
                    class="mt-4 w-[calc(100%-1.25rem)] justify-start rounded-2xl border border-surface-dark/8 bg-surface-light px-4 py-3"
                    @click="
                      emit('addConditionSubItem', {
                        conditionId: condition.id,
                        itemId: item.id,
                      })
                    "
                  >
                    <template #icon
                      ><span class="material-symbols-outlined text-lg"
                        >add_circle</span
                      ></template
                    >
                    Ajouter un sous-point
                  </Button>
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
            class="mt-4 w-full justify-start rounded-2xl border border-surface-dark/8 bg-surface-light px-4 py-3"
            @click="emit('addConditionItem', condition.id)"
          >
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >add_circle</span
              ></template
            >
            Ajouter un point
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
