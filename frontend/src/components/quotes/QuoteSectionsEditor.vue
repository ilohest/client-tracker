<script setup lang="ts">
import { computed, ref } from "vue";
import type { QuoteSection } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import SelectButton from "primevue/selectbutton";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import { createEntityId } from "@/utils/quote";

const props = withDefaults(
  defineProps<{
    modelValue: QuoteSection[];
    storageKey?: string;
  }>(),
  {
    storageKey: "devisio:quote-sections:collapsed",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: QuoteSection[]];
}>();

const readCollapsedState = (): Set<number> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(props.storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((index) => Number.isInteger(index) && index >= 0)
        : [],
    );
  } catch {
    return new Set();
  }
};

const writeCollapsedState = (value: Set<number>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(props.storageKey, JSON.stringify([...value]));
};

const collapsed = ref<Set<number>>(readCollapsedState());
const activeSectionIds = computed<string[]>({
  get: () =>
    props.modelValue
      .filter((_, index) => !collapsed.value.has(index))
      .map((section) => section.id),
  set: (value) => {
    const active = new Set(value || []);
    collapsed.value = new Set(
      props.modelValue
        .map((section, index) => ({ section, index }))
        .filter(({ section }) => !active.has(section.id))
        .map(({ index }) => index),
    );
    writeCollapsedState(collapsed.value);
  },
});

const displayModeOptions: Array<{ label: string; value: NonNullable<QuoteSection["displayMode"]> }> = [
  { label: "Texte simple", value: "title" },
  { label: "Bullets", value: "bullets" },
  { label: "Numérotée", value: "numbered" },
];
type SectionDisplayMode = NonNullable<QuoteSection["displayMode"]>;
const isDisplayMode = (value: unknown): value is SectionDisplayMode =>
  value === "title" || value === "bullets" || value === "numbered";
const resolveDisplayMode = (value: unknown): SectionDisplayMode => {
  if (isDisplayMode(value)) return value;
  if (value && typeof value === "object" && "value" in value) {
    const optionValue = (value as { value?: unknown }).value;
    if (isDisplayMode(optionValue)) return optionValue;
  }
  return "bullets";
};
const getSectionDisplayMode = (section: QuoteSection): SectionDisplayMode =>
  resolveDisplayMode(section.displayMode);

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
    displayMode: "bullets",
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
const updateSectionDisplayMode = (id: string, value: unknown) =>
  mapSection(id, (section) => ({
    ...section,
    displayMode: resolveDisplayMode(value),
  }));

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

const draggedItem = ref<{ sectionId: string; itemId: string } | null>(null);
const reorderItems = (sectionId: string, targetItemId: string) => {
  const dragged = draggedItem.value;
  if (!dragged || dragged.sectionId !== sectionId || dragged.itemId === targetItemId) return;
  mapSection(sectionId, (section) => {
    const list = [...(section.items || [])];
    const from = list.findIndex((item) => item.id === dragged.itemId);
    const to = list.findIndex((item) => item.id === targetItemId);
    if (from === -1 || to === -1) return section;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    return { ...section, items: list };
  });
};

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
  <div class="flex flex-col gap-2.5">
    <Accordion v-model:value="activeSectionIds" multiple class="quote-editor-accordion">
      <AccordionPanel
        v-for="(section, index) in modelValue"
        :key="section.id"
        :value="section.id"
        class="rounded-2xl border border-surface-dark/8 bg-white shadow-[0_1px_0_rgba(47,43,61,0.03)]"
        :class="draggedSectionId === section.id ? 'opacity-60 ring-2 ring-primary/30' : ''"
        @dragover.prevent="reorderSections(section.id)"
      >
        <AccordionHeader as="div">
          <template #default="{ active }">
            <div class="flex items-center gap-2 px-3 py-2 outline-none">
              <button
                type="button"
                draggable="true"
                class="cursor-grab text-surface-dark/30 active:cursor-grabbing"
                aria-label="Réordonner la ligne"
                @click.stop
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
                class="min-w-0 flex-1"
                :model-value="section.title"
                placeholder="Titre de la ligne"
                @click.stop
                @keydown.stop
                @update:model-value="updateSectionField(section.id, 'title', $event || '')"
              />
              <div class="ml-auto flex items-center justify-end gap-1">
                <Button type="button" text severity="danger" class="!h-9 !w-9 shrink-0 !p-0" @click.stop="removeSection(section.id)">
                  <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
                </Button>
                <Button type="button" text severity="secondary" class="!h-9 !w-9 shrink-0 !p-0">
                  <template #icon>
                    <span class="material-symbols-outlined text-lg">{{
                      active ? "expand_less" : "expand_more"
                    }}</span>
                  </template>
                </Button>
              </div>
            </div>
          </template>
          <template #toggleicon><span aria-hidden="true" class="hidden"></span></template>
        </AccordionHeader>

        <AccordionContent>
      <div class="border-t border-surface-dark/6 bg-surface-dark/[0.018] px-3 py-2.5">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">Type de ligne</span>
          <SelectButton
            :model-value="getSectionDisplayMode(section)"
            :options="displayModeOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            @update:model-value="updateSectionDisplayMode(section.id, $event)"
          />
        </div>
        <Textarea
          class="w-full"
          :model-value="section.description"
          :placeholder="
            getSectionDisplayMode(section) === 'title'
              ? 'Texte simple, sans puce ni numérotation'
              : 'Description libre (optionnel)'
          "
          rows="2"
          auto-resize
          @update:model-value="updateSectionField(section.id, 'description', $event || '')"
        />

        <!-- Points -->
        <div v-if="getSectionDisplayMode(section) !== 'title'" class="mt-2.5 space-y-2">
          <div
            v-for="item in section.items"
            :key="item.id"
            class="rounded-xl border border-surface-dark/6 bg-white p-2 shadow-[0_1px_0_rgba(47,43,61,0.02)]"
            :class="draggedItem?.itemId === item.id ? 'opacity-60 ring-2 ring-primary/20' : ''"
            @dragover.prevent="reorderItems(section.id, item.id)"
          >
            <div class="flex items-start gap-2">
              <button
                type="button"
                draggable="true"
                class="mt-2 cursor-grab text-surface-dark/25 active:cursor-grabbing"
                aria-label="Réordonner le point"
                @dragstart="draggedItem = { sectionId: section.id, itemId: item.id }"
                @dragend="draggedItem = null"
              >
                <span class="material-symbols-outlined text-base">drag_indicator</span>
              </button>
              <span
                class="mt-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
                :class="
                  getSectionDisplayMode(section) === 'numbered'
                    ? 'border border-primary/30 bg-primary/8 font-semibold text-primary'
                    : 'bg-surface-dark/20'
                "
                >{{ getSectionDisplayMode(section) === 'numbered' ? (section.items || []).findIndex((entry) => entry.id === item.id) + 1 : '' }}</span
              >
              <Textarea
                class="flex-1"
                :model-value="item.text"
                placeholder="Point"
                rows="1"
                auto-resize
                @update:model-value="updateItem(section.id, item.id, $event || '')"
              />
              <Button
                type="button"
                text
                severity="danger"
                class="!h-9 !w-9"
                @click.stop="removeItem(section.id, item.id)"
              >
                <template #icon><span class="material-symbols-outlined text-base">close</span></template>
              </Button>
            </div>
            <!-- Sous-points -->
            <div class="mt-2 space-y-1.5 rounded-lg bg-surface-dark/[0.025] p-2 pl-5">
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
                  type="button"
                  text
                  severity="danger"
                  class="!h-8 !w-8"
                  @click.stop="removeSubItem(section.id, item.id, sub.id)"
                >
                  <template #icon><span class="material-symbols-outlined text-sm">close</span></template>
                </Button>
              </div>
              <Button
                type="button"
                text
                severity="secondary"
                size="small"
                class="!px-2 !text-xs"
                @click.stop="addSubItem(section.id, item.id)" label="Sous-point">
                <template #icon><span class="material-symbols-outlined text-sm">add</span></template></Button>
            </div>
          </div>
          <Button
            type="button"
            text
            severity="secondary"
            class="w-full justify-start rounded-xl border border-dashed border-surface-dark/12 bg-white"
            @click.stop="addItem(section.id)" label="Ajouter un point">
            <template #icon><span class="material-symbols-outlined text-base">add</span></template></Button>
        </div>

        <!-- Sous-sections -->
        <div
          v-if="getSectionDisplayMode(section) !== 'title' && section.subSections?.length"
          class="mt-2.5 space-y-2"
        >
          <div
            v-for="sub in section.subSections"
            :key="sub.id"
            class="rounded-xl border border-surface-dark/8 bg-surface-light p-2"
          >
            <div class="flex items-center gap-2">
              <InputText
                class="flex-1"
                :model-value="sub.title"
                placeholder="Titre de la sous-section"
                @update:model-value="updateSubSection(section.id, sub.id, 'title', $event || '')"
              />
              <Button
                type="button"
                text
                severity="danger"
                class="!h-9 !w-9"
                @click.stop="removeSubSection(section.id, sub.id)"
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
          v-if="getSectionDisplayMode(section) !== 'title'"
          type="button"
          text
          severity="secondary"
          size="small"
          class="mt-2 !text-xs"
          @click.stop="addSubSection(section.id)" label="Ajouter une sous-section">
          <template #icon><span class="material-symbols-outlined text-sm">subdirectory_arrow_right</span></template></Button>
      </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <Button
      type="button"
      text
      severity="secondary"
      class="w-full justify-start rounded-xl border border-dashed border-surface-dark/15 bg-white"
      @click.stop="addSection" label="Ajouter une ligne">
      <template #icon><span class="material-symbols-outlined text-base">add</span></template></Button>
  </div>
</template>
