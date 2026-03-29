import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X, Check, Navigation, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Fix for default marker icon in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface NgMapProps {
  onSelect: (ng: number) => void;
  onClose: () => void;
  initialNg?: number;
}

// Simplified Ng estimation logic for Brazil
// This is a heuristic based on general lightning density patterns in Brazil
const estimateNg = (lat: number, lng: number): number => {
  // Brazil bounds roughly: Lat 5 to -34, Lng -74 to -34
  // High density areas: North (Amazonas), Center-West (MT, MS, GO), Southeast (MG, SP)
  // Lower density: Northeast coast, extreme South
  
  // Base value
  let ng = 6.0;
  
  // Amazonas/North region (High)
  if (lat > -10 && lng < -55) ng += 8;
  
  // Center-West (High)
  if (lat < -10 && lat > -22 && lng < -45 && lng > -60) ng += 10;
  
  // Southeast (Medium-High)
  if (lat < -18 && lat > -25 && lng < -40 && lng > -52) ng += 6;
  
  // Northeast (Lower)
  if (lat > -15 && lng > -45) ng -= 3;
  
  // Extreme South (Lower)
  if (lat < -28) ng -= 2;

  // Add some "noise" based on coordinates for variety
  const noise = Math.abs(Math.sin(lat * 10) * Math.cos(lng * 10)) * 3;
  
  return Math.max(1, Math.min(22, ng + noise));
};

const LocationMarker = ({ onLocationSelect, externalPos }: { onLocationSelect: (lat: number, lng: number) => void, externalPos?: L.LatLng | null }) => {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();

  useEffect(() => {
    if (externalPos) {
      setPosition(externalPos);
      map.flyTo(externalPos, 10);
    }
  }, [externalPos, map]);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

const NgMap: React.FC<NgMapProps> = ({ onSelect, onClose, initialNg }) => {
  const [selectedNg, setSelectedNg] = useState<number | null>(initialNg || null);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [externalPos, setExternalPos] = useState<L.LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  const handleLocationSelect = (lat: number, lng: number) => {
    const ng = estimateNg(lat, lng);
    setSelectedNg(Number(ng.toFixed(1)));
    setCoords({ lat, lng });
  };

  const handleMyLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latlng = L.latLng(latitude, longitude);
        setExternalPos(latlng);
        handleLocationSelect(latitude, longitude);
        setLocating(false);
      },
      (err) => {
        console.error(err);
        alert("Não foi possível obter sua localização.");
        setLocating(false);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-lg">
                Estimativa de Densidade de Descargas (Ng)
              </h3>
              <p className="text-xs text-zinc-500">Selecione o local da obra no mapa para obter o valor referencial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={24} className="text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Map Area */}
          <div className="flex-1 relative min-h-[300px]">
            <MapContainer 
              center={[-15.7801, -47.9292]} 
              zoom={4} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker onLocationSelect={handleLocationSelect} externalPos={externalPos} />
            </MapContainer>

            <button 
              onClick={handleMyLocation}
              disabled={locating}
              className="absolute top-4 right-4 z-[1000] bg-white p-3 rounded-full shadow-lg border border-zinc-200 hover:bg-zinc-50 transition-colors disabled:opacity-50 group"
              title="Usar minha localização"
            >
              <Navigation className={`text-emerald-600 group-hover:scale-110 transition-transform ${locating ? 'animate-pulse' : ''}`} size={22} />
            </button>
          </div>

          {/* Sidebar Info / Legend */}
          <div className="w-full md:w-80 bg-zinc-50 border-l border-zinc-100 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Selected Value Section - Now in Sidebar */}
              <AnimatePresence mode="wait">
                {selectedNg !== null ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm space-y-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex flex-col items-center justify-center shadow-lg shadow-emerald-100 shrink-0">
                        <span className="text-lg font-black leading-none">{selectedNg}</span>
                        <span className="text-[7px] font-bold uppercase">Ng</span>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-zinc-400 mb-0.5 tracking-wider">Valor Selecionado</p>
                        <p className="text-sm font-bold text-zinc-900">
                          {selectedNg} <span className="text-[10px] font-normal text-zinc-500">desc/km²/ano</span>
                        </p>
                        {coords && (
                          <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                            {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => onSelect(selectedNg)}
                      className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-50 active:scale-95"
                    >
                      <Check size={18} />
                      Confirmar
                    </button>
                  </motion.div>
                ) : (
                  <div className="bg-zinc-100/50 border border-dashed border-zinc-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                    <MapPin className="text-zinc-300" size={32} />
                    <p className="text-xs font-medium text-zinc-400">Clique no mapa para selecionar um local</p>
                  </div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Info size={14} />
                  Sobre o Ng
                </h4>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  O <strong>Ng</strong> representa a densidade de descargas atmosféricas para a terra em uma determinada região. É o parâmetro fundamental para o cálculo de risco.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={14} />
                  Aviso Importante
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Os valores apresentados neste mapa são <strong>estimativas baseadas em modelos geográficos</strong>.
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Para projetos oficiais e emissão de ART, o profissional <strong>deve obrigatoriamente</strong> consultar:
                </p>
                <ul className="text-[11px] text-amber-800 space-y-1.5 list-disc pl-4 font-medium">
                  <li>Dados oficiais do INPE / ELAT</li>
                  <li>Mapas anexos da ABNT NBR 5419-2</li>
                  <li>Sistemas de monitoramento certificados</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50">
              <p className="text-[10px] text-zinc-400 text-center italic">
                RiscoPro 2026 - Ferramenta de Apoio Técnico
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NgMap;
