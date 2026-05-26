import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

type Props = {
  latitude: number | null;
  longitude: number | null;
  campusLocation: string;
  onLocationSelect?: (lat: number, lng: number, address: string) => void;
  editable?: boolean;
};

export function LocationMap({ latitude, longitude, campusLocation, onLocationSelect, editable = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);

  useEffect(() => {
    if (!mapRef.current) return;

    // Simple OpenStreetMap embed as fallback (no API key needed)
    const lat = currentLat ?? 40.7128;
    const lng = currentLng ?? -74.006;
    const bbox = `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`;

    setLoading(true);
    setError(null);

    // Use OpenStreetMap static image (free, no API key)
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

    const iframe = document.createElement('iframe');
    iframe.src = mapUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';

    iframe.onload = () => setLoading(false);
    iframe.onerror = () => {
      setError('Failed to load map');
      setLoading(false);
    };

    mapRef.current.innerHTML = '';
    mapRef.current.appendChild(iframe);

    return () => {
      if (mapRef.current) {
        mapRef.current.innerHTML = '';
      }
    };
  }, [currentLat, currentLng]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLat(lat);
        setCurrentLng(lng);
        onLocationSelect?.(lat, lng, 'Current Location');
      },
      (err) => {
        setError(err.message);
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full h-48 bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading map...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80">
            <div className="text-center text-slate-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span className="text-sm">{campusLocation || 'Location not set'}</span>
        </div>

        {editable && (
          <button
            onClick={handleGetCurrentLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            Use My Location
          </button>
        )}
      </div>

      {currentLat && currentLng && (
        <p className="text-xs text-slate-600 font-mono">
          {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
