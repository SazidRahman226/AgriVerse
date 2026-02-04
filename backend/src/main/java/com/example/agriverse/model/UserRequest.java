package com.example.agriverse.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "user_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_request_seq_gen")
    @SequenceGenerator(name = "user_request_seq_gen", sequenceName = "user_request_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_officer_user_id")
    private User assignedOfficer;

    @Column(nullable = false, length = 120)
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    // ✅ Multi-image support: replaces the old single imageUrl field
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_request_image_urls", joinColumns = @JoinColumn(name = "user_request_id"))
    @Column(name = "image_url", length = 500)
    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    @Column(length = 80)
    private String upazilla;

    @Column(length = 80)
    private String district;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant takenAt;
    private Instant archivedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        if (status == null)
            status = RequestStatus.OPEN;
    }

    /**
     * Backward-compat helper: returns the first image URL, or null.
     */
    @Transient
    public String getImageUrl() {
        return (imageUrls != null && !imageUrls.isEmpty()) ? imageUrls.get(0) : null;
    }
}
