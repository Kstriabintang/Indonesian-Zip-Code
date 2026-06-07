import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, MapPin, Locate, Copy, Check, Loader2, 
  Navigation, Info, ChevronRight, X, Globe, 
  Building2, Map as MapIcon, Layers
} from "lucide-react";
import { cn } from "./utils/cn";
import { useGeolocation } from "./hooks/useGeolocation";
import { reverseGeocode, searchLocations, fetchPostalCode } from "./services/api";
import { getPresetPostalCode } from "./utils/postalMap";

const NOMINATIM_ATTRIBUTION = '© <a href="https://openstreetmap.org">OSM</a>';
const DARK_MAP_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const SATELLITE_TILES = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";

export default function PostalFinder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSatellite, setIsSatellite] = useState(true);
  const [alternatives, setAlternatives] = useState([]);

  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const { location: gpsLocation, loading: gpsLoading, getPosition } = useGeolocation();

  useEffect(() => {
    const initMap = () => {
      if (leafletMap.current || !mapRef.current) return;
      
      const map = window.L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([-2.5489, 118.0149], 5);

      tileLayerRef.current = window.L.tileLayer(isSatellite ? SATELLITE_TILES : DARK_MAP_TILES, {
        maxZoom: 20,
        maxNativeZoom: 18
      }).addTo(map);

      leafletMap.current = map;
      setMapReady(true);
    };

    if (window.L) {
      initMap();
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  const toggleMapMode = () => {
    if (!leafletMap.current || !tileLayerRef.current) return;
    const newMode = !isSatellite;
    setIsSatellite(newMode);
    tileLayerRef.current.setUrl(newMode ? SATELLITE_TILES : DARK_MAP_TILES);
  };

  const openStreetView = () => {
    if (!selected?.details?.koordinat) return;
    const [lat, lon] = selected.details.koordinat.split(', ');
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`, '_blank');
  };

  useEffect(() => {
    if (gpsLocation) handleLocationSelect(gpsLocation.lat, gpsLocation.lon, "Lokasi Saya");
  }, [gpsLocation]);

  const placeMarker = useCallback((lat, lon) => {
    if (!leafletMap.current) return;
    if (markerRef.current) markerRef.current.remove();

    const customIcon = window.L.divIcon({
      className: "custom-marker",
      html: `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <div class="absolute inset-0 bg-sky-400 rounded-full animate-ping opacity-30"></div>
          <div class="relative w-4 h-4 bg-sky-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(56,189,248,0.8)]"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    markerRef.current = window.L.marker([lat, lon], { icon: customIcon }).addTo(leafletMap.current);
    leafletMap.current.flyTo([lat, lon], 19, { duration: 1.5 });
  }, []);

  useEffect(() => {
    if (query.length < 3) { setResults([]); setShowResults(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchLocations(query);
        setResults(data);
        setShowResults(data.length > 0);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleLocationSelect = async (lat, lon, displayName) => {
    setLoading(true); setError(""); setShowResults(false); setAlternatives([]);
    try {
      placeMarker(lat, lon);
      const geoData = await reverseGeocode(lat, lon);
      const address = geoData.address || {};
      const village = address.village || address.suburb || address.neighbourhood || "";
      const district = address.city_district || address.city || "";
      const regency = address.county || address.city || address.regency || "";
      
      let finalPostalCode = getPresetPostalCode(village) || getPresetPostalCode(displayName) || address.postcode || "Tidak tersedia";
      let foundData = null;
      const searchTerms = [village, district, `${village} ${district}`, displayName.split(',')[0], regency].filter(t => t && t.length > 2);

      for (const term of searchTerms) {
        const data = await fetchPostalCode(term);
        if (data && data.length > 0) { foundData = data; break; }
      }

      if (foundData && foundData.length > 0) {
        setAlternatives(foundData);
        if (finalPostalCode === "Tidak tersedia" || finalPostalCode === address.postcode) {
           const exactMatch = foundData.find(p => village && (village.toLowerCase().includes(p.urban?.toLowerCase() || "") || (p.urban?.toLowerCase() || "").includes(village.toLowerCase())));
           finalPostalCode = exactMatch ? exactMatch.postalcode : foundData[0].postalcode;
        }
      }

      setSelected({
        displayName: displayName || geoData.display_name,
        fullAddress: geoData.display_name,
        postalCode: finalPostalCode,
        details: { road: address.road, kelurahan: village, kecamatan: district, kota: regency, provinsi: address.state, koordinat: `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}` }
      });
      if (!sidebarOpen) setSidebarOpen(true);
    } catch (err) { setError("Gagal mendapatkan detail lokasi."); } finally { setLoading(false); }
  };

  const onSearchSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (results.length > 0) {
      handleLocationSelect(results[0].lat, results[0].lon, results[0].display_name);
    } else {
      setLoading(true); setError("");
      try {
        const data = await searchLocations(query);
        if (data.length > 0) handleLocationSelect(data[0].lat, data[0].lon, data[0].display_name);
        else setError("Lokasi tidak ditemukan.");
      } catch (err) { setError("Gagal mencari lokasi."); } finally { setLoading(false); }
    }
  };

  const handleCopy = () => {
    if (!selected?.postalCode || selected.postalCode === "Tidak tersedia") return;
    navigator.clipboard.writeText(selected.postalCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-sky-500/30">
      
      {/* Background Particles (Optimized) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: Math.random() * 1000, y: Math.random() * 1000, opacity: 0.1 }}
            animate={{ y: [0, -200], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: Math.random() * 20 + 10, repeat: Infinity, ease: "linear" }}
            className="absolute w-1 h-1 bg-sky-500/20 rounded-full"
          />
        ))}
      </div>

      {/* Map */}
      <div ref={mapRef} className="absolute inset-0 z-0 bg-[#020617]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none z-[1]" />

      {/* Search Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 md:p-8 flex flex-col items-center">
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-3xl">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-3xl blur-xl opacity-20 transition duration-1000 group-focus-within:opacity-40"></div>
            <form onSubmit={onSearchSubmit} className="relative flex items-center bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="pl-6 text-slate-400"><Search size={22} /></div>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik alamat, jalan, atau desa..." className="flex-1 bg-transparent border-none py-5 px-4 text-base outline-none placeholder:text-slate-500 font-medium" />
              <div className="flex items-center gap-2 pr-3">
                {query && <button type="button" onClick={() => { setQuery(""); setResults([]); setShowResults(false); }} className="p-2 text-slate-500 hover:text-white"><X size={20} /></button>}
                <div className="w-[1px] h-8 bg-white/10 mx-1" />
                <button type="button" onClick={getPosition} disabled={gpsLoading} className="p-3 text-slate-400 hover:text-sky-400">{gpsLoading ? <Loader2 className="animate-spin" size={22} /> : <Locate size={22} />}</button>
                <button type="submit" disabled={loading} className="bg-sky-500 hover:bg-sky-400 text-white px-6 md:px-8 py-3 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95">{loading ? <Loader2 className="animate-spin" size={18} /> : "Cari"}</button>
              </div>
            </form>
            <AnimatePresence>
              {showResults && results.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute mt-3 w-full bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-[50vh] overflow-y-auto">
                  {results.map((item, idx) => (
                    <button key={idx} onClick={() => { handleLocationSelect(item.lat, item.lon, item.display_name); setResults([]); }} className="w-full text-left px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-all flex items-start gap-4">
                      <div className="mt-1 p-2 bg-slate-800 rounded-lg"><MapPin size={18} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-100 truncate">{item.display_name.split(',')[0]}</div>
                        <div className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">{item.display_name}</div>
                      </div>
                      <ChevronRight size={18} className="self-center text-slate-600" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 bg-red-500/10 backdrop-blur-md border border-red-500/20 text-red-400 text-xs font-bold py-3 px-6 rounded-2xl flex items-center gap-3">{error}</motion.div>}
        </motion.div>
      </div>

      {/* Info Sidebar */}
      <div className="absolute bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:left-auto md:right-0 md:h-full md:w-[450px] z-40 p-4 md:p-8 pointer-events-none">
        <AnimatePresence>
          {selected && sidebarOpen && (
            <motion.div initial={{ x: 500, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 500, opacity: 0 }} className="pointer-events-auto w-full md:h-full flex flex-col">
              <div className="mt-auto md:mt-24 bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] relative">
                <div className="p-8 pb-4 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-sky-500 text-white rounded-2xl shadow-lg"><MapPin size={28} /></div>
                    <div>
                      <h2 className="text-2xl font-black text-white leading-tight">{selected.displayName.split(',')[0]}</h2>
                      <div className="flex items-center gap-2 mt-1"><span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest bg-sky-400/10 px-2 py-0.5 rounded-full border border-sky-400/20">Indonesia</span></div>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-3 text-slate-500 hover:text-white rounded-full transition-all"><X size={24} /></button>
                </div>

                <div className="px-8 py-4">
                  <div className="bg-slate-800/80 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden">
                    <span className="text-sky-400 text-[11px] font-black uppercase tracking-[0.2em] mb-2 block">Postal Code</span>
                    <div className="flex items-end justify-between">
                      <h3 className="text-6xl font-black text-white tabular-nums">{selected.postalCode}</h3>
                      <button onClick={handleCopy} className={cn("px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all shadow-xl", copied ? "bg-emerald-500 text-white" : "bg-white text-slate-900 hover:bg-sky-400 hover:text-white")}>{copied ? "Copied!" : "Copy"}</button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <SidebarAction onClick={openStreetView} icon={<Navigation size={22} />} label="Street View" sub="360° View" />
                      <SidebarAction onClick={toggleMapMode} icon={<Layers size={22} />} label={isSatellite ? "Modern" : "Realistic"} sub={isSatellite ? "Vector" : "Satellite"} active={isSatellite} />
                    </div>
                    <div className="space-y-1">
                      <DetailCard icon={<Building2 size={18} />} label="Kelurahan" value={selected.details.kelurahan} />
                      <DetailCard icon={<MapIcon size={18} />} label="Kecamatan" value={selected.details.kecamatan} />
                      <DetailCard icon={<Layers size={18} />} label="Kota/Kab" value={selected.details.kota} />
                      <DetailCard icon={<Globe size={18} />} label="Provinsi" value={selected.details.provinsi} />
                    </div>
                    <div className="bg-black/40 p-5 rounded-3xl border border-white/5 flex items-center justify-between">
                      <code className="text-xs text-sky-400 font-mono tracking-tighter">COORDS: {selected.details.koordinat}</code>
                      <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-[0_0_10px_rgba(14,165,233,0.8)]" />
                    </div>
                    {alternatives.length > 0 && (
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nearby Suggestions</span>
                        {alternatives.slice(0, 5).map((alt, i) => (
                          <button key={i} onClick={() => setSelected(prev => ({ ...prev, postalCode: alt.postalcode, details: { ...prev.details, kelurahan: alt.urban } }))} className={cn("w-full flex items-center justify-between p-4 rounded-2xl border transition-all", selected.postalCode === alt.postalcode ? "bg-sky-500/20 border-sky-500/40" : "bg-white/5 border-white/5 hover:bg-white/10")}>
                            <div className="text-left"><div className="text-xs font-bold text-slate-200">{alt.urban}</div><div className="text-[10px] font-medium text-slate-500">{alt.district}</div></div>
                            <div className="text-base font-black font-mono text-white">{alt.postalcode}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {!selected && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="md:mt-24 pointer-events-auto h-full flex flex-col">
              <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-12 text-center flex flex-col items-center justify-center gap-8 shadow-2xl">
                <div className="relative w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl"><Locate size={40} className="text-sky-400" /></div>
                <div><h2 className="text-2xl font-black text-white mb-3">Siap Menjelajah?</h2><p className="text-sm text-slate-400 max-w-[250px] leading-relaxed mx-auto">Cari alamat Anda atau aktifkan GPS untuk mendeteksi kode pos secara otomatis.</p></div>
                <button onClick={getPosition} className="bg-white text-slate-950 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:bg-sky-400 hover:text-white transition-all">Aktifkan GPS</button>
              </div>
            </motion.div>
          )}
          {selected && !sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="w-16 h-16 bg-sky-500 text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center hover:scale-110 transition-all pointer-events-auto mt-auto mb-12 ml-auto"><Info size={32} /></button>}
        </AnimatePresence>
      </div>

      {/* Floating UI */}
      <div className="absolute bottom-8 left-8 z-40 hidden md:flex flex-col gap-4">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/30"><Navigation className="text-white" size={20} fill="currentColor" /></div>
          <div><h1 className="text-xl font-black text-white leading-none">CariKodePos<span className="text-sky-500">.id</span></h1><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Indonesia Registry</p></div>
        </div>
      </div>

      <style>{`
        .custom-marker { transition: all 0.5s ease; }
        .leaflet-container { background: #020617 !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

function SidebarAction({ icon, label, sub, onClick, active }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-start gap-1 p-5 rounded-[1.5rem] border transition-all group", active ? "bg-sky-500/20 border-sky-500/50" : "bg-white/5 border-white/5 hover:bg-white/10")}>
      <div className={cn("p-2 rounded-xl transition-all", active ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400 group-hover:text-sky-400")}>{icon}</div>
      <div className="mt-2"><div className="text-[11px] font-black text-white uppercase">{label}</div><div className="text-[9px] font-medium text-slate-500 uppercase">{sub}</div></div>
    </button>
  );
}

function DetailCard({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all group">
      <div className="p-2.5 bg-slate-800/50 text-slate-500 group-hover:bg-sky-500/10 group-hover:text-sky-400 rounded-xl transition-all">{icon}</div>
      <div className="flex-1 min-w-0"><div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">{label}</div><div className="text-sm text-slate-200 font-bold truncate group-hover:text-white transition-colors">{value}</div></div>
    </div>
  );
}
