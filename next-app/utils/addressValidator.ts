/**
 * Production-ready Indian Shipping Address Validator and Sanitizer
 */

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

/**
 * Normalizes input:
 * - Trims leading and trailing spaces
 * - Collapses multiple spaces into a single space
 * - Strips dangerous HTML/script tags
 */
export function normalizeAddressInput(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[\r\n\t]+/g, ' ') // convert newlines/tabs to space
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Checks for obvious test keywords, repeated spam patterns, or meaningless gibberish
 */
export function isTestOrGibberish(value: string): boolean {
  const clean = normalizeAddressInput(value).toLowerCase();
  if (!clean) return true;

  // 1. Check for 4 or more identical consecutive characters (e.g., 'aaaa', '1111', '!!!!')
  if (/(.)\1{3,}/i.test(clean)) {
    return true;
  }

  // 2. Purely special characters (no letters and no digits)
  if (!/[a-zA-Z0-9]/.test(clean)) {
    return true;
  }

  // 3. Isolated test/spam keywords
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

  // If the whole string matches a test keyword
  if (testKeywords.includes(clean)) {
    return true;
  }

  // Check if all words in string are test keywords
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => testKeywords.includes(w))) {
    return true;
  }

  return false;
}

/**
 * Validates Address Line 1
 */
export function validateAddressLine1(
  addressLine1: string | null | undefined,
  city?: string | null | undefined,
  state?: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(addressLine1);

  if (!normalized) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  // Length check: min 10, max 150
  if (normalized.length < 10 || normalized.length > 150) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  // Must contain at least one alphabetic character
  if (!/[a-zA-Z]/.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  // Allowed characters: letters, numbers, spaces, and punctuation: . , - / # ( ) & : ' @ +
  const allowedCharsRegex = /^[a-zA-Z0-9\s\.\,\-\/\#\(\)\&\:\'\@\+]+$/;
  if (!allowedCharsRegex.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  // Reject purely numeric or test/gibberish
  if (isTestOrGibberish(normalized) || /^[0-9\s\.\,\-\/\#\(\)]+$/.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a complete delivery address with house/flat/shop number, building, street, area or locality.",
      normalized,
    };
  }

  // Cross-field validation: Reject if Address Line 1 is merely identical to City or State
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

  // Must contain meaningful address information (at least 2 words or contains digits + letters)
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

/**
 * Validates Address Line 2 (Optional)
 */
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

/**
 * Validates City
 */
export function validateCity(
  city: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(city);

  if (!normalized || normalized.length < 2 || normalized.length > 100) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  // Must only contain letters, spaces, hyphens, dots, apostrophes
  if (!/^[a-zA-Z\s\.\-\']+$/.test(normalized)) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  // Must have at least 2 alphabetic characters
  const alphaMatch = normalized.match(/[a-zA-Z]/g);
  if (!alphaMatch || alphaMatch.length < 2) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  if (isTestOrGibberish(normalized)) {
    return { isValid: false, error: "Please enter or select a valid city.", normalized };
  }

  return { isValid: true, normalized };
}

/**
 * Validates State
 */
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

/**
 * Validates 6-digit Indian Postal Code
 */
export function validatePostalCode(
  postalCode: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = String(postalCode || '').trim();

  // Exactly 6 digits, first digit 1-9
  if (!/^[1-9][0-9]{5}$/.test(normalized)) {
    return { isValid: false, error: "Please enter a valid 6-digit Indian postal code.", normalized };
  }

  // Reject obvious fake repeating PIN codes
  if (/^(.)\1{5}$/.test(normalized) || normalized === '123456' || normalized === '654321') {
    return { isValid: false, error: "Please enter a valid 6-digit Indian postal code.", normalized };
  }

  return { isValid: true, normalized };
}

/**
 * Validates Country
 */
export function validateCountry(
  country: string | null | undefined
): { isValid: boolean; error?: string; normalized: string } {
  const normalized = normalizeAddressInput(country);

  if (!normalized || normalized.toLowerCase() !== 'india') {
    return { isValid: false, error: "Please select a valid country.", normalized };
  }

  return { isValid: true, normalized: 'India' };
}

/**
 * Validates Full Name
 */
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

/**
 * Validates Phone Number
 */
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
