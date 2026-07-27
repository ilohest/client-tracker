<script setup lang="ts">
import { computed } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import InputText from "primevue/inputtext";
import { useAuthStore } from "@/stores/authStore";
import { copyToClipboard } from "@/utils/clipboard";

const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();
const user = computed(() => authStore.user);

const formatDate = (date: any) => {
  if (!date) return "-";
  const parsed = date.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
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
  <div class="flex flex-col gap-6">
    <div class="flex items-start gap-3">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
        <span class="material-symbols-outlined text-2xl text-primary">lock</span>
      </span>
      <div>
        <h1 class="text-3xl font-heading font-bold text-surface-dark">Sécurité</h1>
        <p class="mt-1 text-sm text-surface-dark/55">Gère l’accès à ton compte et les informations techniques de connexion.</p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
        <h2 class="mb-4 font-heading text-xl font-bold text-surface-dark">Compte</h2>
        <div class="grid gap-4">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-surface-dark/80">Email de connexion</span>
            <InputText :model-value="user?.email || ''" disabled class="bg-surface-light text-surface-dark/50" />
          </label>

          <div class="rounded-2xl border border-surface-dark/5 bg-white p-5">
            <h3 class="mb-2 font-heading font-bold text-surface-dark">Mot de passe</h3>
            <p class="mb-4 text-sm text-surface-dark/60">Envoie-toi un lien de réinitialisation si besoin.</p>
            <Button severity="secondary" label="Envoyer un email de réinitialisation" @click="handlePasswordReset">
              <template #icon><span class="material-symbols-outlined text-lg">mail</span></template>
            </Button>
          </div>

          <div class="rounded-2xl border border-red-200 bg-white p-5">
            <h3 class="mb-2 font-heading font-bold text-surface-dark">Zone sensible</h3>
            <p class="mb-4 text-sm text-surface-dark/60">Supprime définitivement ton compte et les données associées.</p>
            <Button severity="danger" label="Supprimer mon compte" @click="handleDeleteAccount">
              <template #icon><span class="material-symbols-outlined text-lg">delete_forever</span></template>
            </Button>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
        <h2 class="mb-4 font-heading text-xl font-bold text-surface-dark">Informations de sécurité</h2>
        <div class="space-y-4 text-sm">
          <div>
            <p class="text-surface-dark/45">Membre depuis</p>
            <p class="font-medium text-surface-dark">{{ formatDate(user?.metadata.creationTime) }}</p>
          </div>
          <div>
            <p class="text-surface-dark/45">Dernière connexion</p>
            <p class="font-medium text-surface-dark">{{ formatDate(user?.metadata.lastSignInTime) }}</p>
          </div>
          <div>
            <p class="text-surface-dark/45">UID</p>
            <button
              class="mt-1 flex max-w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-left transition-colors hover:bg-primary/8"
              type="button"
              @click="copyUid"
            >
              <span class="min-w-0 truncate font-mono text-xs text-surface-dark/65">{{ user?.uid }}</span>
              <span class="material-symbols-outlined text-sm text-surface-dark/40">content_copy</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <ConfirmDialog />
  </div>
</template>
