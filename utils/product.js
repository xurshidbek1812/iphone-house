export const normalizeProductName = (value) => {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};