package com.example.agriverse.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "images")
public class Image {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;       // "tomato_disease.jpg"
    private String type;       // "image/jpeg"
    private String uploadedBy; // "FarmerJohn"

    @Lob // Tells database this is a Large Object (BLOB)
    @Column(nullable = false) // Needed for MySQL (Postgres uses OID or bytea)
    private byte[] imageData;

    private LocalDateTime uploadDate;

    @PrePersist
    public void onCreate() {
        this.uploadDate = LocalDateTime.now();
    }
}
