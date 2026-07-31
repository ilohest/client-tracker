<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { QuoteBlock, QuoteBlockKind, QuoteTable } from "@client-tracker/contracts";
import Button from "primevue/button";
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";
import QuoteTableBlockEditor from "@/components/quotes/QuoteTableBlockEditor.vue";
import {
  MAX_BLOCK_DEPTH,
  createBlock,
  createEmptyTable,
  matchInputRule,
  normalizeBlockDepths,
  numberedIndex,
  parseClipboardBlocks,
} from "@/utils/quoteBlocks";

const props = defineProps<{ modelValue: QuoteBlock[] }>();
const emit = defineEmits<{ "update:modelValue": [value: QuoteBlock[]] }>();

const INDENT_PX = 22;
const BULLET_GLYPHS = ["•", "◦", "▪", "▫"];

/* ------------------------------------------------------------------ */
/* Focus                                                               */
/* ------------------------------------------------------------------ */

const inputs = new Map<string, HTMLTextAreaElement>();
const registerInput = (id: string, element: unknown) => {
  if (element instanceof HTMLTextAreaElement) inputs.set(id, element);
  else inputs.delete(id);
};

/** `caret = -1` place le curseur en fin de bloc. */
const focusBlock = async (id: string, caret = -1) => {
  await nextTick();
  const element = inputs.get(id);
  if (!element) return;
  element.focus();
  const position = caret < 0 ? element.value.length : Math.min(caret, element.value.length);
  element.setSelectionRange(position, position);
};

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

const commit = (blocks: QuoteBlock[]) =>
  emit("update:modelValue", normalizeBlockDepths(blocks));

const replaceAt = (index: number, patch: Partial<QuoteBlock>) =>
  commit(
    props.modelValue.map((block, position) => {
      if (position !== index) return block;
      const next = { ...block, ...patch };
      // Firestore refuse les valeurs `undefined` : on retire la clé.
      if (next.table === undefined) delete next.table;
      return next;
    }),
  );

const setKind = (index: number, kind: QuoteBlockKind) => {
  const block = props.modelValue[index];
  if (kind === "table") {
    replaceAt(index, { kind, depth: 0, table: block.table || createEmptyTable() });
    return;
  }
  replaceAt(index, { kind, table: undefined });
  focusBlock(block.id);
};

const insertAt = (index: number, blocks: QuoteBlock[]) => {
  const next = [...props.modelValue];
  next.splice(index, 0, ...blocks);
  commit(next);
};

const removeAt = (index: number) => {
  const next = props.modelValue.filter((_, position) => position !== index);
  commit(next);
  const neighbour = next[index - 1] || next[index];
  if (neighbour) focusBlock(neighbour.id);
};

const duplicateAt = (index: number) => {
  const block = props.modelValue[index];
  const copy = createBlock({ ...block });
  insertAt(index + 1, [copy]);
  focusBlock(copy.id, 0);
};

const addBlockAtEnd = (kind: QuoteBlockKind = "paragraph") => {
  const block = createBlock({ kind, table: kind === "table" ? createEmptyTable() : undefined });
  insertAt(props.modelValue.length, [block]);
  if (kind !== "table") focusBlock(block.id);
};

/* ------------------------------------------------------------------ */
/* Édition texte                                                       */
/* ------------------------------------------------------------------ */

const onInput = (index: number, event: Event) => {
  const element = event.target as HTMLTextAreaElement;
  const block = props.modelValue[index];
  // Un préfixe markdown tapé en début de bloc change le type sans passer par un menu.
  if (block.kind !== "heading" || !element.value.startsWith("#")) {
    const rule = matchInputRule(element.value);
    if (rule && rule.kind !== block.kind) {
      replaceAt(index, { kind: rule.kind, text: rule.text });
      focusBlock(block.id, 0);
      return;
    }
  }
  replaceAt(index, { text: element.value });
};

/** Entrée : coupe le bloc au curseur. Sur un bloc de liste vide, sort de la liste. */
const splitBlock = (index: number, element: HTMLTextAreaElement) => {
  const block = props.modelValue[index];
  const caret = element.selectionStart ?? block.text.length;
  const before = block.text.slice(0, caret);
  const after = block.text.slice(caret);

  if (!block.text.trim() && block.kind !== "paragraph") {
    if (block.depth > 0) replaceAt(index, { depth: block.depth - 1 });
    else replaceAt(index, { kind: "paragraph" });
    focusBlock(block.id);
    return;
  }

  const created = createBlock({
    // Un titre n'engendre pas un autre titre : on enchaîne sur du texte.
    kind: block.kind === "heading" ? "paragraph" : block.kind,
    depth: block.depth,
    text: after,
  });
  const next = [...props.modelValue];
  next[index] = { ...block, text: before };
  next.splice(index + 1, 0, created);
  commit(next);
  focusBlock(created.id, 0);
};

/**
 * Retour arrière en début de bloc : désindente, puis retire le style de liste,
 * puis fusionne avec le bloc précédent — jamais de suppression surprise.
 */
const mergeBackwards = (index: number) => {
  const block = props.modelValue[index];
  if (block.depth > 0) {
    replaceAt(index, { depth: block.depth - 1 });
    return;
  }
  if (block.kind !== "paragraph") {
    replaceAt(index, { kind: "paragraph" });
    return;
  }
  const previous = props.modelValue[index - 1];
  if (!previous) return;
  if (previous.kind === "table") {
    if (!block.text) removeAt(index);
    return;
  }
  const caret = previous.text.length;
  const next = props.modelValue.filter((_, position) => position !== index);
  next[index - 1] = { ...previous, text: previous.text + block.text };
  commit(next);
  focusBlock(previous.id, caret);
};

const indent = (index: number) => {
  const block = props.modelValue[index];
  const previous = props.modelValue[index - 1];
  if (!previous) return;
  const maxDepth = Math.min(MAX_BLOCK_DEPTH, previous.depth + 1);
  if (block.depth >= maxDepth) return;
  replaceAt(index, { depth: block.depth + 1 });
};

const outdent = (index: number) => {
  const block = props.modelValue[index];
  if (block.depth === 0) return;
  replaceAt(index, { depth: block.depth - 1 });
};

const moveFocus = (index: number, direction: -1 | 1) => {
  const target = props.modelValue[index + direction];
  if (!target || target.kind === "table") return false;
  focusBlock(target.id, direction === -1 ? -1 : 0);
  return true;
};

const onKeydown = (index: number, event: KeyboardEvent) => {
  const element = event.target as HTMLTextAreaElement;
  const caret = element.selectionStart ?? 0;
  const hasSelection = element.selectionStart !== element.selectionEnd;

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    splitBlock(index, element);
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    if (event.shiftKey) outdent(index);
    else indent(index);
    focusBlock(props.modelValue[index].id, caret);
    return;
  }
  if (event.key === "Backspace" && caret === 0 && !hasSelection) {
    event.preventDefault();
    mergeBackwards(index);
    return;
  }
  if (event.key === "ArrowUp" && !hasSelection && caret === 0) {
    if (moveFocus(index, -1)) event.preventDefault();
    return;
  }
  if (event.key === "ArrowDown" && !hasSelection && caret === element.value.length) {
    if (moveFocus(index, 1)) event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    element.blur();
  }
};

/* ------------------------------------------------------------------ */
/* Collage                                                             */
/* ------------------------------------------------------------------ */

const onPaste = (index: number, event: ClipboardEvent) => {
  const parsed = parseClipboardBlocks(event.clipboardData);
  const isSimple = parsed.length <= 1 && parsed[0]?.kind === "paragraph";
  // Un simple bout de texte reste un collage natif (le curseur ne bouge pas).
  if (!parsed.length || isSimple) return;
  event.preventDefault();

  const element = event.target as HTMLTextAreaElement;
  const block = props.modelValue[index];
  const caret = element.selectionStart ?? block.text.length;
  const before = block.text.slice(0, caret);
  const after = block.text.slice(caret);

  // Le contenu collé s'imbrique sous le bloc courant plutôt qu'à la racine.
  const incoming = parsed.map((pasted) =>
    createBlock({
      ...pasted,
      depth: Math.min(MAX_BLOCK_DEPTH, block.depth + pasted.depth),
    }),
  );

  const next = [...props.modelValue];
  if (!block.text.trim()) {
    // Bloc vide : il est remplacé par le contenu collé.
    next.splice(index, 1, ...incoming);
  } else {
    next[index] = { ...block, text: before };
    const trailing = after.trim()
      ? [createBlock({ kind: block.kind, depth: block.depth, text: after })]
      : [];
    next.splice(index + 1, 0, ...incoming, ...trailing);
  }
  commit(next);
  const last = incoming[incoming.length - 1];
  if (last && last.kind !== "table") focusBlock(last.id, -1);
};

/* ------------------------------------------------------------------ */
/* Réordonnancement (le bloc emporte ses blocs indentés)               */
/* ------------------------------------------------------------------ */

const draggedId = ref<string | null>(null);

/** Longueur d'un bloc et de sa descendance indentée. */
const branchLength = (index: number): number => {
  const depth = props.modelValue[index].depth;
  let length = 1;
  while (
    index + length < props.modelValue.length &&
    props.modelValue[index + length].depth > depth
  ) {
    length += 1;
  }
  return length;
};

const onDragStart = (event: DragEvent, id: string) => {
  draggedId.value = id;
  // Firefox n'émet pas de drag sans données attachées.
  event.dataTransfer?.setData("text/plain", id);
};

const moveBranch = (targetId: string) => {
  const sourceId = draggedId.value;
  if (!sourceId || sourceId === targetId) return;
  const from = props.modelValue.findIndex((block) => block.id === sourceId);
  const to = props.modelValue.findIndex((block) => block.id === targetId);
  if (from === -1 || to === -1) return;

  const length = branchLength(from);
  if (to > from && to < from + length) return; // on ne se déplace pas dans sa propre branche

  const next = [...props.modelValue];
  const branch = next.splice(from, length);
  const insertion = to > from ? to - length + 1 : to;
  next.splice(insertion, 0, ...branch);
  commit(next);
};

/* ------------------------------------------------------------------ */
/* Menu de bloc                                                        */
/* ------------------------------------------------------------------ */

const blockMenu = ref<InstanceType<typeof Menu> | null>(null);
const menuIndex = ref(-1);

const menuItems = ref<MenuItem[]>([
  {
    label: "Texte",
    icon: "notes",
    command: () => setKind(menuIndex.value, "paragraph"),
  },
  {
    label: "Puce",
    icon: "format_list_bulleted",
    command: () => setKind(menuIndex.value, "bullet"),
  },
  {
    label: "Liste numérotée",
    icon: "format_list_numbered",
    command: () => setKind(menuIndex.value, "numbered"),
  },
  { label: "Titre", icon: "title", command: () => setKind(menuIndex.value, "heading") },
  { label: "Tableau", icon: "table", command: () => setKind(menuIndex.value, "table") },
  { separator: true },
  {
    label: "Dupliquer",
    icon: "content_copy",
    command: () => duplicateAt(menuIndex.value),
  },
  { label: "Supprimer", icon: "delete", command: () => removeAt(menuIndex.value) },
]);

const openMenu = (index: number, event: Event) => {
  menuIndex.value = index;
  blockMenu.value?.toggle(event);
};

/* ------------------------------------------------------------------ */
/* Affichage                                                           */
/* ------------------------------------------------------------------ */

const bulletGlyph = (depth: number) => BULLET_GLYPHS[Math.min(depth, BULLET_GLYPHS.length - 1)];

const placeholderFor = (block: QuoteBlock, index: number) => {
  if (block.kind === "heading") return "Titre";
  if (index === 0 && props.modelValue.length === 1) {
    return "Écrivez ou collez votre contenu — « - » pour une puce, « 1. » pour une liste, « ## » pour un titre";
  }
  if (block.kind === "bullet" || block.kind === "numbered") return "Point";
  return "Texte";
};

const updateTable = (index: number, table: QuoteTable) => replaceAt(index, { table });
</script>

<template>
  <div class="quote-blocks-editor flex flex-col">
    <div
      v-for="(block, index) in modelValue"
      :key="block.id"
      class="group/block relative flex items-start gap-1 rounded-lg py-px transition-colors hover:bg-surface-dark/[0.022]"
      :class="draggedId === block.id ? 'opacity-50' : ''"
      :style="{ marginLeft: `${block.depth * INDENT_PX}px` }"
      @dragover.prevent="moveBranch(block.id)"
    >
      <!-- Poignées : discrètes tant qu'on ne survole pas la ligne -->
      <div class="flex shrink-0 items-center gap-0.5 pt-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          draggable="true"
          class="cursor-grab text-surface-dark/25 active:cursor-grabbing"
          aria-label="Déplacer le bloc"
          title="Déplacer"
          @dragstart="onDragStart($event, block.id)"
          @dragend="draggedId = null"
        >
          <span class="material-symbols-outlined text-base leading-none">drag_indicator</span>
        </button>
        <button
          type="button"
          class="text-surface-dark/25 hover:text-primary"
          aria-label="Changer le type de bloc"
          title="Type de bloc"
          @click="openMenu(index, $event)"
        >
          <span class="material-symbols-outlined text-base leading-none">more_horiz</span>
        </button>
      </div>

      <!-- Marqueur de liste -->
      <span
        v-if="block.kind === 'bullet'"
        class="w-4 shrink-0 pt-[5px] text-center text-sm leading-5 text-surface-dark/45"
        >{{ bulletGlyph(block.depth) }}</span
      >
      <span
        v-else-if="block.kind === 'numbered'"
        class="w-5 shrink-0 pt-[5px] text-right text-xs leading-5 font-semibold text-primary"
        >{{ numberedIndex(modelValue, index) }}.</span
      >
      <span v-else-if="block.kind !== 'table'" class="w-1 shrink-0"></span>

      <div class="min-w-0 flex-1">
        <QuoteTableBlockEditor
          v-if="block.kind === 'table'"
          class="py-1.5"
          :model-value="block.table || createEmptyTable()"
          @update:model-value="updateTable(index, $event)"
        />
        <!--
          Hauteur automatique en pur CSS : le pseudo-élément ::after reçoit une
          copie du texte et dimensionne la cellule de grille, le textarea s'y
          étire. Contrairement à un calcul de scrollHeight, ça reste juste quand
          le bloc est monté dans un accordéon encore replié.
        -->
        <div
          v-else
          class="grow-wrap"
          :class="
            block.kind === 'heading'
              ? 'font-heading text-[15px] font-bold text-surface-dark'
              : 'text-sm'
          "
          :data-replicated-value="block.text"
        >
          <textarea
            :ref="(element) => registerInput(block.id, element)"
            :data-block-id="block.id"
            rows="1"
            class="w-full bg-transparent text-surface-dark outline-none placeholder:text-surface-dark/30 focus:bg-primary/[0.04]"
            :value="block.text"
            :placeholder="placeholderFor(block, index)"
            @input="onInput(index, $event)"
            @keydown="onKeydown(index, $event)"
            @paste="onPaste(index, $event)"
          ></textarea>
        </div>
      </div>

      <button
        type="button"
        class="mt-1 shrink-0 text-surface-dark/20 opacity-0 transition-opacity hover:text-red-500 group-hover/block:opacity-100"
        aria-label="Supprimer le bloc"
        title="Supprimer"
        @click="removeAt(index)"
      >
        <span class="material-symbols-outlined text-base leading-none">close</span>
      </button>
    </div>

    <Menu ref="blockMenu" :model="menuItems" popup class="w-56">
      <template #itemicon="{ item }">
        <span class="material-symbols-outlined text-lg">{{ item.icon }}</span>
      </template>
    </Menu>

    <div class="mt-1 flex flex-wrap items-center gap-1">
      <Button
        type="button"
        text
        severity="secondary"
        size="small"
        class="!px-2 !text-xs"
        label="Texte"
        @click="addBlockAtEnd('paragraph')"
      >
        <template #icon><span class="material-symbols-outlined text-sm">add</span></template>
      </Button>
      <Button
        type="button"
        text
        severity="secondary"
        size="small"
        class="!px-2 !text-xs"
        label="Puce"
        @click="addBlockAtEnd('bullet')"
      >
        <template #icon
          ><span class="material-symbols-outlined text-sm">format_list_bulleted</span></template
        >
      </Button>
      <Button
        type="button"
        text
        severity="secondary"
        size="small"
        class="!px-2 !text-xs"
        label="Tableau"
        @click="addBlockAtEnd('table')"
      >
        <template #icon><span class="material-symbols-outlined text-sm">table</span></template>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.grow-wrap {
  display: grid;
}
/* Le fantôme dicte la hauteur ; l'espace final réserve la ligne d'un retour à la ligne terminal. */
.grow-wrap::after {
  content: attr(data-replicated-value) " ";
  visibility: hidden;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.grow-wrap > textarea,
.grow-wrap::after {
  grid-area: 1 / 1 / 2 / 2;
  min-width: 0;
  padding: 0.25rem;
  border: 0;
  font: inherit;
  line-height: 1.5rem;
  overflow: hidden;
  overflow-wrap: break-word;
  resize: none;
}
</style>
