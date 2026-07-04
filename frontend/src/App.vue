<!-- App.vue -->
<script setup lang="ts">
import Toast from 'primevue/toast';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// On définit les pages où le chat doit être masqué
const hideChatOnRoutes = ['login', 'register', 'forgot-password', 'not-found'];

// Computed property : True si on n'est PAS sur une page interdite
const shouldShowChat = computed(() => {
  return !hideChatOnRoutes.includes(route.name as string);
});


</script>

<template>
  <Toast position="bottom-right" />
  <router-view />

  
</template>

<style>
/* --- APPLICATION DU THEME DE POLICES --- */
:root {
  --font-brand: "Poppins", sans-serif;
  --font-heading: "Geist Pixel", "Poppins", sans-serif;
  --font-body: "Raleway", sans-serif;
}

body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-heading);
}

.font-brand {
  font-family: var(--font-brand);
}
</style>
