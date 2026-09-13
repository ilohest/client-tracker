<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  icon: string;
  count?: number | null;
  clickable?: boolean;
}>(), {
  count: null,
  clickable: false,
});

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <component
      :is="clickable ? 'button' : 'div'"
      :type="clickable ? 'button' : undefined"
      class="group inline-flex items-center gap-2 text-left"
      :class="clickable ? 'rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''"
      @click="clickable && emit('click')"
    >
      <span class="material-symbols-outlined text-xl text-primary">{{ icon }}</span>
      <h3 class="font-heading text-lg font-bold text-surface-dark transition-colors" :class="clickable ? 'group-hover:text-primary' : ''">
        {{ title }}
      </h3>
      <span
        v-if="clickable"
        class="material-symbols-outlined text-lg text-surface-dark/35 transition group-hover:translate-x-0.5 group-hover:text-primary"
      >arrow_forward</span>
    </component>
    <span
      v-if="count !== null"
      class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
    >{{ count }}</span>
  </div>
</template>
