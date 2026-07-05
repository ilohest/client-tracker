<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import CountrySelect from "@/components/clients/CountrySelect.vue";
import { useAuthStore } from "@/stores/authStore";
import { formatBillingAddress } from "@/utils/address";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";

const authStore = useAuthStore();
const toast = useToast();

const loading = ref(false);
const logoUploading = ref(false);
const logoInput = ref<HTMLInputElement | null>(null);
const user = computed(() => authStore.user);
const userProfile = computed(() => authStore.userProfile);
const PROFILE_ACCENT_COLOR = "#e96a5f";

const form = ref({
  displayName: "",
  jobTitle: "",
  hourlyRate: 0,
  email: "",
  contactEmail: "",
  address: "",
  billingStreet: "",
  billingStreetNumber: "",
  billingPostalCode: "",
  billingCity: "",
  website: "",
  logoUrl: "",
  logoPath: "",
  billingCountry: "BE",
  vatNumber: "",
});

const fillForm = () => {
  if (!user.value) return;

  form.value = {
    displayName: userProfile.value?.displayName || user.value.displayName || "",
    jobTitle: userProfile.value?.jobTitle || "",
    hourlyRate: Number(userProfile.value?.hourlyRate || 0),
    email: user.value.email || "",
    contactEmail: userProfile.value?.contactEmail || "",
    address: userProfile.value?.address || "",
    billingStreet: userProfile.value?.billingStreet || "",
    billingStreetNumber: userProfile.value?.billingStreetNumber || "",
    billingPostalCode: userProfile.value?.billingPostalCode || "",
    billingCity: userProfile.value?.billingCity || "",
    website: userProfile.value?.website || "",
    logoUrl: userProfile.value?.logoUrl || "",
    logoPath: userProfile.value?.logoPath || "",
    billingCountry: userProfile.value?.billingCountry || "BE",
    vatNumber: userProfile.value?.vatNumber || "",
  };
};

onMounted(fillForm);
watch(user, fillForm);
watch(userProfile, fillForm);

const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : "U");

const handleUpdateProfile = async () => {
  if (!user.value) return;
  loading.value = true;
  try {
    await authStore.updateUserProfile({
      displayName: form.value.displayName,
      jobTitle: form.value.jobTitle,
      hourlyRate: Number(form.value.hourlyRate || 0),
      contactEmail: form.value.contactEmail,
      color: PROFILE_ACCENT_COLOR,
      address: formatBillingAddress(form.value),
      billingStreet: form.value.billingStreet,
      billingStreetNumber: form.value.billingStreetNumber,
      billingPostalCode: form.value.billingPostalCode,
      billingCity: form.value.billingCity,
      website: form.value.website,
      logoUrl: form.value.logoUrl,
      logoPath: form.value.logoPath,
      billingCountry: form.value.billingCountry,
      vatNumber: form.value.vatNumber,
    });
    toast.add({ severity: "success", summary: "Profil mis à jour", detail: "Tes informations de facturation ont été enregistrées.", life: 2500 });
  } catch (error: any) {
    toast.add({ severity: "error", summary: "Erreur", detail: error.message || "Impossible de sauvegarder le profil.", life: 3000 });
  } finally {
    loading.value = false;
  }
};

const openLogoPicker = () => {
  logoInput.value?.click();
};

const handleLogoChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast.add({ severity: "error", summary: "Format non supporté", detail: "Choisis une image pour le logo.", life: 2500 });
    return;
  }

  logoUploading.value = true;
  try {
    const result = await authStore.uploadProfileLogo(file);
    form.value.logoUrl = result.logoUrl;
    form.value.logoPath = result.logoPath;
    toast.add({ severity: "success", summary: "Logo ajouté", detail: "Le logo sera utilisé dans les prochains PDF.", life: 2500 });
  } catch (error: any) {
    toast.add({ severity: "error", summary: "Erreur", detail: error.message || "Impossible d'uploader le logo.", life: 3000 });
  } finally {
    logoUploading.value = false;
  }
};

</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <span
        class="material-symbols-outlined rounded-2xl bg-primary/10 p-2 text-2xl text-primary"
        >badge</span
      >
      <h1 class="font-heading text-3xl font-bold text-surface-dark">
        Infos profil
      </h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="md:col-span-1 space-y-6">
        <div class="bg-surface-card rounded-2xl shadow-sm border border-surface-dark/5 p-6 flex flex-col items-center text-center">
          <div
            class="relative mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-3xl font-bold shadow-lg ring-4 ring-surface-light"
            :style="{ backgroundColor: PROFILE_ACCENT_COLOR, color: 'white' }"
          >
            <img
              v-if="form.logoUrl"
              :src="form.logoUrl"
              alt="Logo"
              class="h-full w-full object-cover"
            />
            <span v-else>{{ getInitials(form.displayName || user?.email || '') }}</span>
          </div>

          <h2 class="text-xl font-bold text-surface-dark break-all font-heading">{{ form.displayName || "Utilisateur" }}</h2>
          <p v-if="form.jobTitle" class="mt-1 text-sm italic text-surface-dark/65">{{ form.jobTitle }}</p>
          <p class="text-sm text-surface-dark/50 mb-4 font-mono text-xs">{{ user?.email }}</p>

          <div class="flex gap-2 justify-center mb-6">
            <Tag :value="userProfile?.role === 'admin' ? 'Administrateur' : 'Membre'" :severity="userProfile?.role === 'admin' ? 'danger' : 'secondary'" rounded class="!font-bold" />
          </div>
        </div>
      </div>

      <div class="md:col-span-2">
        <div class="bg-surface-card rounded-2xl shadow-sm border border-surface-dark/5 overflow-hidden min-h-[520px]">
          <div class="border-b border-surface-dark/5 px-6 py-4">
            <h2 class="font-heading text-xl font-bold text-surface-dark">Informations devis</h2>
          </div>
                <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-2 lg:col-span-2">
                    <label class="text-sm font-bold text-surface-dark/80">Email affiché sur les devis</label>
                    <InputText v-model="form.contactEmail" placeholder="hello@votre-domaine.com" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Nom d'affichage</label>
                    <InputText v-model="form.displayName" placeholder="Votre nom ou studio" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Titre</label>
                    <InputText v-model="form.jobTitle" placeholder="Ex: Conception & développement web" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Taux horaire</label>
                    <InputNumber
                      v-model="form.hourlyRate"
                      mode="currency"
                      currency="EUR"
                      locale="fr-FR"
                      :min="0"
                      placeholder="Ex: 75 €"
                    />
                    <p class="text-xs text-surface-dark/50">
                      Utilisable dans les templates avec {taux_horaire} et {taux_journalier}.
                    </p>
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Site web</label>
                    <InputText v-model="form.website" placeholder="https://..." />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Rue</label>
                    <InputText v-model="form.billingStreet" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">N°</label>
                    <InputText v-model="form.billingStreetNumber" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Code postal</label>
                    <InputText v-model="form.billingPostalCode" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Ville</label>
                    <InputText v-model="form.billingCity" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Pays</label>
                    <CountrySelect v-model="form.billingCountry" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">N° TVA</label>
                    <InputText v-model="form.vatNumber" placeholder="BE0123.456.789" />
                  </div>

                  <div class="flex flex-col gap-3 lg:col-span-2">
                    <label class="text-sm font-bold text-surface-dark/80">Logo</label>
                    <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-surface-dark/8 bg-white p-4">
                      <img
                        v-if="form.logoUrl"
                        :src="form.logoUrl"
                        alt="Logo"
                        class="h-16 w-auto max-w-[180px] rounded-xl border border-surface-dark/5 bg-white object-contain p-2"
                      />
                      <div
                        v-else
                        class="flex h-16 w-24 items-center justify-center rounded-xl border border-dashed border-surface-dark/15 bg-surface-light text-surface-dark/35"
                      >
                        <span class="material-symbols-outlined text-2xl">image</span>
                      </div>
                      <input
                        ref="logoInput"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="handleLogoChange"
                      />
                      <Button
                        severity="secondary"
                        :loading="logoUploading"
                        label="Uploader un logo"
                        @click="openLogoPicker"
                      >
                        <template #icon><span class="material-symbols-outlined text-lg">upload_file</span></template>
                      </Button>
                    </div>
                  </div>
                  <div class="lg:col-span-2 pt-2">
                    <Button :loading="loading" aria-label="Enregistrer" title="Enregistrer" @click="handleUpdateProfile">
                      <template #icon><span class="material-symbols-outlined text-lg">save</span></template></Button>
                  </div>
                </div>
        </div>
      </div>
    </div>
  </div>
</template>
