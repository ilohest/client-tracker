<script setup lang="ts">
import { ref } from "vue";
import type { QuoteSection } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import { createEntityId } from "@/utils/quote";

const props = defineProps<{
  modelValue: QuoteSection[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: QuoteSection[]];
}>();

const collapsed = ref<Set<string>>(new Set());
const toggleCollapse = (id: string) => {
  const next = new Set(collapsed.value);
  next.has(id) ? next.delete(id) : next.add(id);
  collapsed.value = next;
};
const isExpanded = (id: string) => !collapsed.value.has(id);

const commit = (sections: QuoteSection[]) => emit("update:modelValue", sections);

const mapSection = (
  sectionId: string,
  updater: (section: QuoteSection) => QuoteSection,
) =>
  commit(
    props.modelValue.map((section) =>
      section.id === sectionId ? updater(section) : section,
    ),
  );

// ---- Lignes (sections) ----
const addSection = () => {
  const section: QuoteSection = {
    id: createEntityId(),
    title: "",
    description: "",
    items: [],
    price: 0,
    subSections: [],
  };
  commit([...props.modelValue, section]);
};
const removeSection = (id: string) =>
  commit(props.modelValue.filter((section) => section.id !== id));
const updateSectionField = (
  id: string,
  field: "title" | "description",
  value: string,
) => mapSection(id, (section) => ({ ...section, [field]: value }));

// ---- Points (items) ----
const addItem = (sectionId: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    items: [...(section.items || []), { id: createEntityId(), text: "", subItems: [] }],
  }));
const updateItem = (sectionId: string, itemId: string, value: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    items: (section.items || []).map((item) =>
      item.id === itemId ? { ...item, text: value } : item,
    ),
  }));
const removeItem = (sectionId: string, itemId: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    items: (section.items || []).filter((item) => item.id !== itemId),
  }));

// ---- Sous-points (subItems) ----
const addSubItem = (sectionId: string, itemId: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    items: (section.items || []).map((item) =>
      item.id === itemId
        ? { ...item, subItems: [...(item.subItems || []), { id: createEntityId(), text: "" }] }
        : item,
    ),
  }));
const updateSubItem = (
  sectionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) =>
  mapSection(sectionId, (section) => ({
    ...section,
    items: (section.items || []).map((item) =>
      item.id === itemId
        ? {
            ...item,
            subItems: (item.subItems || []).map((sub) =>
              sub.id === subItemId ? { ...sub, text: value } : sub,
            ),
          }
        : item,
    ),
  }));
const removeSubItem = (sectionId: string, itemId: string, subItemId: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    items: (section.items || []).map((item) =>
      item.id === itemId
        ? { ...item, subItems: (item.subItems || []).filter((sub) => sub.id !== subItemId) }
        : item,
    ),
  }));

// ---- Sous-sections ----
const addSubSection = (sectionId: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    subSections: [...(section.subSections || []), { id: createEntityId(), title: "", body: "" }],
  }));
const updateSubSection = (
  sectionId: string,
  subId: string,
  field: "title" | "body",
  value: string,
) =>
  mapSection(sectionId, (section) => ({
    ...section,
    subSections: (section.subSections || []).map((sub) =>
      sub.id === subId ? { ...sub, [field]: value } : sub,
    ),
  }));
const removeSubSection = (sectionId: string, subId: string) =>
  mapSection(sectionId, (section) => ({
    ...section,
    subSections: (section.subSections || []).filter((sub) => sub.id !== subId),
  }));

// ---- Réordonnancement des lignes (drag & drop) ----
const draggedSectionId = ref<string | null>(null);
const reorderSections = (targetId: string) => {
  const draggedId = draggedSectionId.value;
  if (!draggedId || draggedId === targetId) return;
  const list = [...props.modelValue];
  const from = list.findIndex((s) => s.id === draggedId);
  const to = list.findIndex((s) => s.id === targetId);
  if (from === -1 || to === -1) return;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  commit(list);
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="(section, index) in modelValue"
      :key="section.id"
      class="rounded-2xl border border-surface-dark/8 bg-white"
      :class="draggedSectionId === section.id ? 'opacity-60 ring-2 ring-primary/30' : ''"
      @dragover.prevent="reorderSections(section.id)"
    >
      <div class="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          draggable="true"
          class="cursor-grab text-surface-dark/30 active:cursor-grabbing"
          aria-label="Réordonner la ligne"
          @dragstart="draggedSectionId = section.id"
          @dragend="draggedSectionId = null"
        >
          <span class="material-symbols-outlined text-lg">drag_indicator</span>
        </button>
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
          >{{ index + 1 }}</span
        >
        <InputText
          class="flex-1"
          :model-value="section.title"
          placeholder="Titre de la ligne"
          @update:model-value="updateSectionField(section.id, 'title', $event || '')"
        />
        <Button text severity="secondary" @click="toggleCollapse(section.id)">
          <template #icon>
            <span class="material-symbols-outlined text-lg">{{
              isExpanded(section.id) ? "expand_less" : "expand_more"
            }}</span>
          </template>
        </Button>
        <Button text severity="danger" @click="removeSection(section.id)">
          <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
        </Button>
      </div>

      <div v-if="isExpanded(section.id)" class="border-t border-surface-dark/6 px-3 py-3">
        <Textarea
          class="w-full"
          :model-value="section.description"
          placeholder="Description libre (optionnel)"
          rows="2"
          auto-resize
          @update:model-value="updateSectionField(section.id, 'description', $event || '')"
        />

        <!-- Points -->
        <div class="mt-3 space-y-2">
          <div
            v-for="item in section.items"
            :key="item.id"
            class="rounded-xl border border-surface-dark/8 bg-surface-light p-2.5"
          >
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined mt-2 text-sm text-surface-dark/30">circle</span>
              <Textarea
                class="flex-1"
                :model-value="item.text"
                placeholder="Point"
                rows="1"
                auto-resize
                @update:model-value="updateItem(section.id, item.id, $event || '')"
              />
              <Button
                text
                severity="danger"
                class="!h-9 !w-9"
                @click="removeItem(section.id, item.id)"
              >
                <template #icon><span class="material-symbols-outlined text-base">close</span></template>
              </Button>
            </div>
            <!-- Sous-points -->
            <div class="mt-2 space-y-1.5 pl-6">
              <div
                v-for="sub in item.subItems"
                :key="sub.id"
                class="flex items-start gap-2"
              >
                <span class="material-symbols-outlined mt-2 text-[10px] text-surface-dark/25">remove</span>
                <Textarea
                  class="flex-1"
                  :model-value="sub.text"
                  placeholder="Sous-point"
                  rows="1"
                  auto-resize
                  @update:model-value="updateSubItem(section.id, item.id, sub.id, $event || '')"
                />
                <Button
                  text
                  severity="danger"
                  class="!h-8 !w-8"
                  @click="removeSubItem(section.id, item.id, sub.id)"
                >
                  <template #icon><span class="material-symbols-outlined text-sm">close</span></template>
                </Button>
              </div>
              <Button
                text
                severity="secondary"
                size="small"
                class="!px-2 !text-xs"
                @click="addSubItem(section.id, item.id)"
              >
                <template #icon><span class="material-symbols-outlined text-sm">add</span></template>
                Sous-point
              </Button>
            </div>
          </div>
          <Button
            text
            severity="secondary"
            class="w-full justify-start rounded-xl border border-dashed border-surface-dark/12 bg-white"
            @click="addItem(section.id)"
          >
            <template #icon><span class="material-symbols-outlined text-base">add</span></template>
            Ajouter un point
          </Button>
        </div>

        <!-- Sous-sections -->
        <div v-if="section.subSections?.length" class="mt-3 space-y-2">
          <div
            v-for="sub in section.subSections"
            :key="sub.id"
            class="rounded-xl border border-surface-dark/8 bg-surface-light p-2.5"
          >
            <div class="flex items-center gap-2">
              <InputText
                class="flex-1"
                :model-value="sub.title"
                placeholder="Titre de la sous-section"
                @update:model-value="updateSubSection(section.id, sub.id, 'title', $event || '')"
              />
              <Button
                text
                severity="danger"
                class="!h-9 !w-9"
                @click="removeSubSection(section.id, sub.id)"
              >
                <template #icon><span class="material-symbols-outlined text-base">delete</span></template>
              </Button>
            </div>
            <Textarea
              class="mt-2 w-full"
              :model-value="sub.body"
              placeholder="Contenu de la sous-section"
              rows="2"
              auto-resize
              @update:model-value="updateSubSection(section.id, sub.id, 'body', $event || '')"
            />
          </div>
        </div>
        <Button
          text
          severity="secondary"
          size="small"
          class="mt-2 !text-xs"
          @click="addSubSection(section.id)"
        >
          <template #icon><span class="material-symbols-outlined text-sm">subdirectory_arrow_right</span></template>
          Ajouter une sous-section
        </Button>
      </div>
    </div>

    <Button
      text
      severity="secondary"
      class="w-full justify-start rounded-xl border border-dashed border-surface-dark/15 bg-white"
      @click="addSection"
    >
      <template #icon><span class="material-symbols-outlined text-base">add</span></template>
      Ajouter une ligne
    </Button>
  </div>
</template>
