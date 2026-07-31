<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import Quill from "quill";
import { EmbedBlot } from "parchment";
import "quill/dist/quill.snow.css";

// Quill traite par défaut Entrée et Maj + Entrée comme des séparateurs de
// paragraphe. Ce blot crée un vrai retour souple, conservé comme <br> dans le
// HTML envoyé au PDF.
class SoftBreakBlot extends EmbedBlot {
  static blotName = "soft-break";
  static tagName = "BR";

  static value() {
    return "";
  }
}

Quill.register(SoftBreakBlot, true);

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  { placeholder: "" },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const editorRoot = ref<HTMLElement | null>(null);
let editor: Quill | null = null;
let applyingExternalValue = false;

const emptyEditorHtml = "<p><br></p>";

const setEditorHtml = (value: string) => {
  if (!editor) return;
  applyingExternalValue = true;
  editor.setText("", "silent");
  if (value) editor.clipboard.dangerouslyPasteHTML(value, "silent");
  applyingExternalValue = false;
};

onMounted(() => {
  if (!editorRoot.value) return;
  editor = new Quill(editorRoot.value, {
    theme: "snow",
    placeholder: props.placeholder,
    modules: {
      toolbar: [["bold", "italic", "underline"], [{ list: "bullet" }, { list: "ordered" }], ["clean"]],
      keyboard: {
        bindings: {
          "soft-break": {
            key: "Enter",
            shiftKey: true,
            handler(this: { quill: Quill }, range: { index: number; length: number }) {
              if (range.length) this.quill.deleteText(range.index, range.length, "user");
              this.quill.insertEmbed(range.index, "soft-break", "", "user");
              this.quill.setSelection(range.index + 1, 0, "silent");
              return false;
            },
          },
        },
      },
    },
  });
  setEditorHtml(props.modelValue);
  editor.on("text-change", () => {
    if (applyingExternalValue || !editor) return;
    const html = editor.root.innerHTML === emptyEditorHtml ? "" : editor.root.innerHTML;
    emit("update:modelValue", html);
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor) return;
    const current = editor.root.innerHTML === emptyEditorHtml ? "" : editor.root.innerHTML;
    if (current !== value) setEditorHtml(value);
  },
);

onBeforeUnmount(() => {
  editor = null;
});
</script>

<template>
  <div class="rich-text-editor rounded-xl border border-surface-dark/12 bg-white">
    <div ref="editorRoot"></div>
  </div>
</template>

<style scoped>
:deep(.ql-toolbar.ql-snow) {
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--p-surface-900) 12%, transparent);
  padding: 0.5rem 0.65rem;
}

:deep(.ql-container.ql-snow) {
  min-height: 10rem;
  border: 0;
  font-family: inherit;
  font-size: 0.9375rem;
}

:deep(.ql-editor) {
  min-height: 10rem;
  line-height: 1.65;
  color: var(--p-surface-900);
}

/* Entrée crée un paragraphe : on le rend visuellement distinct d'un simple
   retour souple (Maj + Entrée), qui reste dans le même paragraphe. */
:deep(.ql-editor p) {
  margin: 0 0 0.7rem;
}

:deep(.ql-editor p:last-child) {
  margin-bottom: 0;
}

:deep(.ql-editor.ql-blank::before) {
  color: color-mix(in srgb, var(--p-surface-900) 42%, transparent);
  font-style: normal;
}

:deep(.ql-editor ul),
:deep(.ql-editor ol) {
  padding-left: 1.5rem;
}
</style>
