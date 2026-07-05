<script setup lang="ts">
import { ref, watch } from "vue";
import type { QuoteAddon } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";

const props = defineProps<{
  addons: QuoteAddon[];
}>();

const emit = defineEmits<{
  addAddon: [];
  duplicateAddon: [id: string];
  updateAddon: [
    payload: {
      id: string;
      field: "title" | "description" | "price" | "unitLabel";
      value: string | number;
    },
  ];
  removeAddon: [id: string];
  moveAddon: [payload: { draggedId: string; targetId: string }];
  addAddonItem: [addonId: string];
  updateAddonItem: [
    payload: { addonId: string; itemId: string; value: string },
  ];
  removeAddonItem: [payload: { addonId: string; itemId: string }];
  moveAddonItem: [
    payload: { addonId: string; draggedId: string; targetId: string },
  ];
  nestAddonItemUnderItem: [
    payload: { addonId: string; draggedId: string; targetId: string },
  ];
  addAddonSubItem: [payload: { addonId: string; itemId: string }];
  updateAddonSubItem: [
    payload: {
      addonId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removeAddonSubItem: [
    payload: { addonId: string; itemId: string; subItemId: string },
  ];
  moveAddonSubItem: [
    payload: {
      addonId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  moveAddonSubItemToItem: [
    payload: {
      addonId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promoteAddonSubItemToItem: [
    payload: {
      addonId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
}>();

const draggedAddonId = ref<string | null>(null);
const topLevelDropTargetId = ref<string | null>(null);
const draggedItem = ref<{ addonId: string; itemId: string } | null>(null);
const draggedSubItem = ref<{
  addonId: string;
  itemId: string;
  subItemId: string;
} | null>(null);
const expandedAddonIds = ref<string[]>([]);
const dropState = ref<{
  addonId: string;
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

const startAddonDrag = (addonId: string) => {
  draggedAddonId.value = addonId;
  topLevelDropTargetId.value = null;
};

const dropAddon = (targetId: string) => {
  if (!draggedAddonId.value || draggedAddonId.value === targetId) return;
  emit("moveAddon", { draggedId: draggedAddonId.value, targetId });
  draggedAddonId.value = null;
  topLevelDropTargetId.value = null;
};

const handleAddonDragOver = (targetId: string, event: DragEvent) => {
  event.preventDefault();
  if (!draggedAddonId.value || draggedAddonId.value === targetId) {
    topLevelDropTargetId.value = null;
    return;
  }
  topLevelDropTargetId.value = targetId;
};

const handleAddonDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as Node | null;
  const current = event.currentTarget as HTMLElement | null;
  if (related && current?.contains(related)) return;
  topLevelDropTargetId.value = null;
};

const handleDragEnd = () => {
  clearDragState();
};

const startItemDrag = (addonId: string, itemId: string) => {
  draggedItem.value = { addonId, itemId };
};

const startSubItemDrag = (
  addonId: string,
  itemId: string,
  subItemId: string,
) => {
  draggedSubItem.value = { addonId, itemId, subItemId };
};

const handleItemDragOver = (
  addonId: string,
  targetId: string,
  event: DragEvent,
) => {
  event.preventDefault();
  const currentTarget = event.currentTarget as HTMLElement | null;
  if (!currentTarget) return;
  const rect = currentTarget.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const mode = offsetX > 96 ? "nested" : "before";
  dropState.value = { addonId, targetType: "item", targetId, mode };
};

const handleSubItemDragOver = (
  addonId: string,
  itemId: string,
  targetId: string,
  event: DragEvent,
) => {
  event.preventDefault();
  dropState.value = {
    addonId,
    targetType: "subitem",
    parentItemId: itemId,
    targetId,
    mode: "before",
  };
};

const dropItem = (addonId: string, targetId: string) => {
  if (
    draggedItem.value &&
    draggedItem.value.addonId === addonId &&
    draggedItem.value.itemId !== targetId
  ) {
    if (
      dropState.value?.targetType === "item" &&
      dropState.value.mode === "nested"
    ) {
      emit("nestAddonItemUnderItem", {
        addonId,
        draggedId: draggedItem.value.itemId,
        targetId,
      });
    } else {
      emit("moveAddonItem", {
        addonId,
        draggedId: draggedItem.value.itemId,
        targetId,
      });
    }
  } else if (draggedSubItem.value && draggedSubItem.value.addonId === addonId) {
    if (
      dropState.value?.targetType === "item" &&
      dropState.value.mode === "nested"
    ) {
      emit("moveAddonSubItemToItem", {
        addonId,
        fromItemId: draggedSubItem.value.itemId,
        subItemId: draggedSubItem.value.subItemId,
        targetItemId: targetId,
      });
    } else {
      emit("promoteAddonSubItemToItem", {
        addonId,
        fromItemId: draggedSubItem.value.itemId,
        subItemId: draggedSubItem.value.subItemId,
        targetId,
      });
    }
  }
  clearDragState();
};

const dropSubItem = (addonId: string, itemId: string, targetId: string) => {
  if (!draggedSubItem.value) return;
  if (
    draggedSubItem.value.addonId !== addonId ||
    draggedSubItem.value.itemId !== itemId ||
    draggedSubItem.value.subItemId === targetId
  )
    return;
  emit("moveAddonSubItem", {
    addonId,
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

const isItemDropBefore = (addonId: string, targetId: string) =>
  dropState.value?.addonId === addonId &&
  dropState.value?.targetType === "item" &&
  dropState.value?.targetId === targetId &&
  dropState.value?.mode === "before";

const isItemDropNested = (addonId: string, targetId: string) =>
  dropState.value?.addonId === addonId &&
  dropState.value?.targetType === "item" &&
  dropState.value?.targetId === targetId &&
  dropState.value?.mode === "nested";

const isSubItemDropBefore = (
  addonId: string,
  itemId: string,
  subItemId: string,
) =>
  dropState.value?.addonId === addonId &&
  dropState.value?.targetType === "subitem" &&
  dropState.value?.parentItemId === itemId &&
  dropState.value?.targetId === subItemId;

const syncExpandedAddons = (addons: QuoteAddon[]) => {
  const existing = new Set(expandedAddonIds.value);
  expandedAddonIds.value = addons
    .filter((addon) => existing.has(addon.id))
    .map((addon) => addon.id);
};

watch(
  () => props.addons,
  (addons) => syncExpandedAddons(addons),
  { immediate: true },
);

const isAddonExpanded = (addonId: string) =>
  expandedAddonIds.value.includes(addonId);

const toggleAddon = (addonId: string) => {
  if (isAddonExpanded(addonId)) {
    expandedAddonIds.value = expandedAddonIds.value.filter(
      (id) => id !== addonId,
    );
    return;
  }

  expandedAddonIds.value = [...expandedAddonIds.value, addonId];
};
</script>

<template>
  <div class="mt-6 rounded-3xl border border-surface-dark/5 bg-white p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 class="font-heading font-bold text-surface-dark">Options complémentaires</h3>
      </div>
      <Button severity="secondary" @click="emit('addAddon')" label="Ajouter une option">
        <template #icon
          ><span class="material-symbols-outlined text-lg"
            >playlist_add</span
          ></template
        ></Button>
    </div>

    <div
      v-if="addons.length === 0"
      class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-sm text-surface-dark/55"
    >
      Aucune option complémentaire pour l’instant.
    </div>

    <div v-else class="flex flex-col gap-4">
      <div
        v-for="(addon, index) in addons"
        :key="addon.id"
        class="rounded-2xl border border-surface-dark/6 bg-surface-light p-4 transition-shadow"
        :class="
          draggedAddonId === addon.id ? 'shadow-lg ring-2 ring-primary/20' : ''
        "
        @dragover="handleAddonDragOver(addon.id, $event)"
        @dragleave="handleAddonDragLeave"
        @drop="dropAddon(addon.id)"
      >
        <div
          v-if="topLevelDropTargetId === addon.id"
          class="mb-4 h-1 rounded-full bg-primary"
        ></div>
        <div
          class="flex cursor-pointer items-center justify-between gap-3"
          @click="toggleAddon(addon.id)"
        >
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              draggable="true"
              class="cursor-grab text-surface-dark/35 active:cursor-grabbing"
              aria-label="Réordonner l’option"
              @click.stop
              @dragstart="startAddonDrag(addon.id)"
              @dragend="
                draggedAddonId = null;
                topLevelDropTargetId = null;
              "
            >
              <span class="material-symbols-outlined text-lg"
                >drag_indicator</span
              >
            </button>
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
              >
                {{ index + 1 }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-surface-dark">
                  {{ addon.title || `Add-on ${index + 1}` }}
                </p>
                <p
                  v-if="!isAddonExpanded(addon.id)"
                  class="mt-0.5 text-xs text-surface-dark/55"
                >
                  {{ addon.price?.toFixed(2) || "0.00" }} €{{
                    addon.unitLabel ? ` / ${addon.unitLabel}` : ""
                  }}
                </p>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <Button text severity="secondary" @click.stop="emit('duplicateAddon', addon.id)">
              <template #icon>
                <span class="material-symbols-outlined text-lg">content_copy</span>
              </template>
            </Button>
            <Button text severity="secondary" @click.stop="toggleAddon(addon.id)">
              <template #icon>
                <span class="material-symbols-outlined text-lg">
                  {{
                    isAddonExpanded(addon.id) ? "expand_less" : "expand_more"
                  }}
                </span>
              </template>
            </Button>
            <Button
              text
              rounded
              severity="danger"
              aria-label="Supprimer"
              title="Supprimer"
              @click.stop="emit('removeAddon', addon.id)"
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
          v-if="isAddonExpanded(addon.id)"
          class="mt-4 mb-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,160px)]"
        >
          <div class="min-w-0">
            <InputText
              class="w-full"
              :model-value="addon.title"
              placeholder="Nouvelle option"
              @update:model-value="
                emit('updateAddon', {
                  id: addon.id,
                  field: 'title',
                  value: $event || '',
                })
              "
            />
          </div>
          <div class="min-w-0">
            <InputNumber
              :model-value="addon.price"
              mode="currency"
              currency="EUR"
              locale="fr-FR"
              class="addon-price-input w-full"
              @update:model-value="
                emit('updateAddon', {
                  id: addon.id,
                  field: 'price',
                  value: Number($event || 0),
                })
              "
            />
          </div>
          <div class="min-w-0">
            <InputText
              class="w-full"
              :model-value="addon.unitLabel"
              placeholder="Ex: 15 éléments"
              @update:model-value="
                emit('updateAddon', {
                  id: addon.id,
                  field: 'unitLabel',
                  value: $event || '',
                })
              "
            />
          </div>
        </div>

        <div
          v-if="isAddonExpanded(addon.id)"
          class="rounded-3xl border border-surface-dark/8 bg-white p-4"
          @dragleave="handleContainerDragLeave"
        >
          <div v-if="addon.items?.length" class="space-y-3">
            <div
              v-for="item in addon.items"
              :key="item.id"
              class="rounded-3xl border border-surface-dark/8 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
              :class="[
                draggedItem?.itemId === item.id
                  ? 'shadow-md ring-2 ring-primary/20'
                  : '',
                isItemDropNested(addon.id, item.id)
                  ? 'bg-primary/5 ring-2 ring-primary/15'
                  : '',
              ]"
              @dragover="handleItemDragOver(addon.id, item.id, $event)"
              @drop="dropItem(addon.id, item.id)"
            >
              <div
                v-if="isItemDropBefore(addon.id, item.id)"
                class="mb-3 h-0.5 rounded-full bg-primary"
              ></div>
              <div class="flex items-start gap-4">
                <button
                  type="button"
                  draggable="true"
                  class="mt-3 shrink-0 cursor-grab text-surface-dark/35 active:cursor-grabbing"
                  aria-label="Réordonner le point"
                  @dragstart="startItemDrag(addon.id, item.id)"
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
                      placeholder="Texte du point"
                      rows="2"
                      auto-resize
                      @update:model-value="
                        emit('updateAddonItem', {
                          addonId: addon.id,
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
                        @click="
                          emit('removeAddonItem', {
                            addonId: addon.id,
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
                            addon.id,
                            item.id,
                            subItem.id,
                            $event,
                          )
                        "
                        @drop="dropSubItem(addon.id, item.id, subItem.id)"
                      >
                        <div
                          v-if="
                            isSubItemDropBefore(addon.id, item.id, subItem.id)
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
                              startSubItemDrag(addon.id, item.id, subItem.id)
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
                              emit('updateAddonSubItem', {
                                addonId: addon.id,
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
                              @click="
                                emit('removeAddonSubItem', {
                                  addonId: addon.id,
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
                        emit('addAddonSubItem', {
                          addonId: addon.id,
                          itemId: item.id,
                        })
                      " label="Ajouter un sous-point">
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
                    class="mt-4 w-[calc(100%-1.25rem)] justify-start rounded-2xl border border-surface-dark/8 bg-surface-light px-4 py-3"
                    @click="
                      emit('addAddonSubItem', {
                        addonId: addon.id,
                        itemId: item.id,
                      })
                    " label="Ajouter un sous-point">
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
            Aucun point pour cette option.
          </p>

          <Button
            text
            severity="secondary"
            class="mt-4 w-full justify-start rounded-2xl border border-surface-dark/8 bg-surface-light px-4 py-3"
            @click="emit('addAddonItem', addon.id)" label="Ajouter un point">
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

<style scoped>
:deep(.addon-price-input),
:deep(.addon-price-input .p-inputnumber),
:deep(.addon-price-input .p-inputtext),
:deep(.addon-price-input input) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
</style>
