<!-- frontend/src/components/widgets/ -->

<script setup lang="ts">
  import Button from "primevue/button";
</script>

<template>
  <div
    class="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl p-5 shadow-sm text-white flex flex-col justify-between h-full relative overflow-hidden"
  >
    <div class="z-10">
      <div class="flex justify-between items-start">
        <h3 class="font-bold text-lg">Assistant Telegram</h3>
      </div>
      <p class="text-blue-50 text-sm mt-1 opacity-90">
        Pilotez votre application depuis votre mobile.
      </p>
    </div>

    <div class="z-10 mt-4">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 text-sm bg-black/10 p-2 rounded">
          <span class="font-mono bg-black/20 px-1 rounded">/ping</span>
          <span>Vérifier le statut</span>
        </div>
        <div class="flex items-center gap-2 text-sm bg-black/10 p-2 rounded">
          <span class="font-mono bg-black/20 px-1 rounded">/me</span>
          <span>Voir mes stats</span>
        </div>
      </div>
    </div>

    <span
      class="material-symbols-outlined absolute -bottom-4 -right-4 text-[8rem] opacity-10 rotate-12"
      >smart_toy</span
    >
  </div>
</template>
