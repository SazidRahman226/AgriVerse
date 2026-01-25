package com.example.agriverse.controller;

import com.example.agriverse.model.Image;
import com.example.agriverse.model.Role;
import com.example.agriverse.repository.ImageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/images")
@CrossOrigin(origins = "http://localhost:5173") // Allow your frontend
public class ImageController {

    @Autowired
    private ImageRepository imageRepository;
    // @PreAuthorize ensures only logged-in users can access this
    @PreAuthorize("hasRole('USER')")
    @PostMapping("/upload")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file, Authentication authentication) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("No image captured");
        }

        // Get the username of the person uploading
        String username = authentication.getName();

        try {
            Image image = new Image();
            image.setName(file.getOriginalFilename());
            image.setType(file.getContentType());
            image.setUploadedBy(authentication.getName());

            // CONVERT FILE TO BYTES FOR POSTGRES
            image.setImageData(file.getBytes());

            imageRepository.save(image);

            return ResponseEntity.ok(Map.of(
                    "message", "Image saved to PostgreSQL successfully!",
                    "id", image.getId()
            ));

        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Error processing file");
        }

    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getImage(@PathVariable Long id) {
        // 1. Find the image in DB
        Image image = imageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Image not found"));

        // 2. Return the raw bytes with the correct "Content-Type" header
        // This tells the browser: "Don't download this text, render it as an image!"
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf(image.getType())) // e.g., image/jpeg
                .body(image.getImageData());
    }
}