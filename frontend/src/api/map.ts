import apiClient from "./client";

export interface Officer {
    id: number;
    username: string;
    email: string;
    latitude: number;
    longitude: number;
}

export interface UpdateLocationRequest {
    latitude: number;
    longitude: number;
}

export interface LocationValidationError {
    timestamp: string;
    status: number;
    errors: Record<string, string>;
}

export interface MyLocationResponse {
    id: number;
    username: string;
    email: string;
    latitude: number;
    longitude: number;
}

export const mapApi = {
    /** Fetch all officers with non-null coordinates */
    getOfficers: async (): Promise<Officer[]> => {
        const response = await apiClient.get<Officer[]>("/api/map/officers");
        return response.data;
    },

    /** Update an officer's location (officer can only update their own) */
    updateOfficerLocation: async (
        id: number,
        data: UpdateLocationRequest
    ): Promise<Officer> => {
        const response = await apiClient.put<Officer>(
            `/api/map/officers/${id}/location`,
            data
        );
        return response.data;
    },

    /** Update the current user's location */
    updateMyLocation: async (
        data: UpdateLocationRequest
    ): Promise<MyLocationResponse> => {
        const response = await apiClient.put<MyLocationResponse>(
            "/api/map/my-location",
            data
        );
        return response.data;
    },
};

export default mapApi;
