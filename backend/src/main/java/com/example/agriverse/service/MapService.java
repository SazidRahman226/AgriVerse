package com.example.agriverse.service;

import com.example.agriverse.dto.OfficerLocationResponse;
import com.example.agriverse.dto.UpdateLocationRequest;
import com.example.agriverse.model.User;
import com.example.agriverse.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MapService {

    private final UserRepository userRepository;

    /**
     * Returns all Govt Officers who have valid (non-null) latitude and longitude.
     */
    public List<OfficerLocationResponse> getOfficerLocations() {
        return userRepository
                .findByRoles_NameAndLatitudeIsNotNullAndLongitudeIsNotNull("ROLE_GOVT_OFFICER")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Updates an officer's location.
     * Allowed for ADMIN (any officer) or the officer themselves.
     */
    public OfficerLocationResponse updateOfficerLocation(Long officerId,
            UpdateLocationRequest request,
            String currentUsername,
            boolean isAdmin) {
        User officer = userRepository.findById(officerId)
                .orElseThrow(() -> new RuntimeException("Officer not found with id: " + officerId));

        // Verify the target user is actually a Govt Officer
        boolean isGovtOfficer = officer.getRoles().stream()
                .anyMatch(r -> r.getName().equals("ROLE_GOVT_OFFICER"));
        if (!isGovtOfficer) {
            throw new RuntimeException("User with id " + officerId + " is not a Govt Officer");
        }

        // Authorization: admin can update any officer; officers can only update
        // themselves
        if (!isAdmin && !officer.getUsername().equals(currentUsername)) {
            throw new AccessDeniedException("You can only update your own location");
        }

        officer.setLatitude(request.getLatitude());
        officer.setLongitude(request.getLongitude());
        userRepository.save(officer);

        return toResponse(officer);
    }

    /**
     * Updates the currently logged-in user's own location.
     */
    public OfficerLocationResponse updateMyLocation(String currentUsername,
            UpdateLocationRequest request) {
        User user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new RuntimeException("User not found: " + currentUsername));

        user.setLatitude(request.getLatitude());
        user.setLongitude(request.getLongitude());
        userRepository.save(user);

        return toResponse(user);
    }

    private OfficerLocationResponse toResponse(User user) {
        return new OfficerLocationResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getLatitude(),
                user.getLongitude());
    }
}
