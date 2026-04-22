<!-- DesignColors.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useToast } from "primevue/usetoast";

const toast = useToast();
const accents = ref<Array<{ key: string; val: string; label: string }>>([]);

// Fonction pour scanner les accents disponibles dans le CSS
const refreshAccents = () => {
  const styles = getComputedStyle(document.documentElement);
  const found = [];

  // On scanne arbitrairement jusqu'à 10 accents potentiels
  for (let i = 1; i <= 10; i++) {
    const key = `--color-accent-${i}`;
    const val = styles.getPropertyValue(key).trim();

    // Si la variable existe et n'est pas vide
    if (val) {
      found.push({
        key,
        val,
        label: `Accent ${i}`,
      });
    }
  }
  accents.value = found;
};

const copyColor = (varName: string) => {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (color) {
    navigator.clipboard.writeText(color);
    toast.add({
      severity: "info",
      summary: "Copié",
      detail: `${varName}: ${color}`,
      life: 1500,
    });
  }
};

// Liste des nuances PrimeVue standard pour la boucle
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

onMounted(() => {
  refreshAccents();

  // Petit hack : On revérifie périodiquement ou après un court délai
  // car Vite HMR peut prendre quelques ms à injecter le nouveau CSS
  setInterval(refreshAccents, 1000);
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-500 uppercase text-xs tracking-wider">
          Primaire
        </h3>
        <span
          class="text-[10px] font-mono text-slate-400 cursor-pointer hover:text-primary"
          @click="copyColor('--color-primary')"
          >var(--color-primary)</span
        >
      </div>

      <div
        class="flex items-center gap-4 mb-6 cursor-pointer group"
        @click="copyColor('--color-primary')"
      >
        <div
          class="w-16 h-16 rounded-2xl shadow-lg bg-primary ring-4 ring-slate-50 group-hover:scale-105 transition-transform flex items-center justify-center"
        >
          <span
            class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >content_copy</span>
        </div>
        <div class="flex-1">
          <p class="text-xs text-slate-400">Base</p>
          <div
            class="h-2 w-full bg-slate-100 rounded-full mt-2 overflow-hidden"
          >
            <div class="h-full bg-primary w-full"></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-11 gap-1 h-12">
        <div
          v-for="shade in shades"
          :key="shade"
          class="h-full w-full rounded-sm cursor-pointer hover:scale-110 hover:z-10 transition-transform shadow-sm flex items-end justify-center group relative"
          :style="`background-color: var(--p-primary-${shade})`"
          @click="copyColor(`--p-primary-${shade}`)"
        >
          <span
            class="text-[8px] font-mono text-white/0 group-hover:text-white/100 absolute bottom-1 pointer-events-none"
            >{{ shade }}</span
          >
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-500 uppercase text-xs tracking-wider">
          Secondaire
        </h3>
        <span
          class="text-[10px] font-mono text-slate-400 cursor-pointer hover:text-secondary"
          @click="copyColor('--color-secondary')"
          >var(--color-secondary)</span
        >
      </div>

      <div
        class="flex items-center gap-4 mb-6 cursor-pointer group"
        @click="copyColor('--color-secondary')"
      >
        <div
          class="w-16 h-16 rounded-2xl shadow-lg bg-secondary ring-4 ring-slate-50 group-hover:scale-105 transition-transform flex items-center justify-center"
        >
          <span
            class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >content_copy</span>
        </div>
        <div class="flex-1">
          <p class="text-xs text-slate-400">Accent</p>
          <div class="h-8 rounded-lg w-full bg-secondary/20 mt-1"></div>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <h3
        class="font-bold text-slate-500 mb-4 uppercase text-xs tracking-wider"
      >
        Surfaces
      </h3>
      <div class="space-y-3">
        <div
          class="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-slate-200 cursor-pointer hover:border-primary transition-colors"
          @click="copyColor('--color-surface-light')"
        >
          <span class="text-sm text-surface-dark/70 font-mono text-xs"
            >--color-surface-light</span
          >
          <div
            class="w-6 h-6 rounded border border-slate-300 bg-surface-light"
          ></div>
        </div>
        <div
          class="flex items-center justify-between p-3 rounded-lg bg-surface-card border border-slate-200 shadow-sm cursor-pointer hover:border-primary transition-colors"
          @click="copyColor('--color-surface-card')"
        >
          <span class="text-sm text-surface-dark/70 font-mono text-xs"
            >--color-surface-card</span
          >
          <div
            class="w-6 h-6 rounded border border-slate-300 bg-surface-card"
          ></div>
        </div>
        <div
          class="flex items-center justify-between p-3 rounded-lg bg-surface-dark/5 border border-slate-200 cursor-pointer hover:border-primary transition-colors"
          @click="copyColor('--color-surface-dark')"
        >
          <span class="text-sm text-surface-dark font-mono text-xs"
            >--color-surface-dark</span
          >
          <div
            class="w-6 h-6 rounded border border-slate-500 bg-surface-dark"
          ></div>
        </div>
      </div>
    </div>

    <div
      v-if="accents.length > 0"
      class="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
    >
      <h3
        class="font-bold text-slate-500 mb-6 uppercase text-xs tracking-wider flex items-center gap-2"
      >
        Couleurs d'Accent
        <span
          class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] normal-case"
          >{{ accents.length }} couleurs</span
        >
      </h3>

      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div
          v-for="(accent, index) in accents"
          :key="accent.key"
          class="group flex flex-col gap-2 cursor-pointer"
          @click="copyColor(accent.key)"
        >
          <div
            class="h-16 w-full rounded-xl shadow-sm ring-1 ring-slate-100 flex items-center justify-center transition-all group-hover:scale-105 group-hover:shadow-md"
            :style="`background-color: var(${accent.key})`"
          >
            <span
              class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
            >content_copy</span>
          </div>

          <div class="flex flex-col px-1">
            <span
              class="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors"
              >{{ accent.label }}</span
            >
            <span class="text-[10px] text-slate-400 font-mono">{{
              accent.key
            }}</span>
            <span class="text-[10px] text-slate-300 font-mono">{{
              accent.val
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
