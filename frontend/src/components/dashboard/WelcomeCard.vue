<!-- WelcomeCard.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useAuthStore } from "../../stores/authStore";

const authStore = useAuthStore();
const userName = computed(() => authStore.user?.displayName || "Créateur");

const today = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const hour = new Date().getHours();
const greeting = computed(() =>
  hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir",
);

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
  <div
    class="relative flex flex-col gap-6 overflow-hidden rounded-md border border-white/10 bg-gradient-to-br from-primary to-[#f08b83] p-6 shadow-[0_3px_14px_rgba(47,43,61,0.08)] sm:flex-row sm:items-center sm:justify-between"
    :style="parallaxStyle"
    @pointermove="handlePointerMove"
    @pointerleave="resetParallax"
  >
    <img
      src="/img/logo.png"
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute left-1/2 top-1/2 hidden w-[620px] max-w-none select-none object-contain opacity-[0.14] brightness-0 invert transition-transform duration-300 ease-out sm:block lg:w-[720px]"
      style="transform: translate3d(var(--logo-shift-x), var(--logo-shift-y), 0) translate(-50%, -50%) rotate(-13deg);"
    />
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_78%,rgba(255,255,255,0.18),transparent_38%),linear-gradient(115deg,transparent_58%,rgba(255,255,255,0.08))]"
    ></div>

    <div class="relative z-10">
      <span
        class="mb-2 block text-xs font-bold uppercase tracking-widest text-white/70"
      >
        {{ today }}
      </span>
      <h2 class="font-heading text-3xl font-bold leading-tight text-white md:text-4xl">
        {{ greeting }}, <span class="text-white">{{ userName }}</span> 👋
      </h2>
      <p class="mt-2 max-w-md text-white/78">
        Voici un aperçu de votre activité. Créez un devis, suivez vos clients et
        gardez le contrôle de votre pipeline.
      </p>
    </div>

    <div
      class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-3xl"
    ></div>
  </div>
</template>
