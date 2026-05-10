export function isValidPhone(phone: string): boolean {
  return /^[0-9+\-\s]{8,15}$/.test(phone.trim());
}

export function isEmpty(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

export function isValidPlate(plate: string): boolean {
  return plate.trim().length >= 3;
}
