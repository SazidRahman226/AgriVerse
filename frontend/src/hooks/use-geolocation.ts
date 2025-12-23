import { useState, useEffect } from "react";

interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    error: string | null;
    loading: boolean;
}

/**
 * Custom hook to get the user's current browser geolocation.
 * Non-blocking: returns null coordinates if denied/unavailable.
 */
export function useGeolocation(): GeolocationState {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        error: null,
        loading: true,
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setState({
                latitude: null,
                longitude: null,
                error: "Geolocation is not supported by this browser.",
                loading: false,
            });
            return;
        }

        const timeoutId = setTimeout(() => {
            // If geolocation takes too long, stop waiting
            setState((prev) =>
                prev.loading
                    ? { ...prev, loading: false, error: "Geolocation timed out" }
                    : prev
            );
        }, 8000);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                clearTimeout(timeoutId);
                setState({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    error: null,
                    loading: false,
                });
            },
            (err) => {
                clearTimeout(timeoutId);
                setState({
                    latitude: null,
                    longitude: null,
                    error: err.message,
                    loading: false,
                });
            },
            {
                enableHighAccuracy: false,
                timeout: 7000,
                maximumAge: 300000, // 5 min cache
            }
        );

        return () => clearTimeout(timeoutId);
    }, []);

    return state;
}

/**
 * One-shot geolocation grab (Promise-based).
 * Resolves with coords or null (never rejects).
 */
export function getGeolocationOnce(
    timeoutMs = 5000
): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        const timer = setTimeout(() => resolve(null), timeoutMs);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timer);
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                });
            },
            () => {
                clearTimeout(timer);
                resolve(null);
            },
            { enableHighAccuracy: false, timeout: timeoutMs - 500, maximumAge: 300000 }
        );
    });
}
