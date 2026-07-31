<script setup lang="ts">
import { computed, ref } from "vue";
import type { QuoteBlock, QuoteSection } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import QuoteBlocksEditor from "@/components/quotes/QuoteBlocksEditor.vue";
import { createEntityId } from "@/utils/quote";
import { createBlock, parseClipboardBlocks } from "@/utils/quoteBlocks";

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

const addSection = () =>
  commit([
    ...props.modelValue,
    { id: createEntityId(), title: "", blocks: [createBlock()] },
  ]);

const removeSection = (id: string) =>
  commit(props.modelValue.filter((section) => section.id !== id));

const updateTitle = (id: string, value: string) =>
  mapSection(id, (section) => ({ ...section, title: value }));

const updateBlocks = (id: string, blocks: QuoteBlock[]) =>
  mapSection(id, (section) => ({ ...section, blocks }));

/**
 * Coller du contenu multi-ligne dans le titre d'une ligne : la première ligne
 * devient le titre, le reste alimente les blocs. Évite l'aller-retour
 * « je crée la ligne, puis je recolle le corps ».
 */
const onTitlePaste = (sectionId: string, event: ClipboardEvent) => {
  const parsed = parseClipboardBlocks(event.clipboardData);
  if (parsed.length < 2) return;
  event.preventDefault();
  const [first, ...rest] = parsed;
  mapSection(sectionId, (section) => ({
    ...section,
    title: first.kind === "table" ? section.title : first.text,
    blocks: [
      ...section.blocks.filter((block) => block.text.trim() || block.kind === "table"),
      ...(first.kind === "table" ? [first] : []),
      ...rest,
    ],
  }));
};

const blockSummary = (section: QuoteSection): string => {
  const blocks = section.blocks || [];
  if (!blocks.length) return "Vide";
  const counts = blocks.reduce<Record<string, number>>((accumulator, block) => {
    accumulator[block.kind] = (accumulator[block.kind] || 0) + 1;
    return accumulator;
  }, {});
  const labels: Array<[string, string, string]> = [
    ["bullet", "puce", "puces"],
    ["numbered", "élément numéroté", "éléments numérotés"],
    ["heading", "titre", "titres"],
    ["table", "tableau", "tableaux"],
    ["paragraph", "paragraphe", "paragraphes"],
  ];
  return labels
    .filter(([kind]) => counts[kind])
    .map(([kind, singular, plural]) =>
      `${counts[kind]} ${counts[kind] > 1 ? plural : singular}`,
    )
    .join(" · ");
};

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
                @paste="onTitlePaste(section.id, $event)"
                @update:model-value="updateTitle(section.id, $event || '')"
              />
              <span
                v-if="!active"
                class="hidden shrink-0 text-xs text-surface-dark/40 sm:block"
                >{{ blockSummary(section) }}</span
              >
              <div class="ml-auto flex items-center justify-end gap-1">
                <Button
                  type="button"
                  text
                  rounded
                  severity="danger"
                  class="!h-9 !w-9 shrink-0 !p-0"
                  aria-label="Supprimer"
                  title="Supprimer"
                  @click.stop="removeSection(section.id)"
                >
                  <template #icon
                    ><span class="material-symbols-outlined text-lg">delete</span></template
                  >
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
            <QuoteBlocksEditor
              :model-value="section.blocks"
              @update:model-value="updateBlocks(section.id, $event)"
            />
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <Button
      type="button"
      text
      severity="secondary"
      class="w-full justify-start rounded-xl border border-dashed border-surface-dark/15 bg-white"
      label="Ajouter une ligne"
      @click.stop="addSection"
    >
      <template #icon><span class="material-symbols-outlined text-base">add</span></template>
    </Button>
  </div>
</template>
