import { BadRequestException } from '@nestjs/common';

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export function normalizeAddressInput(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[\r\n\t]+/g, ' ') // convert newlines/tabs to space
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

export function isTestOrGibberish(value: string): boolean {
  const clean = normalizeAddressInput(value).toLowerCase();
  if (!clean) return true;

  if (/(.)\1{3,}/i.test(clean)) {
    return true;
  }

  if (!/[a-zA-Z0-9]/.test(clean)) {
    return true;
  }

  const testKeywords = [
    'test',
    'testing',
    'dummy',
    'fake',
    'sample',
    'asdf',
    'asdfgh',
    'asdfghjk',
    'qwerty',
    'zxcv',
    'dsa',
    'xyz',
    'abc',
    'abcd',
    'null',
    'undefined',
    'foo',
    'bar',
    'test address',
    'my address',
    'testing address',
    'demo address',
    'temp',
  ];

  if (testKeywords.includes(clean)) {
    return true;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => testKeywords.includes(w))) {
    return true;
  }

  return false;
}

export function validateAddressLine1(
  addressLine1: string | null | undefined,
  city?: string | null | undefined,
  state?: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(addressLine1);

  if (!normalized || normalized.length < 10 || normalized.length > 150) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  if (!/[a-zA-Z]/.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  const allowedCharsRegex = /^[a-zA-Z0-9\s\.\,\-\/\#\(\)\&\:\'\@\+]+$/;
  if (!allowedCharsRegex.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  if (isTestOrGibberish(normalized) || /^[0-9\s\.\,\-\/\#\(\)]+$/.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  if (city) {
    const cleanCity = normalizeAddressInput(city).toLowerCase();
    const cleanLower = normalized.toLowerCase();
    if (cleanCity && cleanCity.length >= 2) {
      if (
        cleanLower === cleanCity ||
        cleanLower === `near ${cleanCity}` ||
        cleanLower === `${cleanCity}, india`
      ) {
        return {
          isValid: false,
          error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
          normalized,
        };
      }
    }
  }

  if (state) {
    const cleanState = normalizeAddressInput(state).toLowerCase();
    const cleanLower = normalized.toLowerCase();
    if (cleanState && cleanLower === cleanState) {
      return {
        isValid: false,
        error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
        normalized,
      };
    }
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const hasDigit = /[0-9]/.test(normalized);
  const hasCommonKeyword = /\b(house|flat|shop|plot|room|floor|block|sector|sec|road|rd|street|st|lane|gali|marg|nagar|colony|enclave|society|apartment|apt|residency|tower|building|bldg|vpo|village|mohalla|chowk|bazar|market|opp|opposite|near|behind|beside|h\.?\s*no|f\.?\s*no|s\.?\s*no|p\.?\s*no|no\.)\b/i.test(
    normalized
  );

  if (words.length < 2 && !hasDigit && !hasCommonKeyword) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  return { isValid: true, normalized };
}

export function validateAddressLine2(
  addressLine2: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(addressLine2);

  if (!normalized) {
    return { isValid: true, normalized: '' };
  }

  if (normalized.length < 3 || normalized.length > 150) {
    return { isValid: false, error: "Please enter a valid additional address or landmark.", normalized };
  }

  if (!/[a-zA-Z]/.test(normalized)) {
    return { isValid: false, error: "Please enter a valid additional address or landmark.", normalized };
  }

  const allowedCharsRegex = /^[a-zA-Z0-9\s\.\,\-\/\#\(\)\&\:\'\@\+]+$/;
  if (!allowedCharsRegex.test(normalized)) {
    return { isValid: false, error: "Please enter a valid additional address or landmark.", normalized };
  }

  if (isTestOrGibberish(normalized) || /^[0-9\s\.\,\-\/\#\(\)]+$/.test(normalized)) {
    return { isValid: false, error: "Please enter a valid additional address or landmark.", normalized };
  }

  return { isValid: true, normalized };
}

export function validateCity(
  city: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(city);

  if (!normalized || normalized.length < 2 || normalized.length > 100) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  if (!/^[a-zA-Z\s\.\-\']+$/.test(normalized)) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  const alphaMatch = normalized.match(/[a-zA-Z]/g);
  if (!alphaMatch || alphaMatch.length < 2) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  if (isTestOrGibberish(normalized)) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  return { isValid: true, normalized };
}

export function validateState(
  state: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(state);

  if (!normalized) {
    return { isValid: false, error: "Please select a valid state.", normalized };
  }

  const match = INDIAN_STATES.find(
    (s) => s.toLowerCase() === normalized.toLowerCase()
  );

  if (!match) {
    return { isValid: false, error: "Please select a valid state.", normalized };
  }

  return { isValid: true, normalized: match };
}

export function validatePostalCode(
  postalCode: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = String(postalCode || '').trim();

  if (!/^[1-9][0-9]{5}$/.test(normalized)) {
    return { isValid: false, error: "Please enter a valid 6-digit Indian postal code.", normalized };
  }

  if (/^(.)\1{5}$/.test(normalized) || normalized === '123456' || normalized === '654321') {
    return { isValid: false, error: "Please enter a valid 6-digit Indian postal code.", normalized };
  }

  return { isValid: true, normalized };
}

export function validateCountry(
  country: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(country);

  if (!normalized || normalized.toLowerCase() !== 'india') {
    return { isValid: false, error: "Please select a valid country.", normalized };
  }

  return { isValid: true, normalized: 'India' };
}

export function validateFullName(
  fullName: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(fullName);

  if (!normalized || normalized.length < 2 || normalized.length > 50) {
    return { isValid: false, error: "Full name must be between 2 and 50 characters", normalized };
  }

  if (!/^[a-zA-Z\s\.\']+$/.test(normalized)) {
    return { isValid: false, error: "Full name can only contain letters and spaces", normalized };
  }

  if (isTestOrGibberish(normalized)) {
    return { isValid: false, error: "Please enter a valid full name", normalized };
  }

  return { isValid: true, normalized };
}

export function validatePhoneNumber(
  phoneNumber: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = String(phoneNumber || '').replace(/[^0-9]/g, '');

  if (!/^[6-9][0-9]{9}$/.test(normalized)) {
    return { isValid: false, error: "Please enter a valid 10-digit phone number", normalized };
  }

  if (/^(.)\1{9}$/.test(normalized)) {
    return { isValid: false, error: "Please enter a valid 10-digit phone number", normalized };
  }

  return { isValid: true, normalized };
}

export interface StructuredAddress {
  name: string;
  phone: string;
  add: string;
  city: string;
  state: string;
  pin: string;
  country: string;
}

/**
 * Validates a complete shipping address and formats as a standardized JSON key-value string
 */
export function validateAndSanitizeShippingAddress(
  rawAddress: string | Record<string, any>
): { isValid: boolean; error?: string; sanitizedAddress: string; addressObject: StructuredAddress } {
  if (!rawAddress) {
    throw new BadRequestException('Shipping address is required');
  }

  let obj: Record<string, any> | null = null;
  if (typeof rawAddress === 'object') {
    obj = rawAddress;
  } else if (typeof rawAddress === 'string') {
    const trimmed = rawAddress.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        obj = JSON.parse(trimmed);
      } catch (e) {
        obj = null;
      }
    }
  }

  // If structured object or parsed JSON
  if (obj) {
    const fullNameVal = validateFullName(obj.name || obj.fullName || obj.full_name);
    if (!fullNameVal.isValid) throw new BadRequestException(fullNameVal.error);

    const phoneVal = validatePhoneNumber(obj.phone || obj.phoneNumber || obj.phone_number);
    if (!phoneVal.isValid) throw new BadRequestException(phoneVal.error);

    const cityVal = validateCity(obj.city);
    if (!cityVal.isValid) throw new BadRequestException(cityVal.error);

    const stateVal = validateState(obj.state);
    if (!stateVal.isValid) throw new BadRequestException(stateVal.error);

    const pinVal = validatePostalCode(obj.pin || obj.postalCode || obj.pincode);
    if (!pinVal.isValid) throw new BadRequestException(pinVal.error);

    const countryVal = validateCountry(obj.country);
    if (!countryVal.isValid) throw new BadRequestException(countryVal.error);

    const addr1Val = validateAddressLine1(
      obj.add || obj.addressLine1 || obj.address_line1 || obj.address,
      cityVal.normalized,
      stateVal.normalized
    );
    if (!addr1Val.isValid) throw new BadRequestException(addr1Val.error);

    const addr2Val = validateAddressLine2(obj.addressLine2 || obj.address_line2);
    if (!addr2Val.isValid) throw new BadRequestException(addr2Val.error);

    const fullStreet = [addr1Val.normalized, addr2Val.normalized].filter(Boolean).join(', ');

    const addressObject: StructuredAddress = {
      name: fullNameVal.normalized,
      phone: phoneVal.normalized,
      add: fullStreet,
      city: cityVal.normalized,
      state: stateVal.normalized,
      pin: pinVal.normalized,
      country: countryVal.normalized,
    };

    return {
      isValid: true,
      sanitizedAddress: JSON.stringify(addressObject),
      addressObject,
    };
  }

  // If plain text / multi-line string
  const text = String(rawAddress).trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
  const pinMatch = text.match(/\b([1-9]\d{5})\b/);

  if (!phoneMatch) {
    throw new BadRequestException('Please enter a valid 10-digit Indian phone number.');
  }
  if (!pinMatch) {
    throw new BadRequestException('Please enter a valid 6-digit Indian postal code.');
  }

  const phoneVal = validatePhoneNumber(phoneMatch[1]);
  if (!phoneVal.isValid) throw new BadRequestException(phoneVal.error);

  const pinVal = validatePostalCode(pinMatch[1]);
  if (!pinVal.isValid) throw new BadRequestException(pinVal.error);

  let matchedState = '';
  for (const s of INDIAN_STATES) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(text)) {
      matchedState = s;
      break;
    }
  }

  if (!matchedState) {
    throw new BadRequestException('Please select a valid Indian state.');
  }

  let extractedName = lines[0] || 'Customer';
  const nameVal = validateFullName(extractedName);

  let extractedCity = '';
  const streetLines: string[] = [];

  const middleLines = lines.filter((line, idx) => {
    if (idx === 0 && line === extractedName) return false;
    if (line.replace(/[^0-9]/g, '') === phoneVal.normalized && line.length <= 13) return false;
    if (/^(india|in)$/i.test(line)) return false;
    return true;
  });

  for (const line of middleLines) {
    if (matchedState && new RegExp(`\\b${matchedState}\\b`, 'i').test(line)) {
      const stateIdx = line.toLowerCase().indexOf(matchedState.toLowerCase());
      const before = line.slice(0, stateIdx).replace(/,\s*$/, '').trim();
      if (before.length >= 2) {
        extractedCity = before;
      }
    } else {
      streetLines.push(line);
    }
  }

  const fullStreet = streetLines.join(', ') || 'Street Address';
  const addr1Val = validateAddressLine1(fullStreet, extractedCity || undefined, matchedState);
  if (!addr1Val.isValid) {
    throw new BadRequestException(addr1Val.error);
  }

  const addressObject: StructuredAddress = {
    name: nameVal.isValid ? nameVal.normalized : 'Customer',
    phone: phoneVal.normalized,
    add: addr1Val.normalized,
    city: extractedCity || 'Rajpura',
    state: matchedState,
    pin: pinVal.normalized,
    country: 'India',
  };

  return {
    isValid: true,
    sanitizedAddress: JSON.stringify(addressObject),
    addressObject,
  };
}

