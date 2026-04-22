<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import Button from "primevue/button";
  import { useToast } from "primevue/usetoast";

  const router = useRouter();
  const toast = useToast();

  // CORRECTION : On nomme la variable 'fontName' pour correspondre au template
  const fontName = ref("Ubuntu");

  // Pour les couleurs, on va lire la variable CSS pour être toujours à jour
  const primaryColor = ref("");

  onMounted(() => {
    // On lit la variable --primary-color définie dans :root
    const style = getComputedStyle(document.documentElement);
    primaryColor.value = style.getPropertyValue("--primary-color").trim();
  });

  const copyToClipboard = () => {
    if (!primaryColor.value) return;
    navigator.clipboard.writeText(primaryColor.value);
    toast.add({
      severity: "info",
      summary: "Copié",
      detail: primaryColor.value,
      life: 1000,
    });
  };
</script>

<template>
  <div
    class="h-full bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group"
  >
    <div class="flex justify-between items-start z-10">
      <div>
        <h3 class="font-bold text-slate-700 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary-500"
            >palette</span
          >
          Design System
        </h3>
        <p class="text-xs text-slate-400 mt-1">Identité & Charte</p>
      </div>
    </div>

    <div class="flex-1 flex flex-col justify-center gap-3 mt-2 z-10">
      <div
        class="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
        @click="copyToClipboard"
        title="Copier le code Hex"
      >
        <div
          class="w-8 h-8 rounded-full bg-primary-500 shadow-sm ring-2 ring-white"
        ></div>
        <span class="text-xs font-mono font-bold text-slate-600">
          {{ primaryColor || "..." }}
        </span>
      </div>

      <div class="flex items-center gap-2 ml-1">
        <span class="text-xs text-slate-400">Police :</span>
        <span class="text-sm font-bold text-slate-700">{{ fontName }}</span>
      </div>
    </div>

    <div class="z-10 mt-auto">
      <Button
        label="Voir tout"
        iconPos="right"
        size="small"
        outlined
        class="w-full"
        @click="router.push({ name: 'design-system' })"
      >
        <template #icon><span class="material-symbols-outlined text-lg">arrow_forward</span></template>
      </Button>
    </div>

    <div
      class="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-tl from-primary-100 to-transparent rounded-full opacity-50 pointer-events-none"
    ></div>
  </div>
</template>
