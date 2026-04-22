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
    return dateValue.toDate();
  }
  // Cas String ou Number
  return new Date(dateValue);
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