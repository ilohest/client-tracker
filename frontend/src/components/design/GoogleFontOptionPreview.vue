<script setup lang="ts">
import { computed, onMounted, watch } from "vue";

const props = defineProps<{
  family: string;
  googleFamily?: string;
}>();

const fontHref = computed(() => {
  const family = props.googleFamily || props.family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}&display=swap`;
});

const ensureFontLoaded = () => {
  if (!props.family) return;
  const id = `google-font-preview-${encodeURIComponent(fontHref.value)}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = fontHref.value;
  link.dataset.googleFontPreview = props.family;
  document.head.appendChild(link);
};

onMounted(ensureFontLoaded);
watch(() => [props.family, props.googleFamily], ensureFontLoaded);
</script>

<template>
  <span
    class="block truncate text-base"
    :style="{ fontFamily: `'${family}', system-ui, sans-serif` }"
  >
    {{ family }}
  </span>
</template>
