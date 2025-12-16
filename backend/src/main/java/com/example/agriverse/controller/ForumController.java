package com.example.agriverse.controller;

import com.example.agriverse.dto.ForumPostRequest;
import com.example.agriverse.dto.SigninRequest;
import com.example.agriverse.dto.SignupRequest;
import com.example.agriverse.model.Forum;
import com.example.agriverse.model.Role;
import com.example.agriverse.model.User;
import com.example.agriverse.repository.ForumRepository;
import com.example.agriverse.repository.RoleRepository;
import com.example.agriverse.repository.UserRepository;
import com.example.agriverse.security.AuthEntryPointJwt;
import com.example.agriverse.security.JwtUtil;
import com.example.agriverse.service.ForumService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/forum")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173") // frontend URL
public class ForumController {

    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthEntryPointJwt authEntryPointJwt;

    private final ForumRepository forumRepo;

    private final ForumService forumService;

    @GetMapping("/")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> showAll() {
        return ResponseEntity.ok(forumService.findAll());
    }

    @GetMapping("/{title}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> findByTitle(@PathVariable String title) {
        return ResponseEntity.ok(forumService.findByTitle(title));
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<?> findAll() {
        return ResponseEntity.ok(forumService.findAll());
    }

    @PostMapping("/post")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Forum> createForumPost(@Valid @RequestBody ForumPostRequest request) {
        Forum createdPost = forumService.createPost(request);
        return new ResponseEntity<>(createdPost, HttpStatus.CREATED);
    }

}
