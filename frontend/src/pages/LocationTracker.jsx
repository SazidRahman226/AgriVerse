import React, { useState } from 'react';
import apiClient from "@/api/client";

const LocationTracker = ({ token }) => {
    const [status, setStatus] = useState("Idle");
    const [district, setDistrict] = useState("");

    const getLocationAndDistrict = () => {
        if (!navigator.geolocation) {
            setStatus("Geolocation not supported");
            return;
        }

        setStatus("Locating...");

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                setStatus("Found Coordinates! Fetching District...");

                // 1. Call the Reverse Geocoding API
                await fetchDistrictName(lat, lng);
            },
            (error) => {
                setStatus("Error: " + error.message);
            }
        );
    };

    // The Function to translate Coords -> Name
    const fetchDistrictName = async (lat, lng) => {
        try {
            // Using OpenStreetMap (Nominatim) - Free & No Key needed
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
            
            const response = await fetch(url);
            const data = await response.json();

            console.log("Full Address Data:", data); // Check console to see full details

            // Extract the district (Note: Different countries map this differently)
            // Usually 'state_district', 'county', or 'city'
            const detectedDistrict = data.address.state_district || data.address.city || data.address.county;
            
            setDistrict(detectedDistrict);
            setStatus(`Located in: ${detectedDistrict}`);

            // Now you can send this string to your backend!
            sendToBackend(detectedDistrict, lat, lng);

        } catch (error) {
            console.error("Geocoding failed:", error);
            setStatus("Could not find district name.");
        }
    };

    const sendToBackend = async (districtName, lat, lng) => {
        try {
            setStatus("Sending location to server...");

            await apiClient.post('/api/location/update', {
                latitude: lat,
                longitude: lng,
            });

            setStatus("Location sent to server.");
        } catch (err) {
            console.error("Failed to send location:", err);
            setStatus("Failed to send location to server.");
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h3>📍 Location Service</h3>
            <p>Status: {status}</p>
            {district && <h2>Current District: {district}</h2>}
            <button onClick={getLocationAndDistrict}>Find My District</button>
        </div>
    );
};

export default LocationTracker;