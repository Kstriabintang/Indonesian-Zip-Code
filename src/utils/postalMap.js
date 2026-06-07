// Safety net for common Indonesian areas that might have API matching issues
export const PRESET_POSTAL_CODES = {
  "limbung": "78391",
  "arang limbung": "78391",
  "pasir kemilu": "29316",
  "rengat": "29311",
  "kuantan baru": "29314",
  "sekip hulu": "29319",
  "sekip hilir": "29312",
  "pematang reba": "29351",
  "sungai raya": "78391",
  "kubu raya": "78391",
  "pontianak": "78111"
};

/**
 * Checks if a location name has a hardcoded postal code fallback
 */
export const getPresetPostalCode = (name) => {
  if (!name) return null;
  const clean = name.toLowerCase().trim();
  
  // Direct match
  if (PRESET_POSTAL_CODES[clean]) return PRESET_POSTAL_CODES[clean];
  
  // Fuzzy match (contained in)
  for (const [key, code] of Object.entries(PRESET_POSTAL_CODES)) {
    if (clean.includes(key)) return code;
  }
  
  return null;
};
