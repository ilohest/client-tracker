<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import CountrySelect from "@/components/clients/CountrySelect.vue";
import { useAuthStore } from "@/stores/authStore";
import { formatBillingAddress } from "@/utils/address";
import { copyToClipboard } from "@/utils/clipboard";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import Divider from "primevue/divider";
import InputText from "primevue/inputtext";
import Tab from "primevue/tab";
import TabList from "primevue/tablist";
import TabPanel from "primevue/tabpanel";
import TabPanels from "primevue/tabpanels";
import Tabs from "primevue/tabs";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";

const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const loading = ref(false);
const user = computed(() => authStore.user);
const userProfile = computed(() => authStore.userProfile);
const PROFILE_ACCENT_COLOR = "#4C5EF7";

const form = ref({
  displayName: "",
  email: "",
  address: "",
  billingStreet: "",
  billingStreetNumber: "",
  billingPostalCode: "",
  billingCity: "",
  website: "",
  logoUrl: "",
  billingCountry: "BE",
  vatNumber: "",
});

const fillForm = () => {
  if (!user.value) return;

  form.value = {
    displayName: userProfile.value?.displayName || user.value.displayName || "",
    email: user.value.email || "",
    address: userProfile.value?.address || "",
    billingStreet: userProfile.value?.billingStreet || "",
    billingStreetNumber: userProfile.value?.billingStreetNumber || "",
    billingPostalCode: userProfile.value?.billingPostalCode || "",
    billingCity: userProfile.value?.billingCity || "",
    website: userProfile.value?.website || "",
    logoUrl: userProfile.value?.logoUrl || "",
    billingCountry: userProfile.value?.billingCountry || "BE",
    vatNumber: userProfile.value?.vatNumber || "",
  };
};

onMounted(fillForm);
watch(user, fillForm);
watch(userProfile, fillForm);

const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : "U");

const formatDate = (date: any) => {
  if (!date) return "-";
  const parsed = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(parsed);
};

const copyUid = async () => {
  if (!user.value?.uid) return;
  const success = await copyToClipboard(user.value.uid);
  if (success) {
    toast.add({ severity: "secondary", summary: "Copié", detail: "UID copié", life: 1500 });
  }
};

const handleUpdateProfile = async () => {
  if (!user.value) return;
  loading.value = true;
  try {
    await authStore.updateUserProfile({
      displayName: form.value.displayName,
      color: PROFILE_ACCENT_COLOR,
      address: formatBillingAddress(form.value),
      billingStreet: form.value.billingStreet,
      billingStreetNumber: form.value.billingStreetNumber,
      billingPostalCode: form.value.billingPostalCode,
      billingCity: form.value.billingCity,
      website: form.value.website,
      logoUrl: form.value.logoUrl,
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

const handlePasswordReset = async () => {
  if (!user.value?.email) return;
  const success = await authStore.resetPassword(user.value.email);
  toast.add({
    severity: success ? "info" : "error",
    summary: success ? "Envoyé" : "Erreur",
    detail: success ? "Vérifiez vos emails." : authStore.error || "Impossible d'envoyer l'email.",
    life: 4000,
  });
};

const handleDeleteAccount = () => {
  confirm.require({
    message: "Cette action est irréversible. Toutes vos données seront perdues.",
    header: "Supprimer mon compte ?",
    icon: "warning",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Oui, supprimer définitivement",
      severity: "danger",
    },
    accept: async () => {
      await authStore.deleteAccount();
    },
  });
};
</script>

<template>
  <div class="max-w-6xl mx-auto py-8 px-4">
    <div class="mb-8">
      <h1 class="text-3xl font-bold font-heading text-surface-dark">Mon Profil</h1>
      <p class="text-surface-dark/60">Renseigne ici tes coordonnées et tes informations de facturation.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="md:col-span-1 space-y-6">
        <div class="bg-surface-card rounded-2xl shadow-sm border border-surface-dark/5 p-6 flex flex-col items-center text-center">
          <div class="relative mb-4">
            <Avatar
              :label="getInitials(form.displayName || user?.email || '')"
              size="xlarge"
              shape="circle"
              class="w-24 h-24 text-3xl shadow-lg ring-4 ring-surface-light"
              :style="{ backgroundColor: PROFILE_ACCENT_COLOR, color: 'white' }"
            />
          </div>

          <img
            v-if="form.logoUrl"
            :src="form.logoUrl"
            alt="Logo"
            class="h-16 w-auto object-contain mb-4 rounded-xl bg-white border border-surface-dark/5 p-2"
          />

          <h2 class="text-xl font-bold text-surface-dark break-all font-heading">{{ form.displayName || "Utilisateur" }}</h2>
          <p class="text-sm text-surface-dark/50 mb-4 font-mono text-xs">{{ user?.email }}</p>

          <div class="flex gap-2 justify-center mb-6">
            <Tag :value="userProfile?.role === 'admin' ? 'Administrateur' : 'Membre'" :severity="userProfile?.role === 'admin' ? 'danger' : 'secondary'" rounded class="!font-bold" />
          </div>

          <Divider />

          <div class="w-full text-left space-y-3 mt-2">
            <div class="flex justify-between text-sm">
              <span class="text-surface-dark/50">Membre depuis</span>
              <span class="font-medium text-surface-dark">{{ formatDate(user?.metadata.creationTime) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-surface-dark/50">Dernière connexion</span>
              <span class="font-medium text-surface-dark">{{ formatDate(user?.metadata.lastSignInTime) }}</span>
            </div>
            <div class="flex justify-between text-sm items-center">
              <span class="text-surface-dark/50">UID</span>
              <button class="flex items-center gap-1 bg-surface-dark/5 px-2 py-1 rounded hover:bg-primary/10" @click="copyUid">
                <span class="font-mono text-[10px] text-surface-dark/60 truncate w-20">{{ user?.uid }}</span>
                <span class="material-symbols-outlined text-[10px] text-surface-dark/40">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="md:col-span-2">
        <div class="bg-surface-card rounded-2xl shadow-sm border border-surface-dark/5 overflow-hidden min-h-[520px]">
          <Tabs value="0">
            <TabList>
              <Tab value="0" class="!px-6 !py-4 font-bold">Informations</Tab>
              <Tab value="1" class="!px-6 !py-4 font-bold">Sécurité</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="0">
                <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-2 lg:col-span-2">
                    <label class="text-sm font-bold text-surface-dark/80">Adresse Email</label>
                    <InputText v-model="form.email" disabled class="bg-surface-light text-surface-dark/50 border-surface-dark/10" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-surface-dark/80">Nom d'affichage</label>
                    <InputText v-model="form.displayName" placeholder="Votre nom ou studio" />
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

                  <div class="flex flex-col gap-2 lg:col-span-2">
                    <label class="text-sm font-bold text-surface-dark/80">Logo (URL)</label>
                    <InputText v-model="form.logoUrl" placeholder="https://.../logo.png" />
                  </div>
                  <div class="lg:col-span-2 pt-2">
                    <Button :loading="loading" @click="handleUpdateProfile">
                      <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
                      Enregistrer les modifications
                    </Button>
                  </div>
                </div>
              </TabPanel>

              <TabPanel value="1">
                <div class="p-6 flex flex-col gap-4 max-w-xl">
                  <div class="rounded-2xl bg-white border border-surface-dark/5 p-5">
                    <h3 class="font-heading font-bold text-surface-dark mb-2">Mot de passe</h3>
                    <p class="text-sm text-surface-dark/60 mb-4">Envoie-toi un lien de réinitialisation si besoin.</p>
                    <Button severity="secondary" @click="handlePasswordReset">
                      <template #icon><span class="material-symbols-outlined text-lg">mail</span></template>
                      Envoyer un email de réinitialisation
                    </Button>
                  </div>

                  <div class="rounded-2xl bg-white border border-red-200 p-5">
                    <h3 class="font-heading font-bold text-surface-dark mb-2">Zone sensible</h3>
                    <p class="text-sm text-surface-dark/60 mb-4">Supprime définitivement ton compte et les données associées.</p>
                    <Button severity="danger" @click="handleDeleteAccount">
                      <template #icon><span class="material-symbols-outlined text-lg">delete_forever</span></template>
                      Supprimer mon compte
                    </Button>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </div>

    <ConfirmDialog />
  </div>
</template>
