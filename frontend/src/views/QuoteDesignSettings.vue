<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import { useToast } from "primevue/usetoast";
import GoogleFontOptionPreview from "@/components/design/GoogleFontOptionPreview.vue";
import {
  DEFAULT_QUOTE_PDF_THEME,
  getQuotePdfFontVariantStyle,
  mixHexWithWhite,
} from "@/lib/quotePdfTheme";
import {
  fetchGoogleFonts,
  getFontVariantOptions,
  type GoogleFontItem,
  type QuoteFontVariantOption,
} from "@/services/googleFontsService";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();
const toast = useToast();
const loading = ref(false);
const fontsLoading = ref(false);
const fontsError = ref("");
const googleFonts = ref<GoogleFontItem[]>([]);
const userProfile = computed(() => authStore.userProfile);

const quotePdfFontOptions = computed(() =>
  googleFonts.value.map((font) => {
    const variants = getFontVariantOptions(font);
    const preview =
      variants.find((variant) => variant.value === "regular") ||
      variants.find((variant) => variant.value === "400") ||
      variants[0];
    return {
      label: font.family,
      value: font.family,
      googleFamily: preview?.googleFamily || font.family.replace(/ /g, "+"),
    };
  }),
);

const form = ref({
  quotePdfTextColor: DEFAULT_QUOTE_PDF_THEME.textColor,
  quotePdfTitleColor: DEFAULT_QUOTE_PDF_THEME.titleColor,
  quotePdfAccentColor: DEFAULT_QUOTE_PDF_THEME.accentColor,
  quotePdfHeadingFont: DEFAULT_QUOTE_PDF_THEME.headingFont,
  quotePdfHeadingFontVariant: DEFAULT_QUOTE_PDF_THEME.headingFontVariant,
  quotePdfHeadingFontGoogleFamily: DEFAULT_QUOTE_PDF_THEME.headingFontGoogleFamily,
  quotePdfBodyFont: DEFAULT_QUOTE_PDF_THEME.bodyFont,
  quotePdfBodyFontVariant: DEFAULT_QUOTE_PDF_THEME.bodyFontVariant,
  quotePdfBodyFontGoogleFamily: DEFAULT_QUOTE_PDF_THEME.bodyFontGoogleFamily,
});

const fillForm = () => {
  form.value = {
    quotePdfTextColor: userProfile.value?.quotePdfTextColor || DEFAULT_QUOTE_PDF_THEME.textColor,
    quotePdfTitleColor: userProfile.value?.quotePdfTitleColor || DEFAULT_QUOTE_PDF_THEME.titleColor,
    quotePdfAccentColor: userProfile.value?.quotePdfAccentColor || DEFAULT_QUOTE_PDF_THEME.accentColor,
    quotePdfHeadingFont: userProfile.value?.quotePdfHeadingFont || DEFAULT_QUOTE_PDF_THEME.headingFont,
    quotePdfHeadingFontVariant: userProfile.value?.quotePdfHeadingFontVariant || DEFAULT_QUOTE_PDF_THEME.headingFontVariant,
    quotePdfHeadingFontGoogleFamily: userProfile.value?.quotePdfHeadingFontGoogleFamily || DEFAULT_QUOTE_PDF_THEME.headingFontGoogleFamily,
    quotePdfBodyFont: userProfile.value?.quotePdfBodyFont || DEFAULT_QUOTE_PDF_THEME.bodyFont,
    quotePdfBodyFontVariant: userProfile.value?.quotePdfBodyFontVariant || DEFAULT_QUOTE_PDF_THEME.bodyFontVariant,
    quotePdfBodyFontGoogleFamily: userProfile.value?.quotePdfBodyFontGoogleFamily || DEFAULT_QUOTE_PDF_THEME.bodyFontGoogleFamily,
  };
  syncFontVariant("heading", false);
  syncFontVariant("body", false);
};

const loadGoogleFonts = async () => {
  fontsLoading.value = true;
  fontsError.value = "";
  try {
    googleFonts.value = await fetchGoogleFonts();
    syncFontVariant("heading", false);
    syncFontVariant("body", false);
  } catch (error: any) {
    fontsError.value = error.message || "Impossible de charger Google Fonts.";
  } finally {
    fontsLoading.value = false;
  }
};

onMounted(() => {
  fillForm();
  void loadGoogleFonts();
});
watch(userProfile, fillForm);

const resetQuotePdfTheme = () => {
  form.value.quotePdfTextColor = DEFAULT_QUOTE_PDF_THEME.textColor;
  form.value.quotePdfTitleColor = DEFAULT_QUOTE_PDF_THEME.titleColor;
  form.value.quotePdfAccentColor = DEFAULT_QUOTE_PDF_THEME.accentColor;
  form.value.quotePdfHeadingFont = DEFAULT_QUOTE_PDF_THEME.headingFont;
  form.value.quotePdfHeadingFontVariant = DEFAULT_QUOTE_PDF_THEME.headingFontVariant;
  form.value.quotePdfHeadingFontGoogleFamily = DEFAULT_QUOTE_PDF_THEME.headingFontGoogleFamily;
  form.value.quotePdfBodyFont = DEFAULT_QUOTE_PDF_THEME.bodyFont;
  form.value.quotePdfBodyFontVariant = DEFAULT_QUOTE_PDF_THEME.bodyFontVariant;
  form.value.quotePdfBodyFontGoogleFamily = DEFAULT_QUOTE_PDF_THEME.bodyFontGoogleFamily;
  syncFontVariant("heading", false);
  syncFontVariant("body", false);
};

const findFont = (family: string): GoogleFontItem | undefined =>
  googleFonts.value.find((font) => font.family === family);

const getFontPreviewFamily = (family: string): string =>
  quotePdfFontOptions.value.find((font) => font.value === family)?.googleFamily ||
  family.replace(/ /g, "+");

const buildMissingVariant = (
  family: string,
  variant: string,
  googleFamily: string,
): QuoteFontVariantOption => {
  const parsed = getQuotePdfFontVariantStyle(variant);
  return {
    label: `${parsed.style === "italic" ? "Italic " : ""}${parsed.weight}`,
    value: variant,
    weight: parsed.weight,
    style: parsed.style,
    googleFamily: googleFamily || `${family.replace(/ /g, "+")}:wght@${parsed.weight}`,
  };
};

const getVariantOptionsFor = (
  kind: "heading" | "body",
): QuoteFontVariantOption[] => {
  const family = kind === "heading" ? form.value.quotePdfHeadingFont : form.value.quotePdfBodyFont;
  const variant =
    kind === "heading" ? form.value.quotePdfHeadingFontVariant : form.value.quotePdfBodyFontVariant;
  const googleFamily =
    kind === "heading"
      ? form.value.quotePdfHeadingFontGoogleFamily
      : form.value.quotePdfBodyFontGoogleFamily;
  const options = getFontVariantOptions(findFont(family));
  if (options.length) return options;
  return [buildMissingVariant(family, variant, googleFamily)];
};

const headingVariantOptions = computed(() => getVariantOptionsFor("heading"));
const bodyVariantOptions = computed(() => getVariantOptionsFor("body"));

function syncFontVariant(kind: "heading" | "body", resetVariant = true) {
  const options = getVariantOptionsFor(kind);
  if (!options.length) return;
  const currentVariant =
    kind === "heading" ? form.value.quotePdfHeadingFontVariant : form.value.quotePdfBodyFontVariant;
  const selected =
    (!resetVariant && options.find((option) => option.value === currentVariant)) ||
    options.find((option) => option.value === "regular") ||
    options.find((option) => option.value === "400") ||
    options[0];

  if (kind === "heading") {
    form.value.quotePdfHeadingFontVariant = selected.value;
    form.value.quotePdfHeadingFontGoogleFamily = selected.googleFamily;
  } else {
    form.value.quotePdfBodyFontVariant = selected.value;
    form.value.quotePdfBodyFontGoogleFamily = selected.googleFamily;
  }
}

watch(
  () => form.value.quotePdfHeadingFont,
  () => syncFontVariant("heading", true),
);

watch(
  () => form.value.quotePdfBodyFont,
  () => syncFontVariant("body", true),
);

watch(
  () => form.value.quotePdfHeadingFontVariant,
  () => syncFontVariant("heading", false),
);

watch(
  () => form.value.quotePdfBodyFontVariant,
  () => syncFontVariant("body", false),
);

const headingFontStyle = computed(() =>
  getQuotePdfFontVariantStyle(form.value.quotePdfHeadingFontVariant),
);
const bodyFontStyle = computed(() =>
  getQuotePdfFontVariantStyle(form.value.quotePdfBodyFontVariant),
);

const saveSettings = async () => {
  if (!authStore.user) return;
  loading.value = true;
  try {
    await authStore.updateUserProfile({
      displayName: userProfile.value?.displayName || authStore.user.displayName || "",
      quotePdfTextColor: form.value.quotePdfTextColor,
      quotePdfTitleColor: form.value.quotePdfTitleColor,
      quotePdfAccentColor: form.value.quotePdfAccentColor,
      quotePdfHeadingFont: form.value.quotePdfHeadingFont,
      quotePdfHeadingFontVariant: form.value.quotePdfHeadingFontVariant,
      quotePdfHeadingFontGoogleFamily: form.value.quotePdfHeadingFontGoogleFamily,
      quotePdfBodyFont: form.value.quotePdfBodyFont,
      quotePdfBodyFontVariant: form.value.quotePdfBodyFontVariant,
      quotePdfBodyFontGoogleFamily: form.value.quotePdfBodyFontGoogleFamily,
    });
    toast.add({
      severity: "success",
      summary: "Design enregistré",
      detail: "Les prochains devis utiliseront ces réglages.",
      life: 2500,
    });
  } catch (error: any) {
    toast.add({
      severity: "error",
      summary: "Erreur",
      detail: error.message || "Impossible de sauvegarder le design des devis.",
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-2xl text-primary">palette</span>
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Design des devis</h1>
      </div>
      <p class="text-surface-dark/60 max-w-3xl mt-2">
        Personnalise les couleurs et les polices utilisées dans les devis générés en PDF.
      </p>
    </div>

    <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <label class="flex flex-col gap-2 rounded-2xl border border-surface-dark/5 bg-white p-4">
          <span class="text-sm font-bold text-surface-dark/80">Couleur du texte</span>
          <div class="flex items-center gap-3">
            <input
              v-model="form.quotePdfTextColor"
              type="color"
              class="h-10 w-12 cursor-pointer rounded-lg border border-surface-dark/10 bg-transparent p-1"
            />
            <InputText v-model="form.quotePdfTextColor" class="flex-1 font-mono text-sm" />
          </div>
        </label>

        <label class="flex flex-col gap-2 rounded-2xl border border-surface-dark/5 bg-white p-4">
          <span class="text-sm font-bold text-surface-dark/80">Couleur des titres</span>
          <div class="flex items-center gap-3">
            <input
              v-model="form.quotePdfTitleColor"
              type="color"
              class="h-10 w-12 cursor-pointer rounded-lg border border-surface-dark/10 bg-transparent p-1"
            />
            <InputText v-model="form.quotePdfTitleColor" class="flex-1 font-mono text-sm" />
          </div>
        </label>

        <label class="flex flex-col gap-2 rounded-2xl border border-surface-dark/5 bg-white p-4">
          <span class="text-sm font-bold text-surface-dark/80">Couleur carte & tableaux</span>
          <div class="flex items-center gap-3">
            <input
              v-model="form.quotePdfAccentColor"
              type="color"
              class="h-10 w-12 cursor-pointer rounded-lg border border-surface-dark/10 bg-transparent p-1"
            />
            <InputText v-model="form.quotePdfAccentColor" class="flex-1 font-mono text-sm" />
          </div>
        </label>
      </div>

      <div class="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="grid grid-cols-1 gap-3 rounded-2xl border border-surface-dark/5 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-surface-dark/80">Police des titres</span>
            <Select
              v-model="form.quotePdfHeadingFont"
              :options="quotePdfFontOptions"
              :loading="fontsLoading"
              option-label="label"
              option-value="value"
              filter
              placeholder="Rechercher une police"
              :virtual-scroller-options="{ itemSize: 44 }"
            >
              <template #value="{ value, placeholder }">
                <GoogleFontOptionPreview
                  v-if="value"
                  :family="value"
                  :google-family="getFontPreviewFamily(value)"
                />
                <span v-else>{{ placeholder }}</span>
              </template>
              <template #option="{ option }">
                <GoogleFontOptionPreview
                  :family="option.value"
                  :google-family="option.googleFamily"
                />
              </template>
            </Select>
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-surface-dark/80">Style</span>
            <Select
              v-model="form.quotePdfHeadingFontVariant"
              :options="headingVariantOptions"
              option-label="label"
              option-value="value"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 rounded-2xl border border-surface-dark/5 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-surface-dark/80">Police du texte</span>
            <Select
              v-model="form.quotePdfBodyFont"
              :options="quotePdfFontOptions"
              :loading="fontsLoading"
              option-label="label"
              option-value="value"
              filter
              placeholder="Rechercher une police"
              :virtual-scroller-options="{ itemSize: 44 }"
            >
              <template #value="{ value, placeholder }">
                <GoogleFontOptionPreview
                  v-if="value"
                  :family="value"
                  :google-family="getFontPreviewFamily(value)"
                />
                <span v-else>{{ placeholder }}</span>
              </template>
              <template #option="{ option }">
                <GoogleFontOptionPreview
                  :family="option.value"
                  :google-family="option.googleFamily"
                />
              </template>
            </Select>
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-surface-dark/80">Style</span>
            <Select
              v-model="form.quotePdfBodyFontVariant"
              :options="bodyVariantOptions"
              option-label="label"
              option-value="value"
            />
          </label>
        </div>
      </div>
      <p v-if="fontsError" class="mt-3 text-sm text-red-600">{{ fontsError }}</p>

      <div class="mt-5 rounded-2xl border border-surface-dark/5 bg-white p-5">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <h2
              class="mb-2 text-xl font-bold"
              :style="{
                color: form.quotePdfTitleColor,
                fontFamily: `'${form.quotePdfHeadingFont}', serif`,
                fontWeight: headingFontStyle.weight,
                fontStyle: headingFontStyle.style,
              }"
            >
              Aperçu du devis
            </h2>
            <p
              class="text-sm leading-relaxed"
              :style="{
                color: form.quotePdfTextColor,
                fontFamily: `'${form.quotePdfBodyFont}', sans-serif`,
                fontWeight: bodyFontStyle.weight,
                fontStyle: bodyFontStyle.style,
              }"
            >
              Les lignes claires des tableaux sont générées automatiquement depuis la couleur principale.
            </p>
            <div
              class="mt-4 overflow-hidden rounded-xl border"
              :style="{ borderColor: mixHexWithWhite(form.quotePdfAccentColor, 0.82) }"
            >
              <div
                class="grid grid-cols-[minmax(0,1fr)_110px] px-3 py-2 text-xs font-semibold uppercase"
                :style="{ backgroundColor: mixHexWithWhite(form.quotePdfAccentColor, 0.94), color: mixHexWithWhite(form.quotePdfTextColor, 0.38) }"
              >
                <span>Prestation</span>
                <span class="text-right">Montant</span>
              </div>
              <div
                class="grid grid-cols-[minmax(0,1fr)_110px] px-3 py-2 text-sm"
                :style="{ color: form.quotePdfTextColor }"
              >
                <span>Design & développement</span>
                <span class="text-right">1 250,00 €</span>
              </div>
            </div>
          </div>

          <div class="rounded-2xl p-4 text-white" :style="{ backgroundColor: form.quotePdfAccentColor }">
            <p
              class="mb-3 text-lg font-bold leading-snug"
              :style="{
                fontFamily: `'${form.quotePdfHeadingFont}', serif`,
                fontWeight: headingFontStyle.weight,
                fontStyle: headingFontStyle.style,
              }"
            >
              PROPOSITION
            </p>
            <div class="space-y-2 text-sm" :style="{ color: mixHexWithWhite(form.quotePdfAccentColor, 0.78) }">
              <div class="flex justify-between gap-3">
                <span>Devis n°</span>
                <strong class="text-white">DEV-2026-001</strong>
              </div>
              <div class="flex justify-between gap-3">
                <span>Date</span>
                <strong class="text-white">02/07/2026</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <Button severity="secondary" label="Réinitialiser" @click="resetQuotePdfTheme" />
        <Button :loading="loading" aria-label="Enregistrer" title="Enregistrer" @click="saveSettings">
          <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
        </Button>
      </div>
    </section>
  </div>
</template>
