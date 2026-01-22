package com.example.agriverse.dto;

import com.example.agriverse.model.RequestStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
public class UserRequestResponse {
    private Long id;

    private String createdByUsername;

    private String category;
    private String description;

    // ✅ Multi-image: full list
    private List<String> imageUrls;
    // ✅ Backward compat: first image
    private String imageUrl;

    private String state;
    private String district;

    private RequestStatus status;

    private Instant createdAt;
    private Instant takenAt;
    private Instant archivedAt;

    private String assignedOfficerUsername;
    private String assignedOfficerIdentificationNumber;

    // Structured user details for chat UI
    private UserInfo createdBy;
    private UserInfo assignedOfficer;
}
