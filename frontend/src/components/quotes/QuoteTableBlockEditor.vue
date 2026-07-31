<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { QuoteTable } from "@client-tracker/contracts";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import { createEntityId } from "@/utils/id";
import {
  createTableRow,
  normalizeTable,
  parseTableFromText,
} from "@/utils/quoteBlocks";

const props = defineProps<{ modelValue: QuoteTable }>();
const emit = defineEmits<{ "update:modelValue": [value: QuoteTable] }>();

const root = ref<HTMLElement | null>(null);

const commit = (table: QuoteTable) => emit("update:modelValue", normalizeTable(table));

const columnCount = () => Math.max(1, props.modelValue.columns.length);

/** Redonne le focus à une cellule après une mutation qui rerend la grille. */
const focusCell = async (rowIndex: number, columnIndex: number) => {
  await nextTick();
  const selector = `[data-cell="${rowIndex}:${columnIndex}"]`;
  root.value?.querySelector<HTMLInputElement>(selector)?.focus();
};

const updateColumn = (index: number, value: string) =>
  commit({
    ...props.modelValue,
    columns: props.modelValue.columns.map((column, position) =>
      position === index ? value : column,
    ),
  });

const updateCell = (rowIndex: number, columnIndex: number, value: string) =>
  commit({
    ...props.modelValue,
    rows: props.modelValue.rows.map((row, position) =>
      position === rowIndex
        ? {
            ...row,
            cells: row.cells.map((cell, cellPosition) =>
              cellPosition === columnIndex ? value : cell,
            ),
          }
        : row,
    ),
  });

const addColumn = () => {
  commit({
    ...props.modelValue,
    columns: [...props.modelValue.columns, ""],
    rows: props.modelValue.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })),
  });
  focusCell(-1, columnCount());
};

const removeColumn = (index: number) => {
  if (columnCount() <= 1) return;
  commit({
    ...props.modelValue,
    columns: props.modelValue.columns.filter((_, position) => position !== index),
    rows: props.modelValue.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, position) => position !== index),
    })),
  });
};

const addRow = () => {
  commit({
    ...props.modelValue,
    rows: [...props.modelValue.rows, createTableRow(columnCount())],
  });
  focusCell(props.modelValue.rows.length, 0);
};

const removeRow = (index: number) =>
  commit({
    ...props.modelValue,
    rows: props.modelValue.rows.filter((_, position) => position !== index),
  });

const toggleHeader = (value: boolean) =>
  commit({ ...props.modelValue, hasHeader: value });

/** Tab sur la dernière cellule prolonge le tableau au lieu d'en sortir. */
const onCellKeydown = (event: KeyboardEvent, rowIndex: number, columnIndex: number) => {
  const isLastColumn = columnIndex === columnCount() - 1;
  const isLastRow = rowIndex === props.modelValue.rows.length - 1;

  if (event.key === "Tab" && !event.shiftKey && isLastColumn && isLastRow) {
    event.preventDefault();
    addRow();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    if (isLastRow) addRow();
    else focusCell(rowIndex + 1, columnIndex);
  }
};

/**
 * Coller une grille (Excel, Sheets, tableau markdown) remplit le tableau à
 * partir de la cellule visée, en l'agrandissant si nécessaire.
 * `rowIndex === -1` désigne la ligne d'en-tête.
 */
const onCellPaste = (event: ClipboardEvent, rowIndex: number, columnIndex: number) => {
  const pasted = parseTableFromText(event.clipboardData?.getData("text/plain") || "");
  if (!pasted) return;
  event.preventDefault();

  const incoming = [
    ...(pasted.hasHeader ? [pasted.columns] : []),
    ...pasted.rows.map((row) => row.cells),
  ];
  const nextColumnCount = Math.max(
    columnCount(),
    columnIndex + Math.max(...incoming.map((row) => row.length)),
  );

  const columns = Array.from(
    { length: nextColumnCount },
    (_, position) => props.modelValue.columns[position] || "",
  );
  // Coller sur l'en-tête consomme la première ligne collée comme titres de colonnes.
  const bodyIncoming = rowIndex === -1 ? incoming.slice(1) : incoming;
  if (rowIndex === -1) {
    (incoming[0] || []).forEach((value, offset) => {
      columns[columnIndex + offset] = value;
    });
  }

  const firstBodyRow = Math.max(0, rowIndex);
  const nextRowCount = Math.max(
    props.modelValue.rows.length,
    firstBodyRow + bodyIncoming.length,
  );

  const rows = Array.from({ length: nextRowCount }, (_, position) => {
    const existing = props.modelValue.rows[position];
    const cells = Array.from(
      { length: nextColumnCount },
      (_, cellPosition) => existing?.cells[cellPosition] || "",
    );
    const incomingRow = bodyIncoming[position - firstBodyRow];
    if (incomingRow) {
      incomingRow.forEach((value, offset) => {
        cells[columnIndex + offset] = value;
      });
    }
    return { id: existing?.id || createEntityId(), cells };
  });

  commit({ ...props.modelValue, columns, rows });
};
</script>

<template>
  <div ref="root" class="quote-table-block">
    <div class="overflow-x-auto rounded-xl border border-surface-dark/10 bg-white">
      <table class="w-full border-collapse text-sm">
        <thead v-if="modelValue.hasHeader">
          <tr class="bg-surface-dark/[0.04]">
            <th
              v-for="(column, columnIndex) in modelValue.columns"
              :key="`column-${columnIndex}`"
              class="group/col relative border-b border-surface-dark/10 p-0 text-left"
            >
              <input
                :data-cell="`-1:${columnIndex}`"
                class="w-full bg-transparent px-2.5 py-1.5 font-semibold text-surface-dark outline-none placeholder:font-normal placeholder:text-surface-dark/30 focus:bg-primary/5"
                :value="column"
                :placeholder="`Colonne ${columnIndex + 1}`"
                @input="updateColumn(columnIndex, ($event.target as HTMLInputElement).value)"
                @paste="onCellPaste($event, -1, columnIndex)"
              />
              <button
                v-if="modelValue.columns.length > 1"
                type="button"
                class="absolute right-0.5 top-0.5 hidden text-surface-dark/35 hover:text-red-500 group-hover/col:block"
                aria-label="Supprimer la colonne"
                title="Supprimer la colonne"
                @click="removeColumn(columnIndex)"
              >
                <span class="material-symbols-outlined text-sm">close</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in modelValue.rows"
            :key="row.id"
            class="group/row border-b border-surface-dark/8 last:border-b-0"
          >
            <td
              v-for="(cell, columnIndex) in row.cells"
              :key="`${row.id}-${columnIndex}`"
              class="relative border-r border-surface-dark/8 p-0 last:border-r-0"
            >
              <input
                :data-cell="`${rowIndex}:${columnIndex}`"
                class="w-full bg-transparent px-2.5 py-1.5 text-surface-dark outline-none placeholder:text-surface-dark/25 focus:bg-primary/5"
                :value="cell"
                :placeholder="columnIndex === 0 && !modelValue.hasHeader ? 'Valeur' : ''"
                @input="updateCell(rowIndex, columnIndex, ($event.target as HTMLInputElement).value)"
                @keydown="onCellKeydown($event, rowIndex, columnIndex)"
                @paste="onCellPaste($event, rowIndex, columnIndex)"
              />
              <button
                v-if="columnIndex === row.cells.length - 1 && modelValue.rows.length > 1"
                type="button"
                class="absolute -right-5 top-1/2 hidden -translate-y-1/2 text-surface-dark/35 hover:text-red-500 group-hover/row:block"
                aria-label="Supprimer la ligne"
                title="Supprimer la ligne"
                @click="removeRow(rowIndex)"
              >
                <span class="material-symbols-outlined text-sm">close</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-1.5 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        text
        severity="secondary"
        size="small"
        class="!px-2 !text-xs"
        label="Ligne"
        @click="addRow"
      >
        <template #icon><span class="material-symbols-outlined text-sm">add</span></template>
      </Button>
      <Button
        type="button"
        text
        severity="secondary"
        size="small"
        class="!px-2 !text-xs"
        label="Colonne"
        @click="addColumn"
      >
        <template #icon><span class="material-symbols-outlined text-sm">add</span></template>
      </Button>
      <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-surface-dark/60">
        <Checkbox
          :model-value="modelValue.hasHeader"
          binary
          @update:model-value="toggleHeader($event)"
        />
        Ligne d'en-tête
      </label>
    </div>
    <p class="mt-1 text-[11px] text-surface-dark/40">
      Astuce : collez directement une plage Excel ou Google Sheets dans une cellule.
    </p>
  </div>
</template>
