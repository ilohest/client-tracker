<!-- DesignSystem.vue -->
<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Divider from "primevue/divider";

// Import des sous-composants
import ThemeImporter from "@/components/design/ThemeImporter.vue";
import DesignColors from "@/components/design/DesignColors.vue";
import DesignTypography from "@/components/design/DesignTypography.vue";
import DesignComponents from "@/components/design/DesignComponents.vue";

const showImport = ref(false);
</script>

<template>
  <div class="max-w-[1200px] mx-auto space-y-12 p-6 pb-20">
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4"
    >
      <div>
        <h1
          class="text-3xl font-bold text-slate-800 flex items-center gap-3 font-heading"
        >
          <span
            class="material-symbols-outlined text-4xl text-[var(--color-primary)]"
            >palette</span
          >
          Design System
        </h1>
        <p class="text-slate-500 mt-2 font-body">
          Référence technique de l'identité visuelle et des composants.
        </p>
      </div>

      <Button
        :label="showImport ? 'Fermer les outils' : 'Configurer le thème'"
        :severity="showImport ? 'secondary' : 'primary'"
        outlined
        @click="showImport = !showImport"
      >
        <template #icon>
          <span class="material-symbols-outlined text-lg">{{ showImport ? 'close' : 'tune' }}</span>
        </template>
      </Button>
    </div>

    <div v-if="showImport" class="animate-fade-in">
      <ThemeImporter @close="showImport = false" />
    </div>

    <section>
      <h2
        class="text-xl font-bold text-slate-700 mb-6 border-b border-slate-200 pb-2 font-heading flex items-center gap-2"
      >
        <span class="material-symbols-outlined text-primary">palette</span> Palette de Couleurs
      </h2>
      <DesignColors />
    </section>

    <section>
      <h2
        class="text-xl font-bold text-slate-700 mb-6 border-b border-slate-200 pb-2 font-heading flex items-center gap-2"
      >
        <span class="material-symbols-outlined text-primary">edit</span> Typographie
      </h2>
      <DesignTypography />
    </section>

    <section>
      <h2
        class="text-xl font-bold text-slate-700 mb-6 border-b border-slate-200 pb-2 font-heading flex items-center gap-2"
      >
        <span class="material-symbols-outlined text-primary">widgets</span> Composants UI
      </h2>
      <DesignComponents />
    </section>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
