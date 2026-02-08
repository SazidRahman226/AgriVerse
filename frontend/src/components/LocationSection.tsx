import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapApi } from "@/api/map";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Locate, Loader2, Save, CheckCircle2 } from "lucide-react";
import { AxiosError } from "axios";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pinIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const STORAGE_KEY = "user_location";

interface SavedLocation {
    latitude: number;
    longitude: number;
    updatedAt: string;
}

function loadSavedLocation(): SavedLocation | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as SavedLocation;
    } catch {
        return null;
    }
}

function persistLocation(lat: number, lng: number) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ latitude: lat, longitude: lng, updatedAt: new Date().toISOString() })
    );
}

// ─── Click to place marker ───
function ClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onLocationSelect(
                parseFloat(e.latlng.lat.toFixed(6)),
                parseFloat(e.latlng.lng.toFixed(6))
            );
        },
    });
    return null;
}

// ─── Fly map to a position ───
function FlyTo({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, 16, { duration: 1.2 });
        }
    }, [position, map]);
    return null;
}

// ─── Google Maps–style "My Location" button (bottom-right) ───
function MyLocationControl({
    onLocated,
}: {
    onLocated: (lat: number, lng: number) => void;
}) {
    const map = useMap();
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const [locating, setLocating] = useState(false);

    useEffect(() => {
        // Create a custom Leaflet control
        const control = new L.Control({ position: "bottomright" });

        control.onAdd = () => {
            const container = L.DomUtil.create("div", "");
            container.style.cssText = "pointer-events:auto;";

            const btn = document.createElement("button");
            btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3"/>
          <path d="M12 19v3"/>
          <path d="M2 12h3"/>
          <path d="M19 12h3"/>
        </svg>
      `;
            btn.title = "Go to my location";
            btn.style.cssText = `
        width: 40px; height: 40px;
        background: white; border: none; border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: #666;
        transition: color 0.2s, box-shadow 0.2s;
        margin-bottom: 48px;
      `;
            btn.onmouseenter = () => { btn.style.color = "#4285F4"; };
            btn.onmouseleave = () => { btn.style.color = "#666"; };

            btn.onclick = (e) => {
                e.stopPropagation();
                if (!navigator.geolocation) return;
                setLocating(true);
                btn.style.color = "#4285F4";
                // Add a spinning animation
                const svg = btn.querySelector("svg");
                if (svg) svg.style.animation = "spin 1s linear infinite";

                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = parseFloat(pos.coords.latitude.toFixed(6));
                        const lng = parseFloat(pos.coords.longitude.toFixed(6));
                        onLocated(lat, lng);
                        map.flyTo([lat, lng], 16, { duration: 1.5 });
                        setLocating(false);
                        if (svg) svg.style.animation = "";
                    },
                    () => {
                        setLocating(false);
                        if (svg) svg.style.animation = "";
                        btn.style.color = "#d93025";
                        setTimeout(() => { btn.style.color = "#666"; }, 2000);
                    },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
                );
            };

            // Add the spin keyframes if not already present
            if (!document.getElementById("leaflet-spin-style")) {
                const style = document.createElement("style");
                style.id = "leaflet-spin-style";
                style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
                document.head.appendChild(style);
            }

            L.DomEvent.disableClickPropagation(container);
            container.appendChild(btn);
            btnRef.current = btn;
            return container;
        };

        control.addTo(map);
        return () => {
            control.remove();
        };
    }, [map, onLocated]);

    return null;
}

const LocationSection = () => {
    const { toast } = useToast();

    const [pickedLat, setPickedLat] = useState<number | null>(null);
    const [pickedLng, setPickedLng] = useState<number | null>(null);
    const [savedLat, setSavedLat] = useState<number | null>(null);
    const [savedLng, setSavedLng] = useState<number | null>(null);
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [mapExpanded, setMapExpanded] = useState(false);

    // Load persisted location on mount
    useEffect(() => {
        const saved = loadSavedLocation();
        if (saved) {
            setSavedLat(saved.latitude);
            setSavedLng(saved.longitude);
            setPickedLat(saved.latitude);
            setPickedLng(saved.longitude);
        }
    }, []);

    const handleLocationSelect = useCallback((lat: number, lng: number) => {
        setPickedLat(lat);
        setPickedLng(lng);
    }, []);

    // Called by the in-map "my location" button
    const handleMapLocated = useCallback((lat: number, lng: number) => {
        setUserLat(lat);
        setUserLng(lng);
    }, []);

    // Header "Use Current Location" button
    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast({ title: "Not Supported", description: "Geolocation is not supported.", variant: "destructive" });
            return;
        }
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = parseFloat(pos.coords.latitude.toFixed(6));
                const lng = parseFloat(pos.coords.longitude.toFixed(6));
                setPickedLat(lat);
                setPickedLng(lng);
                setUserLat(lat);
                setUserLng(lng);
                setFlyTarget([lat, lng]);
                setGeoLoading(false);
                if (!mapExpanded) setMapExpanded(true);
                toast({ title: "Location Detected", description: `${lat}, ${lng} — click Save to update.` });
            },
            (err) => {
                setGeoLoading(false);
                toast({
                    title: "Location Access Denied",
                    description: err.code === 1 ? "Allow location access in browser settings." : "Could not get location.",
                    variant: "destructive",
                });
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
    };

    // Save
    const handleSave = async () => {
        if (pickedLat == null || pickedLng == null) {
            toast({ title: "No Location", description: "Tap the map or use current location first.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const res = await mapApi.updateMyLocation({ latitude: pickedLat, longitude: pickedLng });
            persistLocation(res.latitude, res.longitude);
            setSavedLat(res.latitude);
            setSavedLng(res.longitude);
            toast({ title: "Location Updated", description: `Saved (${res.latitude}, ${res.longitude}).` });
        } catch (error) {
            const axiosErr = error as AxiosError<any>;
            const data = axiosErr.response?.data;
            const status = axiosErr.response?.status;
            if (status === 400 && data?.errors) {
                const msgs = Object.values(data.errors).join(", ");
                toast({ title: "Validation Error", description: msgs, variant: "destructive" });
            } else {
                toast({ title: "Error", description: data?.message || "Failed to update location.", variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const hasLocation = savedLat != null && savedLng != null;
    const isDirty = pickedLat !== savedLat || pickedLng !== savedLng;

    const defaultCenter: [number, number] =
        pickedLat != null && pickedLng != null
            ? [pickedLat, pickedLng]
            : [23.8103, 90.4125];

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gradient-to-r from-primary/5 to-transparent">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-base flex items-center gap-1.5">
                                Location
                                {hasLocation && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                                {pickedLat != null && pickedLng != null
                                    ? `📍 ${pickedLat.toFixed(4)}, ${pickedLng.toFixed(4)}${isDirty ? " (unsaved)" : ""}`
                                    : hasLocation
                                        ? `📍 ${savedLat!.toFixed(4)}, ${savedLng!.toFixed(4)}`
                                        : "Tap the map or use current location to set your position"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={handleUseCurrentLocation}
                            disabled={geoLoading}
                        >
                            {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                            {geoLoading ? "Detecting…" : "Use Current Location"}
                        </Button>

                        {!mapExpanded && (
                            <Button size="sm" variant="secondary" onClick={() => setMapExpanded(true)}>
                                {hasLocation ? "Change" : "Set on Map"}
                            </Button>
                        )}

                        {mapExpanded && pickedLat != null && pickedLng != null && (
                            <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving || (!isDirty && hasLocation)}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {hasLocation ? "Update" : "Save"}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Map Picker */}
                {mapExpanded && (
                    <div className="relative animate-fade-in">
                        <div className="h-[300px] sm:h-[350px] w-full">
                            <MapContainer center={defaultCenter} zoom={pickedLat ? 15 : 7} className="h-full w-full z-0">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <ClickHandler onLocationSelect={handleLocationSelect} />
                                <FlyTo position={flyTarget} />
                                <MyLocationControl onLocated={handleMapLocated} />

                                {/* Blue pulsing dot for user's real-time location */}
                                {userLat != null && userLng != null && (
                                    <>
                                        {/* Outer pulse ring */}
                                        <CircleMarker
                                            center={[userLat, userLng]}
                                            radius={18}
                                            pathOptions={{
                                                color: "#4285F4",
                                                fillColor: "#4285F4",
                                                fillOpacity: 0.15,
                                                weight: 1,
                                                opacity: 0.3,
                                            }}
                                        />
                                        {/* Inner solid dot */}
                                        <CircleMarker
                                            center={[userLat, userLng]}
                                            radius={7}
                                            pathOptions={{
                                                color: "white",
                                                fillColor: "#4285F4",
                                                fillOpacity: 1,
                                                weight: 2,
                                            }}
                                        />
                                    </>
                                )}

                                {/* Red pin for picked/saved location */}
                                {pickedLat != null && pickedLng != null && (
                                    <Marker position={[pickedLat, pickedLng]} icon={pinIcon} />
                                )}
                            </MapContainer>
                        </div>

                        {/* Floating hint */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur text-xs px-3 py-1.5 rounded-full shadow border border-border/50 text-muted-foreground pointer-events-none">
                            Click anywhere on the map to set your location
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default LocationSection;
