const CHIP_COLORS = [
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "default",
] as const;

export type ChipColor = (typeof CHIP_COLORS)[number];

// Deterministic so the same category always renders the same Chip color,
// without storing a color field or writing any custom CSS.
export function categoryColor(categoryId: string): ChipColor {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) | 0;
  }
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}
