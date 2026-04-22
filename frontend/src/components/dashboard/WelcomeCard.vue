<!-- WelcomeCard.vue -->
<script setup lang="ts">
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";
import { computed, ref, onMounted } from "vue";


import { useAuthStore } from "../../stores/authStore";
const authStore = useAuthStore();
const userName = computed(() => authStore.user?.displayName || "Créateur");


const toast = useToast();
const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// --- GESTION DYNAMIQUE DES ACCENTS ---
const accents = ref<Array<{ key: string; id: number }>>([]);

const refreshAccents = () => {
  const styles = getComputedStyle(document.documentElement);
  const found = [];
  // On scanne jusqu'à 10 accents potentiels
  for (let i = 1; i <= 10; i++) {
    const key = `--color-accent-${i}`;
    const val = styles.getPropertyValue(key).trim();
    if (val) {
      found.push({ key, id: i });
    }
  }
  accents.value = found;
};

onMounted(() => {
  refreshAccents();
  // On écoute les changements HMR (Hot Module Replacement)
  setInterval(refreshAccents, 1000);
});

// --- FONCTIONS ---

const copyColor = (varName: string, label: string) => {
    const root = document.documentElement;
    const color = getComputedStyle(root).getPropertyValue(varName).trim();

    if (color) {
        navigator.clipboard.writeText(color);
        toast.add({ severity: 'info', summary: 'Copié', detail: `${label} : ${color}`, life: 2000 });
    }
};

const openFont = (fontName: string) => {
    const url = `https://fonts.google.com/specimen/${fontName.replace(/ /g, '+')}`;
    window.open(url, '_blank');
};
</script>

<template>
  <div
    class="bg-surface-card rounded-2xl p-8 shadow-sm border border-surface-dark/5 relative overflow-hidden group h-full transition-all duration-300 hover:shadow-md flex flex-col gap-8"
  >
    <div class="z-10 relative flex justify-between items-start">
      <div>
        <span
          class="text-surface-dark/50 text-xs font-bold uppercase tracking-widest font-body mb-1 block"
        >
          {{ today }}
        </span>
        <h2
          class="text-3xl md:text-4xl font-bold text-surface-dark font-heading leading-tight"
        >
          Bonjour, <span class="text-primary">{{ userName }}</span> 👋
        </h2>
      </div>

      
      <div
        class="hidden sm:flex bg-surface-light p-3 rounded-xl border border-surface-dark/5 shadow-sm shrink-0"
      >
        <img
          src="/img/logo.png"
          alt="Logo"
          class="w-12 h-12 object-contain"
        />
      </div>
      
    </div>

    <div
      class="z-10 relative bg-surface-light/50 p-6 rounded-xl border border-surface-dark/5"
    >
      <p class="text-lg text-surface-dark/80 leading-relaxed font-body">
        Ceci est un aperçu.
        <strong
          class="font-brand text-2xl text-primary cursor-pointer hover:underline decoration-2 decoration-primary/30 mx-1"
          title="Voir sur Google Fonts"
          @click="openFont('Poppins')"
        >
          Poppins
        </strong>
        pour la marque,

        <strong
          class="font-heading text-xl text-surface-dark cursor-pointer hover:underline decoration-2 decoration-surface-dark/30 mx-1"
          title="Voir sur Google Fonts"
          @click="openFont('Poppins')"
        >
          Poppins
        </strong>
        pour impacter, et

        <strong
          class="font-body text-base text-surface-dark/70 cursor-pointer hover:underline decoration-2 decoration-surface-dark/30 mx-1"
          title="Voir sur Google Fonts"
          @click="openFont('Raleway')"
        >
          Raleway
        </strong>
        pour raconter votre histoire.
      </p>
    </div>

    <div class="z-10 relative grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        class="flex flex-col gap-2 p-3 rounded-xl hover:bg-surface-light transition-colors cursor-pointer group/color"
        @click="copyColor('--color-primary', 'Primaire')"
      >
        <div
          class="w-full h-8 rounded-lg shadow-sm ring-1 ring-black/5 flex items-center justify-center text-white"
          style="background-color: var(--color-primary)"
        >
          <span
            class="material-symbols-outlined opacity-0 group-hover/color:opacity-100 text-xs transition-opacity"
          >content_copy</span>
        </div>
        <div class="flex flex-col">
          <span
            class="text-[10px] font-bold uppercase text-surface-dark/50 tracking-wider"
            >Primaire</span
          >
          <span class="text-xs font-mono text-surface-dark font-bold"
            >#4C5EF7</span
          >
        </div>
      </div>

      <div
        class="flex flex-col gap-2 p-3 rounded-xl hover:bg-surface-light transition-colors cursor-pointer group/color"
        @click="copyColor('--color-secondary', 'Secondaire')"
      >
        <div
          class="w-full h-8 rounded-lg shadow-sm ring-1 ring-black/5 flex items-center justify-center text-white"
          style="background-color: var(--color-secondary)"
        >
          <span
            class="material-symbols-outlined opacity-0 group-hover/color:opacity-100 text-xs transition-opacity"
          >content_copy</span>
        </div>
        <div class="flex flex-col">
          <span
            class="text-[10px] font-bold uppercase text-surface-dark/50 tracking-wider"
            >Secondaire</span
          >
          <span class="text-xs font-mono text-surface-dark font-bold"
            >#F8F8F6</span
          >
        </div>
      </div>

      
      <div
        class="col-span-2 flex items-center gap-3 p-3 rounded-xl hover:bg-surface-light transition-colors"
      >
        <div class="flex flex-col">
          <span
            class="text-[10px] font-bold uppercase text-surface-dark/50 tracking-wider mb-2"
            >Neutres</span
          >
          <div class="flex gap-3">
            <div
              class="w-8 h-8 rounded-full shadow-sm ring-1 ring-black/10 cursor-pointer hover:scale-110 transition-transform"
              style="background-color: var(--color-surface-dark)"
              title="Dark (Text)"
              @click.stop="copyColor('--color-surface-dark', 'Dark')"
            ></div>
            <div
              class="w-8 h-8 rounded-full shadow-sm ring-1 ring-black/10 cursor-pointer hover:scale-110 transition-transform"
              style="background-color: var(--color-surface-card)"
              title="Card (Surface)"
              @click.stop="copyColor('--color-surface-card', 'Card')"
            ></div>
            <div
              class="w-8 h-8 rounded-full shadow-sm ring-1 ring-black/10 cursor-pointer hover:scale-110 transition-transform"
              style="background-color: var(--color-surface-light)"
              title="Light (Background)"
              @click.stop="copyColor('--color-surface-light', 'Light')"
            ></div>
          </div>
        </div>
      </div>
      
    </div>

    <div
      v-if="accents.length > 0"
      class="z-10 relative pt-4 border-t border-surface-dark/5"
    >
      <span
        class="text-[10px] font-bold text-surface-dark/40 uppercase tracking-widest mb-3 block"
        >Accents</span
      >
      <div class="flex flex-wrap gap-2">
        <div
          v-for="accent in accents"
          :key="accent.key"
          class="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform shadow-sm"
          :style="`
                background-color: var(${accent.key});
                border-color: rgba(0, 0, 0, 0.1);
                color: white;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            `"
          @click="copyColor(accent.key, `Accent ${accent.id}`)"
          :title="`Accent ${accent.id}`"
        >
          <span>#{{ accent.id }}</span>
        </div>
      </div>
    </div>

    <div class="z-10 mt-auto flex flex-wrap gap-3 pt-4">
      <Button
        label="Mon Espace"
        @click="$router.push('/profile')"
        class="!font-bold shadow-lg shadow-primary/20"
      >
        <template #icon><span class="material-symbols-outlined text-lg">grid_view</span></template>
      </Button>
      <Button
        label="Documentation"
        outlined
        class="!font-bold border-secondary text-secondary hover:bg-secondary/10"
        @click="$router.push('/documentation')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">menu_book</span></template>
      </Button>
    </div>

    <div
      class="absolute right-0 top-0 w-96 h-96 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none opacity-10"
      style="
        background: radial-gradient(circle, var(--color-primary), transparent);
      "
    ></div>
    <div
      class="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3 pointer-events-none opacity-10"
      style="
        background: radial-gradient(
          circle,
          var(--color-secondary),
          transparent
        );
      "
    ></div>
  </div>
</template>

<style scoped>
.border-secondary {
  border-color: var(--color-secondary) !important;
}
.text-secondary {
  color: var(--color-secondary) !important;
}
.hover\:bg-secondary\/10:hover {
  background-color: color-mix(
    in srgb,
    var(--color-secondary),
    transparent 90%
  ) !important;
}
</style>
