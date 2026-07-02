<!-- AuthLayout.vue -->

<script setup lang="ts">
// Pas de logique complexe, juste de la structure
const year = new Date().getFullYear();
</script>

<template>
  <div class="min-h-screen flex bg-surface-light">
    <div
      class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-dark items-center justify-center p-12"
    >
      <div class="absolute inset-0 z-0">
        <div
          class="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30 mix-blend-multiply"
        ></div>
        <div
          class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl"
        ></div>
        <div
          class="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-secondary/20 blur-3xl"
        ></div>
      </div>

      <div class="relative z-10 text-center max-w-lg text-white">
        
        <img
          src="/img/logo.png"
          alt="Logo"
          class="w-24 h-24 object-contain mx-auto mb-8 drop-shadow-lg"
        />
        

        <h2 class="text-3xl font-heading font-bold mb-4">
          Bienvenue sur votre espace.
        </h2>
        <p class="text-lg font-body text-white/70 leading-relaxed">
          Gérez vos activités, analysez vos données et développez votre business
          avec notre suite d'outils performants.
        </p>
      </div>

      <div class="absolute bottom-8 text-white/20 text-xs font-mono">
        &copy; {{ year }} Devisio Inc.
      </div>
    </div>

    <div
      class="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative"
    >
      <div class="lg:hidden mb-8 text-center">
        
        <img
          src="/img/logo.png"
          alt="Logo"
          class="w-12 h-12 object-contain mx-auto"
        />
        
      </div>

      <div
        class="w-full max-w-md bg-surface-card p-8 rounded-2xl shadow-xl shadow-surface-dark/5 border border-surface-dark/5"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
