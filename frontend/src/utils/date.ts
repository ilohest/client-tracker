//date.ts

import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Convertit n'importe quel format de date (Firestore Timestamp, String, Date) en objet Date JS
 */
export const toDateObj = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  // Cas Firestore (objet avec méthode toDate)
  if (typeof dateValue.toDate === 'function') {
    const date = dateValue.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Cas Firestore sérialisé ({ seconds, nanoseconds })
  if (typeof dateValue === 'object' && typeof dateValue.seconds === 'number') {
    const date = new Date(dateValue.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Cas String ou Number
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Format standard : "12 Fév. 2024 à 14:30"
 */
export const formatDateLong = (dateValue: any): string => {
  const date = toDateObj(dateValue);
  if (!date) return '-';
  return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
};

/**
 * Format ergonomique pour les métadonnées : "2 juil. 2026, 10:05".
 */
export const formatDateTime = (dateValue: any): string => {
  const date = toDateObj(dateValue);
  if (!date) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

/**
 * Format court : "12/02/2024"
 */
export const formatDateShort = (dateValue: any): string => {
  const date = toDateObj(dateValue);
  if (!date) return '-';
  return format(date, 'dd/MM/yyyy', { locale: fr });
};

/**
 * Format relatif : "il y a 2 heures"
 */
export const formatRelative = (dateValue: any): string => {
  const date = toDateObj(dateValue);
  if (!date) return '-';
  return formatDistanceToNow(date, { addSuffix: true, locale: fr });
};
