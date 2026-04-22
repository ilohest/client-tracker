//announcementsStore.ts

import { defineStore } from "pinia";
import { ref } from "vue";
import { announcementsService } from "../services/announcementsService";
import type { Announcement } from "@client-tracker/contracts";

export const useAnnouncementsStore = defineStore("announcements", () => {
  const items = ref<Announcement[]>([]);
  const isLoading = ref(false);

  async function fetchLatest() {
    isLoading.value = true;
    try {
      items.value = await announcementsService.fetchLatest();
    } catch (e) {
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function postAnnouncement(content: string) {
    isLoading.value = true;
    try {
        await announcementsService.create(content);
        await fetchLatest(); // Refresh
    } catch (e) {
        console.error(e);
    } finally {
        isLoading.value = false;
    }
  }

  return { items, isLoading, fetchLatest, postAnnouncement };
});