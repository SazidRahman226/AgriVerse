package com.example.agriverse.controller;

import com.example.agriverse.dto.OfficerLocationResponse;
import com.example.agriverse.dto.UpdateLocationRequest;
import com.example.agriverse.service.MapService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class MapController {

    private final MapService mapService;

    /**
     * GET /api/map/officers
     * Returns all Govt Officers with valid geographic coordinates.
     * Accessible to any authenticated user.
     */
    @PreAuthorize("hasAnyRole('USER', 'GOVT_OFFICER', 'ADMIN')")
    @GetMapping("/officers")
    public ResponseEntity<List<OfficerLocationResponse>> getOfficerLocations() {
        return ResponseEntity.ok(mapService.getOfficerLocations());
    }

    /**
     * PUT /api/map/officers/{id}/location
     * Update an officer's latitude/longitude.
     * Accessible to ADMIN (any officer) or GOVT_OFFICER (self only).
     */
    @PreAuthorize("hasAnyRole('GOVT_OFFICER', 'ADMIN')")
    @PutMapping("/officers/{id}/location")
    public ResponseEntity<OfficerLocationResponse> updateOfficerLocation(
            @PathVariable Long id,
            @Valid @RequestBody UpdateLocationRequest request,
            Authentication authentication) {

        String currentUsername = authentication.getName();
        boolean isAdmin = authentication.getAuthorities()
                .contains(new SimpleGrantedAuthority("ROLE_ADMIN"));

        OfficerLocationResponse updated = mapService.updateOfficerLocation(
                id, request, currentUsername, isAdmin);

        return ResponseEntity.ok(updated);
    }

    /**
     * PUT /api/map/my-location
     * Update the currently logged-in user's own location.
     * Accessible to any authenticated user (USER, GOVT_OFFICER, ADMIN).
     */
    @PreAuthorize("hasAnyRole('USER', 'GOVT_OFFICER', 'ADMIN')")
    @PutMapping("/my-location")
    public ResponseEntity<OfficerLocationResponse> updateMyLocation(
            @Valid @RequestBody UpdateLocationRequest request,
            Authentication authentication) {

        String currentUsername = authentication.getName();
        OfficerLocationResponse updated = mapService.updateMyLocation(currentUsername, request);
        return ResponseEntity.ok(updated);
    }
}
