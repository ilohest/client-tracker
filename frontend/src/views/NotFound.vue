<script setup lang="ts">
  import Button from "primevue/button";
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4"
  >
    <div class="relative">
      <h1
        class="text-[150px] font-black text-slate-200 leading-none select-none"
      >
        404
      </h1>
      <div class="absolute inset-0 flex items-center justify-center">
        <span
          class="material-symbols-outlined text-6xl text-primary-500 animate-bounce"
          >explore_off</span
        >
      </div>
    </div>

    <h2 class="text-3xl font-bold text-slate-800 mt-4">Page introuvable</h2>
    <p class="text-slate-500 mt-2 max-w-md">
      Oups ! La page que vous cherchez semble avoir disparu dans le néant
      numérique.
    </p>

    <router-link to="/">
      <Button
        label="Retour au Dashboard"
        class="mt-8"
        size="large"
      >
        <template #icon><span class="material-symbols-outlined text-lg">home</span></template>
      </Button>
    </router-link>
  </div>
</template>
