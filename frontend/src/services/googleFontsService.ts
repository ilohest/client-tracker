export interface GoogleFontAxis {
  tag: string;
  start: number;
  end: number;
}

export interface GoogleFontItem {
  family: string;
  category: string;
  variants: string[];
  axes?: GoogleFontAxis[];
}

export interface QuoteFontVariantOption {
  label: string;
  value: string;
  weight: number;
  style: 'normal' | 'italic';
  googleFamily: string;
}

const GOOGLE_FONTS_API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts';

const WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

const normalizeVariant = (variant: string): { weight: number; style: 'normal' | 'italic' } => {
  if (variant === 'regular') return { weight: 400, style: 'normal' };
  if (variant === 'italic') return { weight: 400, style: 'italic' };
  const italic = variant.endsWith('italic');
  const weight = Number.parseInt(variant.replace('italic', ''), 10);
  return {
    weight: Number.isFinite(weight) ? weight : 400,
    style: italic ? 'italic' : 'normal',
  };
};

const encodeFamily = (value: string): string => value.trim().replace(/ /g, '+');

const buildGoogleFamily = (font: GoogleFontItem, variant: string): string => {
  const { weight, style } = normalizeVariant(variant);
  const axes = font.axes || [];
  const hasWeightAxis = axes.some((axis) => axis.tag === 'wght');
  const opticalAxis = axes.find((axis) => axis.tag === 'opsz');
  const hasItalicAxis = axes.some((axis) => axis.tag === 'ital');
  const family = encodeFamily(font.family);

  if (opticalAxis && hasWeightAxis) {
    const opticalRange = `${opticalAxis.start}..${opticalAxis.end}`;
    return style === 'italic' && hasItalicAxis
      ? `${family}:ital,opsz,wght@1,${opticalRange},${weight}`
      : `${family}:opsz,wght@${opticalRange},${weight}`;
  }

  if (hasWeightAxis || /^\d/.test(variant) || variant === 'regular' || variant === 'italic') {
    return style === 'italic'
      ? `${family}:ital,wght@1,${weight}`
      : `${family}:wght@${weight}`;
  }

  return family;
};

export const getFontVariantOptions = (font?: GoogleFontItem | null): QuoteFontVariantOption[] => {
  if (!font) return [];
  return (font.variants || ['regular']).map((variant) => {
    const { weight, style } = normalizeVariant(variant);
    const baseLabel = `${WEIGHT_LABELS[weight] || weight} ${weight}`;
    return {
      label: style === 'italic' ? `${baseLabel} Italic` : baseLabel,
      value: variant,
      weight,
      style,
      googleFamily: buildGoogleFamily(font, variant),
    };
  });
};

export const fetchGoogleFonts = async (): Promise<GoogleFontItem[]> => {
  const key = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    key,
    sort: 'alpha',
  });
  const response = await fetch(`${GOOGLE_FONTS_API_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Impossible de charger les polices Google Fonts.");
  }
  const payload = (await response.json()) as { items?: GoogleFontItem[] };
  return payload.items || [];
};
