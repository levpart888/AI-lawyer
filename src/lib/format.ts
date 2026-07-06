export function formatRub(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
}

export function formatFeeRange(min: number | null, max: number | null) {
  if (min == null && max == null) return "Гонорар не указан";
  if (min != null && max != null) return `${formatRub(min)} – ${formatRub(max)}`;
  return formatRub(min ?? max);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
