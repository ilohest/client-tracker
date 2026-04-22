<!-- DesignTypography.vue -->

<script setup lang="ts">
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";

const toast = useToast();

const fontConfig = {
  brand: "Poppins",
  heading: "Poppins",
  body: "Raleway",
};

const copyFontName = (fontName: string, label: string) => {
  navigator.clipboard.writeText(fontName);
  toast.add({
    severity: "info",
    summary: "Copié",
    detail: `${label} : ${fontName}`,
    life: 2000,
  });
};

const openGoogleFonts = (fontName: string) => {
  window.open(
    `https://fonts.google.com/specimen/${fontName.replace(/ /g, "+")}`,
    "_blank",
  );
};
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-primary/30 transition-colors"
      >
        <div>
          <div class="flex justify-between items-center mb-4">
            <span
              class="text-xs font-bold text-primary uppercase tracking-widest"
              >Brand Font</span
            >
            <div
              class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                text
                rounded
                size="small"
                @click="copyFontName(fontConfig.brand, 'Brand')"
              >
                <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
              </Button>
              <Button
                text
                rounded
                size="small"
                @click="openGoogleFonts(fontConfig.brand)"
              >
                <template #icon><span class="material-symbols-outlined text-lg">open_in_new</span></template>
              </Button>
            </div>
          </div>
          <p class="text-5xl font-brand text-slate-800 leading-tight mb-2">
            Aa Bb Cc
          </p>
          <p class="text-lg font-brand text-slate-600 truncate">
            The quick brown fox
          </p>
        </div>
        <div class="mt-6 pt-4 border-t border-slate-50">
          <code class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{{
            fontConfig.brand
          }}</code>
        </div>
      </div>

      <div
        class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-primary/30 transition-colors"
      >
        <div>
          <div class="flex justify-between items-center mb-4">
            <span
              class="text-xs font-bold text-slate-500 uppercase tracking-widest"
              >Heading Font</span
            >
            <div
              class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                text
                rounded
                size="small"
                @click="copyFontName(fontConfig.heading, 'Heading')"
              >
                <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
              </Button>
              <Button
                text
                rounded
                size="small"
                @click="openGoogleFonts(fontConfig.heading)"
              >
                <template #icon><span class="material-symbols-outlined text-lg">open_in_new</span></template>
              </Button>
            </div>
          </div>
          <p
            class="text-5xl font-heading font-bold text-slate-800 leading-tight mb-2"
          >
            Aa Bb Cc
          </p>
          <p class="text-lg font-heading font-bold text-slate-600 truncate">
            Jumps over the lazy dog
          </p>
        </div>
        <div class="mt-6 pt-4 border-t border-slate-50">
          <code class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{{
            fontConfig.heading
          }}</code>
        </div>
      </div>

      <div
        class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-primary/30 transition-colors"
      >
        <div>
          <div class="flex justify-between items-center mb-4">
            <span
              class="text-xs font-bold text-slate-400 uppercase tracking-widest"
              >Body Font</span
            >
            <div
              class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                text
                rounded
                size="small"
                @click="copyFontName(fontConfig.body, 'Body')"
              >
                <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
              </Button>
              <Button
                text
                rounded
                size="small"
                @click="openGoogleFonts(fontConfig.body)"
              >
                <template #icon><span class="material-symbols-outlined text-lg">open_in_new</span></template>
              </Button>
            </div>
          </div>
          <p class="text-5xl font-body text-slate-800 leading-tight mb-2">
            Aa Bb Cc
          </p>
          <p class="text-lg font-body text-slate-600 truncate">
            0123456789 &@?!
          </p>
        </div>
        <div class="mt-6 pt-4 border-t border-slate-50">
          <code class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{{
            fontConfig.body
          }}</code>
        </div>
      </div>
    </div>

    <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
      <h3
        class="font-bold text-slate-400 uppercase text-xs tracking-wider mb-6 border-b border-slate-100 pb-2"
      >
        Échelle & Hiérarchie
      </h3>

      <div class="space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4">
          <span class="text-xs text-slate-400 font-mono"
            >H1 / font-heading</span
          >
          <div class="md:col-span-3">
            <h1 class="text-4xl md:text-5xl font-bold text-slate-900">
              Design is intelligence made visible.
            </h1>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4">
          <span class="text-xs text-slate-400 font-mono"
            >H2 / font-heading</span
          >
          <div class="md:col-span-3">
            <h2 class="text-3xl font-bold text-slate-800">
              The details are not the details. They make the design.
            </h2>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4">
          <span class="text-xs text-slate-400 font-mono"
            >H3 / font-heading</span
          >
          <div class="md:col-span-3">
            <h3 class="text-2xl font-semibold text-slate-800">
              Good design is obvious. Great design is transparent.
            </h3>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4">
          <span class="text-xs text-slate-400 font-mono">P / font-body</span>
          <div class="md:col-span-3">
            <p class="text-base text-slate-600 leading-relaxed max-w-3xl">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4">
          <span class="text-xs text-slate-400 font-mono"
            >Small / font-body</span
          >
          <div class="md:col-span-3">
            <p class="text-sm text-slate-500">
              Mentions légales : Ce texte est plus petit et sert souvent pour
              les légendes ou les notes de bas de page.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
