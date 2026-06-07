// Local Source of Truth for 100% Reliability
// Inspired by sooluh/kodepos static data approach
export const LOCAL_KODEPOS_DB = [
  { urban: "Limbung", district: "Sungai Raya", regency: "Kubu Raya", province: "Kalimantan Barat", postalcode: "78391" },
  { urban: "Arang Limbung", district: "Sungai Raya", regency: "Kubu Raya", province: "Kalimantan Barat", postalcode: "78391" },
  { urban: "Pasir Kemilu", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29316" },
  { urban: "Kuantan Baru", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29314" },
  { urban: "Sekip Hulu", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29319" },
  { urban: "Sekip Hilir", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29312" },
  { urban: "Kampung Besar Kota", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29312" },
  { urban: "Kampung Besar Seberang", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29315" },
  { urban: "Pasar Kota", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29311" },
  { urban: "Sidomulyo", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29317" },
  { urban: "Sungai Guntung Hilir", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29318" },
  { urban: "Sungai Guntung Hulu", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29318" },
  { urban: "Sungai Beringin", district: "Rengat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29311" },
  { urban: "Pematang Reba", district: "Rengat Barat", regency: "Indragiri Hulu", province: "Riau", postalcode: "29351" },
  { urban: "Jakarta", district: "Gambir", regency: "Jakarta Pusat", province: "DKI Jakarta", postalcode: "10110" },
  { urban: "Bandung", district: "Sumur Bandung", regency: "Bandung", province: "Jawa Barat", postalcode: "40111" },
  { urban: "Surabaya", district: "Genteng", regency: "Surabaya", province: "Jawa Timur", postalcode: "60271" },
  { urban: "Medan", district: "Medan Kota", regency: "Medan", province: "Sumatera Utara", postalcode: "20211" },
  { urban: "Makassar", district: "Ujung Pandang", regency: "Makassar", province: "Sulawesi Selatan", postalcode: "90111" }
];

/**
 * Perform a fuzzy search on the local database
 */
export const searchLocalDatabase = (query) => {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  
  return LOCAL_KODEPOS_DB.filter(item => 
    item.urban.toLowerCase().includes(q) ||
    item.district.toLowerCase().includes(q) ||
    item.postalcode.includes(q)
  );
};
