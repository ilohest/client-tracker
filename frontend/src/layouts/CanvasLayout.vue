<script setup lang="ts">
  import AppHeader from "../components/AppHeader.vue";
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-white">
    <AppHeader />

    <main class="flex-1 relative overflow-hidden flex">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
  </div>
</template>
