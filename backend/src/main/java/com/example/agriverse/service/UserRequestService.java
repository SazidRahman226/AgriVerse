package com.example.agriverse.service;

import com.example.agriverse.dto.SendUserRequestMessageRequest;
import com.example.agriverse.dto.UserInfo;
import com.example.agriverse.dto.UserRequestMessageResponse;
import com.example.agriverse.dto.UserRequestResponse;
import com.example.agriverse.model.*;
import com.example.agriverse.repository.UserRepository;
import com.example.agriverse.repository.UserRequestMessageRepository;
import com.example.agriverse.repository.UserRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserRequestService {

    private final UserRequestRepository requestRepo;
    private final UserRequestMessageRepository messageRepo;
    private final UserRepository userRepo;
    private final FileStorageService fileStorageService;

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null)
            throw new RuntimeException("Unauthorized");
        return userRepo.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private boolean hasRole(User user, String roleName) {
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> roleName.equals(r.getName()));
    }

    private void ensureParticipant(User user, UserRequest req) {
        boolean isCreator = req.getCreatedBy().getUsername().equals(user.getUsername());
        boolean isOfficer = req.getAssignedOfficer() != null
                && req.getAssignedOfficer().getUsername().equals(user.getUsername());
        boolean isAdmin = hasRole(user, "ROLE_ADMIN");

        boolean isGovtOfficer = hasRole(user, "ROLE_GOVT_OFFICER");
        boolean canPreviewQueue = isGovtOfficer
                && req.getStatus() == RequestStatus.OPEN
                && req.getAssignedOfficer() == null;

        if (!(isCreator || isOfficer || isAdmin || canPreviewQueue)) {
            throw new RuntimeException("Forbidden");
        }
    }

    // ✅ NEW: build UserInfo for API response
    private UserInfo toUserInfo(User u, boolean includeIdentificationNumber) {
        if (u == null)
            return null;

        return new UserInfo(
                u.getUsername(),
                u.getEmail(),
                includeIdentificationNumber ? u.getIdentificationNumber() : null,
                u.getRoles().stream()
                        .map(Role::getName)
                        .collect(Collectors.toSet()));
    }

    // ✅ Create request with photos + description (status starts OPEN)
    public UserRequestResponse createRequestWithPhoto(
            String category,
            String description,
            String upazilla,
            String district,
            List<MultipartFile> images) {
        User creator = currentUser();

        List<String> imageUrls = fileStorageService.saveImages(images);

        // Start OPEN and unassigned (queue based)
        UserRequest saved = requestRepo.save(
                UserRequest.builder()
                        .createdBy(creator)
                        .assignedOfficer(null)
                        .category(category)
                        .description(description)
                        .imageUrls(new ArrayList<>(imageUrls))
                        .upazilla(upazilla)
                        .district(district)
                        .status(RequestStatus.OPEN)
                        .build());

        // optional: save the description as first chat message for better UX
        if (description != null && !description.isBlank()) {
            messageRepo.save(UserRequestMessage.builder()
                    .request(saved)
                    .sender(creator)
                    .message(description.trim())
                    .build());
        }

        return toResponse(saved, creator);
    }

    // ✅ Create request and assign to the nearest Govt Officer by Haversine distance
    public UserRequestResponse createRequestForNearestOfficer(
            String category,
            String description,
            String upazilla,
            String district,
            List<MultipartFile> images) {
        User creator = currentUser();

        // Validate that the user has a saved location
        if (creator.getLatitude() == null || creator.getLongitude() == null) {
            throw new RuntimeException("Your location is not set. Please update your location first.");
        }

        // Find the nearest officer
        List<User> officers = userRepo
                .findByRoles_NameAndLatitudeIsNotNullAndLongitudeIsNotNull("ROLE_GOVT_OFFICER");

        if (officers.isEmpty()) {
            throw new RuntimeException("No officers with location data available.");
        }

        User nearest = null;
        double minDist = Double.MAX_VALUE;
        for (User officer : officers) {
            double dist = haversineKm(
                    creator.getLatitude(), creator.getLongitude(),
                    officer.getLatitude(), officer.getLongitude());
            if (dist < minDist) {
                minDist = dist;
                nearest = officer;
            }
        }

        List<String> imageUrls = fileStorageService.saveImages(images);

        UserRequest saved = requestRepo.save(
                UserRequest.builder()
                        .createdBy(creator)
                        .assignedOfficer(nearest) // pre-assigned to closest officer
                        .category(category)
                        .description(description)
                        .imageUrls(new ArrayList<>(imageUrls))
                        .upazilla(upazilla)
                        .district(district)
                        .status(RequestStatus.OPEN)
                        .build());

        if (description != null && !description.isBlank()) {
            messageRepo.save(UserRequestMessage.builder()
                    .request(saved)
                    .sender(creator)
                    .message(description.trim())
                    .build());
        }

        return toResponse(saved, creator);
    }

    /**
     * Haversine formula — returns distance in kilometres between two lat/lng
     * points.
     */
    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0; // Earth's radius in km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                        * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ✅ Get request by id (for chat UI)
    public UserRequestResponse getRequest(Long id) {
        User u = currentUser();
        UserRequest req = requestRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        ensureParticipant(u, req);
        return toResponse(req, u);
    }

    // user's own requests (all)
    public Page<UserRequestResponse> myRequests(int page, int size) {
        User creator = currentUser();
        return requestRepo.findByCreatedByUsername(
                creator.getUsername(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(r -> toResponse(r, creator));
    }

    public Page<UserRequestResponse> myArchived(int page, int size) {
        User creator = currentUser();
        return requestRepo.findByCreatedByUsernameAndStatus(
                creator.getUsername(),
                RequestStatus.ARCHIVED,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "archivedAt")))
                .map(r -> toResponse(r, creator));
    }

    // ✅ Officer queue: OPEN + unassigned
    public Page<UserRequestResponse> officerQueue(int page, int size) {
        User officer = currentUser();
        if (!hasRole(officer, "ROLE_GOVT_OFFICER") && !hasRole(officer, "ROLE_ADMIN")) {
            throw new RuntimeException("Forbidden");
        }

        return requestRepo.findByStatusAndAssignedOfficerIsNull(
                RequestStatus.OPEN,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(r -> toResponse(r, officer));
    }

    // ✅ Officer assigned (NOT archived)
    public Page<UserRequestResponse> officerAssigned(int page, int size) {
        User officer = currentUser();
        if (!hasRole(officer, "ROLE_GOVT_OFFICER") && !hasRole(officer, "ROLE_ADMIN")) {
            throw new RuntimeException("Forbidden");
        }

        return requestRepo.findByAssignedOfficerUsernameAndStatusNot(
                officer.getUsername(),
                RequestStatus.ARCHIVED,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "takenAt")))
                .map(r -> toResponse(r, officer));
    }

    public Page<UserRequestResponse> officerArchived(int page, int size) {
        User officer = currentUser();
        if (!hasRole(officer, "ROLE_GOVT_OFFICER") && !hasRole(officer, "ROLE_ADMIN")) {
            throw new RuntimeException("Forbidden");
        }

        return requestRepo.findByAssignedOfficerUsernameAndStatus(
                officer.getUsername(),
                RequestStatus.ARCHIVED,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "archivedAt")))
                .map(r -> toResponse(r, officer));
    }

    // ✅ Take request: OPEN -> IN_PROGRESS, assignedOfficer = current officer
    public UserRequestResponse takeRequest(Long requestId) {
        User officer = currentUser();

        if (!hasRole(officer, "ROLE_GOVT_OFFICER") && !hasRole(officer, "ROLE_ADMIN")) {
            throw new RuntimeException("Forbidden");
        }

        UserRequest req = requestRepo.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        // idempotent behavior: if already in progress and assigned to me -> return
        if (req.getStatus() == RequestStatus.IN_PROGRESS
                && req.getAssignedOfficer() != null
                && req.getAssignedOfficer().getUsername().equals(officer.getUsername())) {
            return toResponse(req, officer);
        }

        if (req.getStatus() != RequestStatus.OPEN) {
            throw new RuntimeException("Request is not open");
        }

        // If already assigned (forwarded to a specific officer), only that officer can
        // take it.
        if (req.getAssignedOfficer() != null
                && !req.getAssignedOfficer().getUsername().equals(officer.getUsername())
                && !hasRole(officer, "ROLE_ADMIN")) {
            throw new RuntimeException("Request is assigned to another officer");
        }

        req.setAssignedOfficer(officer);
        req.setStatus(RequestStatus.IN_PROGRESS);
        req.setTakenAt(Instant.now());

        return toResponse(requestRepo.save(req), officer);
    }

    // ✅ Forward: IN_PROGRESS -> OPEN, assignedOfficer = target officer, takenAt
    // cleared
    public UserRequestResponse forwardRequest(Long requestId, String toOfficerUsername) {
        User actor = currentUser();

        if (!hasRole(actor, "ROLE_GOVT_OFFICER") && !hasRole(actor, "ROLE_ADMIN")) {
            throw new RuntimeException("Forbidden");
        }

        UserRequest req = requestRepo.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (req.getStatus() == RequestStatus.ARCHIVED) {
            throw new RuntimeException("Cannot forward archived request");
        }

        if (req.getStatus() != RequestStatus.IN_PROGRESS) {
            throw new RuntimeException("Only in-progress requests can be forwarded");
        }

        boolean isAssignedOfficer = req.getAssignedOfficer() != null
                && req.getAssignedOfficer().getUsername().equals(actor.getUsername());

        if (!hasRole(actor, "ROLE_ADMIN") && !isAssignedOfficer) {
            throw new RuntimeException("Only the assigned officer can forward");
        }

        if (toOfficerUsername == null || toOfficerUsername.trim().isBlank()) {
            throw new RuntimeException("toOfficerUsername is required");
        }

        String targetUsername = toOfficerUsername.trim();
        if (req.getAssignedOfficer() != null && targetUsername.equals(req.getAssignedOfficer().getUsername())) {
            throw new RuntimeException("Already assigned to that officer");
        }
        if (targetUsername.equals(actor.getUsername())) {
            throw new RuntimeException("Cannot forward to yourself");
        }

        User target = userRepo.findByUsername(targetUsername)
                .orElseThrow(() -> new RuntimeException("Target officer not found"));

        if (!hasRole(target, "ROLE_GOVT_OFFICER") && !hasRole(target, "ROLE_ADMIN")) {
            throw new RuntimeException("Target user is not a govt officer");
        }

        req.setAssignedOfficer(target);
        req.setStatus(RequestStatus.OPEN);
        req.setTakenAt(null);

        return toResponse(requestRepo.save(req), actor);
    }

    // ✅ Chat: list messages
    public Page<UserRequestMessageResponse> getMessages(Long requestId, int page, int size) {
        User u = currentUser();
        UserRequest req = requestRepo.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        ensureParticipant(u, req);

        return messageRepo.findByRequestIdOrderByCreatedAtAsc(
                requestId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "createdAt")))
                .map(m -> UserRequestMessageResponse.builder()
                        .id(m.getId())
                        .requestId(requestId)
                        .senderUsername(m.getSender().getUsername())
                        .senderRole(m.getSender().getRoles().stream().findFirst().map(Role::getName).orElse(null))
                        .message(m.getMessage())
                        .createdAt(m.getCreatedAt())
                        .build());
    }

    // ✅ Chat: send message
    public UserRequestMessageResponse sendMessage(Long requestId, SendUserRequestMessageRequest body) {
        User sender = currentUser();
        UserRequest req = requestRepo.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        ensureParticipant(sender, req);

        if (req.getStatus() == RequestStatus.ARCHIVED) {
            throw new RuntimeException("Chat is archived");
        }

        boolean isCreator = req.getCreatedBy().getUsername().equals(sender.getUsername());
        boolean isOfficer = req.getAssignedOfficer() != null
                && req.getAssignedOfficer().getUsername().equals(sender.getUsername());
        boolean isAdmin = hasRole(sender, "ROLE_ADMIN");
        boolean isGovtOfficer = hasRole(sender, "ROLE_GOVT_OFFICER");

        // ✅ creator can chat while OPEN or IN_PROGRESS
        // ✅ officer can chat only when IN_PROGRESS (after take)
        if (req.getStatus() == RequestStatus.OPEN) {
            if (isGovtOfficer && !isAdmin) {
                throw new RuntimeException("Request is open. Govt officer must take it first.");
            }
            if (!isCreator && !isAdmin) {
                throw new RuntimeException("Forbidden");
            }
        } else if (req.getStatus() == RequestStatus.IN_PROGRESS) {
            if (!(isCreator || isOfficer || isAdmin)) {
                throw new RuntimeException("Forbidden");
            }
        }

        if (body == null || body.getMessage() == null || body.getMessage().trim().isBlank()) {
            throw new RuntimeException("Message is required");
        }

        UserRequestMessage saved = messageRepo.save(
                UserRequestMessage.builder()
                        .request(req)
                        .sender(sender)
                        .message(body.getMessage().trim())
                        .build());

        return UserRequestMessageResponse.builder()
                .id(saved.getId())
                .requestId(requestId)
                .senderUsername(sender.getUsername())
                .senderRole(sender.getRoles().stream().findFirst().map(Role::getName).orElse(null))
                .message(saved.getMessage())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    // ✅ Archive (locks chat)
    public UserRequestResponse archiveRequest(Long requestId) {
        User actor = currentUser();
        UserRequest req = requestRepo.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        boolean canArchive = hasRole(actor, "ROLE_ADMIN")
                || (req.getAssignedOfficer() != null
                        && req.getAssignedOfficer().getUsername().equals(actor.getUsername()));

        if (!canArchive)
            throw new RuntimeException("Forbidden");

        req.setStatus(RequestStatus.ARCHIVED);
        req.setArchivedAt(Instant.now());

        return toResponse(requestRepo.save(req), actor);
    }

    // ✅ UPDATED: viewer-aware response (adds createdBy/assignedOfficer objects)
    private UserRequestResponse toResponse(UserRequest r, User viewer) {
        String officerUsername = null;
        String officerIdNo = null;

        UserInfo createdByInfo = toUserInfo(r.getCreatedBy(), false);
        UserInfo officerInfo = null;

        if (r.getAssignedOfficer() != null) {
            officerUsername = r.getAssignedOfficer().getUsername();

            // only govt officer/admin can see officer identification number
            boolean canSeeOfficerId = hasRole(viewer, "ROLE_GOVT_OFFICER") || hasRole(viewer, "ROLE_ADMIN");
            officerIdNo = canSeeOfficerId ? r.getAssignedOfficer().getIdentificationNumber() : null;

            officerInfo = toUserInfo(r.getAssignedOfficer(), canSeeOfficerId);
        }

        return UserRequestResponse.builder()
                .id(r.getId())
                .createdByUsername(r.getCreatedBy().getUsername())
                .assignedOfficerUsername(officerUsername)
                .assignedOfficerIdentificationNumber(officerIdNo)
                .category(r.getCategory())
                .description(r.getDescription())
                .imageUrls(r.getImageUrls())
                .imageUrl(r.getImageUrl()) // backward compat: first image
                .state(r.getUpazilla())
                .district(r.getDistrict())
                .status(r.getStatus())
                .createdAt(r.getCreatedAt())
                .takenAt(r.getTakenAt())
                .archivedAt(r.getArchivedAt())
                .createdBy(createdByInfo)
                .assignedOfficer(officerInfo)
                .build();
    }
}
