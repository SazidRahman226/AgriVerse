import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGeolocation } from "@/hooks/use-geolocation";
import { mapApi, Officer } from "@/api/map";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
    MapPin,
    Navigation,
    User,
    Mail,
    Loader2,
    AlertCircle,
    Search,
    X,
    Locate,
    ArrowRight,
    Menu,
} from "lucide-react";

// ─── Fix default Leaflet marker icons ───
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Custom icons (Modernized) ───
const createIcon = (colorUrl: string) =>
    new L.Icon({
        iconUrl: colorUrl,
        shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });

const officerIcon = createIcon(
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png"
);
const selectedOfficerIcon = createIcon(
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png"
);
// ─── Google Maps–style "My Location" button ───
function MyLocationControl({
    onLocated,
}: {
    onLocated: (lat: number, lng: number) => void;
}) {
    const map = useMap();

    useEffect(() => {
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
      `;
            btn.onmouseenter = () => { btn.style.color = "#4285F4"; };
            btn.onmouseleave = () => { btn.style.color = "#666"; };

            btn.onclick = (e) => {
                e.stopPropagation();
                if (!navigator.geolocation) return;
                btn.style.color = "#4285F4";
                const svg = btn.querySelector("svg");
                if (svg) svg.style.animation = "spin 1s linear infinite";

                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = parseFloat(pos.coords.latitude.toFixed(6));
                        const lng = parseFloat(pos.coords.longitude.toFixed(6));
                        onLocated(lat, lng);
                        map.flyTo([lat, lng], 16, { duration: 1.5 });
                        if (svg) svg.style.animation = "";
                    },
                    () => {
                        if (svg) svg.style.animation = "";
                        btn.style.color = "#d93025";
                        setTimeout(() => { btn.style.color = "#666"; }, 2000);
                    },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
                );
            };

            if (!document.getElementById("leaflet-spin-style")) {
                const style = document.createElement("style");
                style.id = "leaflet-spin-style";
                style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
                document.head.appendChild(style);
            }

            L.DomEvent.disableClickPropagation(container);
            container.appendChild(btn);
            return container;
        };

        control.addTo(map);
        return () => { control.remove(); };
    }, [map, onLocated]);

    return null;
}

// ─── Haversine distance ───
function haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── FlyTo Helper ───
function FlyToPosition({
    position,
    zoom,
}: {
    position: [number, number] | null;
    zoom: number;
}) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, zoom, { duration: 1.5, easeLinearity: 0.25 });
        }
    }, [position, zoom, map]);
    return null;
}

interface OfficerWithDistance extends Officer {
    distance: number | null;
}

const MapPage = () => {
    const { toast } = useToast();
    const { token } = useAuth();
    const geo = useGeolocation();
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);

    const [officers, setOfficers] = useState<Officer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
    const [flyZoom, setFlyZoom] = useState(13);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Toggle for mobile/desktop

    const listRefs = useRef<Record<number, HTMLDivElement | null>>({});

    const [searchParams] = useSearchParams();
    const officerUsername = searchParams.get("username");

    // Fetch Officers
    useEffect(() => {
        let cancelled = false;
        const fetchOfficers = async () => {
            try {
                setLoading(true);
                const data = await mapApi.getOfficers();
                if (!cancelled) setOfficers(data);
            } catch (err: any) {
                if (!cancelled) {
                    const msg = err?.message || "Failed to load officers";
                    setError(msg);
                    toast({
                        title: "Error",
                        description: msg,
                        variant: "destructive",
                    });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (token) fetchOfficers();
        return () => {
            cancelled = true;
        };
    }, [token, toast]);

    // Sort & Filter
    const sortedOfficers: OfficerWithDistance[] = useMemo(() => {
        let filtered = officers;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (o) =>
                    o.username.toLowerCase().includes(q) ||
                    o.email.toLowerCase().includes(q)
            );
        }

        const withDist = filtered.map((o) => ({
            ...o,
            distance:
                geo.latitude != null && geo.longitude != null
                    ? haversineKm(geo.latitude, geo.longitude, o.latitude, o.longitude)
                    : null,
        }));

        if (geo.latitude != null && geo.longitude != null) {
            withDist.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        } else {
            withDist.sort((a, b) => a.username.localeCompare(b.username));
        }
        return withDist;
    }, [officers, geo.latitude, geo.longitude, searchQuery]);

    const selectedOfficer = useMemo(
        () => officers.find((o) => o.id === selectedId) || null,
        [officers, selectedId]
    );

    const handleMapLocated = useCallback((lat: number, lng: number) => {
        setUserLat(lat);
        setUserLng(lng);
    }, []);

    // Also sync geo hook results into userLat/userLng
    useEffect(() => {
        if (geo.latitude != null && geo.longitude != null) {
            setUserLat(geo.latitude);
            setUserLng(geo.longitude);
        }
    }, [geo.latitude, geo.longitude]);

    const handleSelect = useCallback(
        (officer: OfficerWithDistance) => {
            setSelectedId(officer.id);
            setFlyTarget([officer.latitude, officer.longitude]);
            setFlyZoom(15);

            const el = listRefs.current[officer.id];
            if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        },
        []
    );

    // ✅ Deep link handler
    useEffect(() => {
        if (officerUsername && sortedOfficers.length > 0 && !selectedId) {
            const found = sortedOfficers.find(o => o.username.toLowerCase() === officerUsername.toLowerCase());
            if (found) {
                handleSelect(found);
            }
        }
    }, [sortedOfficers, officerUsername, selectedId, handleSelect]);

    const openDirections = useCallback(
        (officer: Officer) => {
            let url: string;
            if (geo.latitude != null && geo.longitude != null) {
                url = `https://www.google.com/maps/dir/?api=1&origin=${geo.latitude},${geo.longitude}&destination=${officer.latitude},${officer.longitude}`;
            } else {
                url = `https://www.google.com/maps/dir/?api=1&destination=${officer.latitude},${officer.longitude}`;
            }
            window.open(url, "_blank", "noopener");
        },
        [geo.latitude, geo.longitude]
    );

    const mapCenter: [number, number] = useMemo(() => {
        if (geo.latitude != null && geo.longitude != null)
            return [geo.latitude, geo.longitude];
        return [23.8103, 90.4125]; // Dhaka default
    }, [geo.latitude, geo.longitude]);

    // Helper to clear selection
    const clearSelection = () => {
        setSelectedId(null);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden flex flex-col">
            {/* ─── Map Background ─── */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={mapCenter}
                    zoom={8}
                    className="h-full w-full"
                    zoomControl={false} // We can add custom zoom control if needed, or let user scroll
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FlyToPosition position={flyTarget} zoom={flyZoom} />
                    <MyLocationControl onLocated={handleMapLocated} />

                    {/* Blue pulsing dot for user's location */}
                    {userLat != null && userLng != null && (
                        <>
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
                            <CircleMarker
                                center={[userLat, userLng]}
                                radius={7}
                                pathOptions={{
                                    color: "white",
                                    fillColor: "#4285F4",
                                    fillOpacity: 1,
                                    weight: 2,
                                }}
                            >
                                <Popup>You are here</Popup>
                            </CircleMarker>
                        </>
                    )}

                    {/* Officers */}
                    {sortedOfficers.map((officer) => (
                        <Marker
                            key={officer.id}
                            position={[officer.latitude, officer.longitude]}
                            icon={selectedId === officer.id ? selectedOfficerIcon : officerIcon}
                            eventHandlers={{
                                click: () => handleSelect(officer),
                            }}
                        />
                    ))}
                </MapContainer>
            </div>

            {/* ─── Floating Sidebar (Desktop: Left, Mobile: Bottom Sheet-ish) ─── */}
            <div
                className={`absolute z-10 
          top-0 left-0 bottom-0 w-full sm:w-[400px] 
          transition-transform duration-300 ease-in-out
          p-4 pointer-events-none 
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full sm:-translate-x-[calc(100%+1rem)]"}
        `}
            >
                <div className="h-full flex flex-col gap-4 pointer-events-auto">
                    {/* Search / Toggle Bar */}
                    <Card className="p-2 flex items-center gap-2 shadow-xl bg-background/95 backdrop-blur border-border/50">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search officers..."
                                className="pl-9 bg-transparent border-0 focus-visible:ring-0 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </Card>

                    {/* List or Details Card */}
                    <Card className="flex-1 overflow-hidden shadow-xl bg-background/95 backdrop-blur border-border/50 flex flex-col">
                        {selectedId && selectedOfficer ? (
                            // ─── Detail View ───
                            <div className="flex flex-col h-full animate-fade-in">
                                {/* Header with Back button */}
                                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-primary/5">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
                                        onClick={clearSelection}
                                    >
                                        <ArrowRight className="h-4 w-4 rotate-180" />
                                        Back to list
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelection}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                                    <div className="text-center">
                                        <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary mb-3">
                                            {selectedOfficer.username.charAt(0).toUpperCase()}
                                        </div>
                                        <h2 className="text-xl font-bold">{selectedOfficer.username}</h2>
                                        <p className="text-sm text-muted-foreground">Govt. Agricultural Officer</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                            <Mail className="h-5 w-5 text-primary mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground uppercase">Email</p>
                                                <p className="text-sm break-all">{selectedOfficer.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                            <MapPin className="h-5 w-5 text-primary mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground uppercase">Location</p>
                                                <p className="text-sm">
                                                    {selectedOfficer.latitude.toFixed(5)}, {selectedOfficer.longitude.toFixed(5)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Distance calc locally if needed or just show directions */}
                                    </div>
                                </div>

                                <div className="p-4 border-t border-border/50 bg-muted/20">
                                    <Button className="w-full gap-2 text-base h-11" onClick={() => openDirections(selectedOfficer)}>
                                        <Navigation className="h-5 w-5" />
                                        Get Directions
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            // ─── List View ───
                            <div className="flex flex-col h-full">
                                {/* List Header */}
                                <div className="p-3 border-b border-border/50 bg-muted/20 flex justify-between items-center text-xs font-medium text-muted-foreground">
                                    <span>NEARBY OFFICERS</span>
                                    {geo.latitude && <span>{sortedOfficers.length} RESULTS</span>}
                                </div>

                                <ScrollArea className="flex-1">
                                    <div className="divide-y divide-border/30">
                                        {sortedOfficers.map((officer) => (
                                            <div
                                                key={officer.id}
                                                ref={(el) => (listRefs.current[officer.id] = el)}
                                                onClick={() => handleSelect(officer)}
                                                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-center gap-4 group"
                                            >
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 shadow-sm border border-primary/20">
                                                    {officer.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">{officer.username}</h4>
                                                    <p className="text-xs text-muted-foreground truncate">{officer.email}</p>
                                                    {officer.distance != null && (
                                                        <p className="text-xs font-medium text-emerald-600 mt-0.5 flex items-center gap-1">
                                                            <Navigation className="h-3 w-3" />
                                                            {officer.distance < 1
                                                                ? `${(officer.distance * 1000).toFixed(0)} m`
                                                                : `${officer.distance.toFixed(1)} km`}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {sortedOfficers.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground">
                                                <p className="text-sm">No officers found matching "{searchQuery}"</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* ─── Re-open Sidebar Button (when closed) ─── */}
            {!isSidebarOpen && (
                <div className="absolute top-4 left-4 z-10">
                    <Button
                        className="shadow-xl h-10 w-10 rounded-full"
                        size="icon"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </div>
            )}

            {/* ─── Mobile Bottom Sheet Overlay (optional fallback) ─── */}
            {/* (In this floating design, the sidebar IS the mobile sheet essentially, checking responsiveness) */}
            {/* On mobile, standard map design is search bar top, list bottom. 
          The above floating sidebar handles desktop well. 
          For mobile, we might want to adjust the floating div classes slightly. 
          Let's verify the classes: `top-0 left-0 bottom-0 w-full` means it covers the map on mobile if open. 
          That's actually fine for "Google Maps List View". 
          The user can toggle it closed to see the map. 
      */}
        </div>
    );
};

export default MapPage;
