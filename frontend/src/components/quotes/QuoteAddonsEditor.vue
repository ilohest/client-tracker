<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { QuoteAddon, QuoteBlock } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import QuoteBlocksEditor from "@/components/quotes/QuoteBlocksEditor.vue";

const props = defineProps<{
  addons: QuoteAddon[];
}>();

const emit = defineEmits<{
  addAddon: [];
  duplicateAddon: [id: string];
  updateAddon: [
    payload: {
      id: string;
      field: "title" | "price" | "unitLabel";
      value: string | number;
    },
  ];
  removeAddon: [id: string];
  moveAddon: [payload: { draggedId: string; targetId: string }];
  updateAddonBlocks: [payload: { addonId: string; blocks: QuoteBlock[] }];
}>();

const draggedAddonId = ref<string | null>(null);
const topLevelDropTargetId = ref<string | null>(null);
const expandedAddonIds = ref<string[]>([]);

const startAddonDrag = (addonId: string) => {
  draggedAddonId.value = addonId;
};

const dropAddon = (targetId: string) => {
  const draggedId = draggedAddonId.value;
  draggedAddonId.value = null;
  topLevelDropTargetId.value = null;
  if (!draggedId || draggedId === targetId) return;
  emit("moveAddon", { draggedId, targetId });
};

const handleAddonDragOver = (targetId: string, event: DragEvent) => {
  if (!draggedAddonId.value) return;
  event.preventDefault();
  topLevelDropTargetId.value = targetId;
};

const handleAddonDragLeave = (event: DragEvent) => {
  const related = event.relatedTarget as Node | null;
  if (related && (event.currentTarget as Node).contains(related)) return;
  topLevelDropTargetId.value = null;
};

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

const addAddon = async () => {
  const existingIds = new Set(props.addons.map((addon) => addon.id));
  emit("addAddon");
  await nextTick();
  const addedAddon = props.addons.find((addon) => !existingIds.has(addon.id));
  if (addedAddon && !expandedAddonIds.value.includes(addedAddon.id)) {
    expandedAddonIds.value = [...expandedAddonIds.value, addedAddon.id];
  }
};
</script>

<template>
  <div class="rounded-3xl border border-surface-dark/5 bg-white p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 class="font-heading font-bold text-surface-dark">Options complémentaires</h3>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="headerActions" />
      </div>
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
          <div class="flex min-w-0 flex-1 items-center gap-2">
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
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            >
              {{ index + 1 }}
            </div>
            <InputText
              class="min-w-0 flex-1"
              :model-value="addon.title"
              placeholder="Titre de l’option"
              @click.stop
              @keydown.stop
              @update:model-value="
                emit('updateAddon', {
                  id: addon.id,
                  field: 'title',
                  value: $event || '',
                })
              "
            />
            <span
              v-if="!isAddonExpanded(addon.id)"
              class="hidden shrink-0 text-xs text-surface-dark/45 sm:block"
            >
              {{ addon.price?.toFixed(2) || "0.00" }} €{{
                addon.unitLabel ? ` / ${addon.unitLabel}` : ""
              }}
            </span>
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
          class="mt-4 mb-3 grid grid-cols-1 items-start gap-3 border-t border-surface-dark/6 pt-4 sm:grid-cols-2"
        >
          <div class="min-w-0">
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-surface-dark/45">
              Prix
            </label>
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
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-surface-dark/45">
              Éléments
            </label>
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

        <QuoteBlocksEditor
          v-if="isAddonExpanded(addon.id)"
          :model-value="addon.blocks || []"
          @update:model-value="emit('updateAddonBlocks', { addonId: addon.id, blocks: $event })"
        />
      </div>
    </div>

    <Button
      type="button"
      text
      severity="secondary"
      class="mt-3 w-full justify-start rounded-xl border border-dashed border-surface-dark/15 bg-white"
      label="Ajouter une option"
      @click.stop="addAddon"
    >
      <template #icon><span class="material-symbols-outlined text-base">add</span></template>
    </Button>
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
