<!-- AuthLayout.vue -->

<script setup lang="ts">
import { computed, ref } from "vue";
import AuthOrbBackground from "@/components/auth/AuthOrbBackground.vue";

// Pas de logique complexe, juste de la structure
const year = new Date().getFullYear();

// Parallax du logo au survol : même mécanique que WelcomeCard.vue (dashboard).
const parallaxX = ref(0);
const parallaxY = ref(0);

const parallaxStyle = computed(() => ({
  "--logo-shift-x": `${parallaxX.value}px`,
  "--logo-shift-y": `${parallaxY.value}px`,
}));

const handlePointerMove = (event: PointerEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  parallaxX.value = x * 22;
  parallaxY.value = y * 16;
};

const resetParallax = () => {
  parallaxX.value = 0;
  parallaxY.value = 0;
};
</script>

<template>
  <div class="min-h-screen flex bg-surface-light">
    <div
      class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-light items-center justify-center p-12"
      :style="parallaxStyle"
      @pointermove="handlePointerMove"
      @pointerleave="resetParallax"
    >
      <div class="absolute inset-0 z-0">
        <AuthOrbBackground />
      </div>

      <div class="relative z-10 text-center max-w-lg text-surface-dark">

        <img
          src="/img/logo.png"
          alt="Logo"
          class="w-72 h-auto object-contain mx-auto mb-8 drop-shadow-lg transition-transform duration-300 ease-out"
          style="transform: translate3d(var(--logo-shift-x), var(--logo-shift-y), 0);"
        />


        <h2 class="text-3xl font-heading font-bold mb-4">
          Bienvenue sur votre espace.
        </h2>
        <p class="text-lg font-body text-surface-dark/60 leading-relaxed">
          Gérez vos activités, analysez vos données et développez votre business
          avec notre suite d'outils performants.
        </p>
      </div>

      <div class="absolute bottom-8 text-surface-dark/30 text-xs font-mono">
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
          class="w-44 h-auto object-contain mx-auto"
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
