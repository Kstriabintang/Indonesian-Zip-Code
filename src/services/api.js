import { searchLocalDatabase } from "./localData";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PHOTON_BASE = "https://photon.komoot.io";
const KONOLAND_API = "https://konoland-api.vercel.app";
const VERCEL_API = "https://kodepos.vercel.app";

export const reverseGeocode = async (lat, lon) => {
  const res = await fetch(
    `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=id`,
    { headers: { "Accept-Language": "id", "User-Agent": "CariKodePos-App" } }
  );
  if (!res.ok) throw new Error("Gagal reverse geocode");
  return res.json();
};

/**
 * Enhanced search using Photon API (Fuzzy search, handles typos better)
 */
export const searchLocations = async (query) => {
  const res = await fetch(
    `${PHOTON_BASE}/api?q=${encodeURIComponent(query)}&limit=10`
  );
  if (!res.ok) throw new Error("Gagal mencari lokasi");
  const data = await res.json();
  
  if (!data.features) return [];

  return data.features.map(f => ({
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    display_name: [
      f.properties.name,
      f.properties.street,
      f.properties.district,
      f.properties.city,
      f.properties.state
    ].filter(Boolean).join(", "),
    address: {
      road: f.properties.street,
      village: f.properties.district,
      city_district: f.properties.city,
      city: f.properties.city,
      state: f.properties.state,
      postcode: f.properties.postcode
    }
  }));
};

/**
 * Super robust postal code fetcher with Local Primary -> API Fallback
 */
export const fetchPostalCode = async (query) => {
  if (!query || query.length < 2) return null;
  
  const clean = query.replace(/indonesia|provinsi|kabupaten|kecamatan|kelurahan|desa/gi, "").trim();

  // STEP 0: Local "Source of Truth" (Fastest & Guaranteed)
  const localResults = searchLocalDatabase(clean);
  if (localResults.length > 0) {
    return localResults;
  }

  // Try API 1: Konoland
  try {
    const res = await fetch(`${KONOLAND_API}/search?q=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        return data.data.filter(item => item.postalCode).map(item => ({
          postalcode: item.postalCode,
          urban: item.village || item.name || "",
          district: item.district || "",
          city: item.regency || "",
          province: item.province || ""
        }));
      }
    }
  } catch (e) { console.warn("Konoland failed, trying fallback..."); }

  // Try API 2: Vercel Legacy
  try {
    const res = await fetch(`${VERCEL_API}/search?q=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        return data.data.map(item => ({
          postalcode: item.code,
          urban: item.village,
          district: item.district,
          city: item.regency,
          province: item.province
        }));
      }
    }
  } catch (e) { console.error("All APIs failed for:", query); }

  return null;
};
