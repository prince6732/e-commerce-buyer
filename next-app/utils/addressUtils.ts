export interface StructuredAddress {
  name?: string;
  phone?: string;
  add?: string;
  city?: string;
  state?: string;
  pin?: string;
  country?: string;
}

export function parseAddress(addr: any): StructuredAddress | null {
  if (!addr) return null;
  if (typeof addr === 'object') return addr;
  if (typeof addr === 'string') {
    const trimmed = addr.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

export function formatAddressDisplay(addr: any): string {
  if (!addr) return '';
  const parsed = parseAddress(addr);
  if (parsed) {
    return [
      parsed.name,
      parsed.phone,
      parsed.add,
      [parsed.city, parsed.state, parsed.pin].filter(Boolean).join(', '),
      parsed.country,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return String(addr);
}

export function formatAddressSingleLine(addr: any): string {
  if (!addr) return '';
  const parsed = parseAddress(addr);
  if (parsed) {
    return [
      parsed.add,
      parsed.city,
      parsed.state,
      parsed.pin,
      parsed.country,
    ]
      .filter(Boolean)
      .join(', ');
  }
  return String(addr).replace(/\n+/g, ', ');
}
