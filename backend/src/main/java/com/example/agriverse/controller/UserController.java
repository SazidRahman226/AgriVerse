package com.example.agriverse.controller;

import com.example.agriverse.dto.SigninRequest;
import com.example.agriverse.dto.SignupRequest;
import com.example.agriverse.model.Role;
import com.example.agriverse.model.User;
import com.example.agriverse.repository.RoleRepository;
import com.example.agriverse.repository.UserRepository;
import com.example.agriverse.security.AuthEntryPointJwt;
import com.example.agriverse.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173") // frontend URL
public class UserController {

    private final UserRepository userRepo;
    private final RoleRepository roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthEntryPointJwt authEntryPointJwt;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody SignupRequest signupRequest) {

        if (userRepo.existsByUsername(signupRequest.getUsername())) {
            return ResponseEntity.badRequest().body("Username already exists!");
        }
        if (userRepo.existsByEmail(signupRequest.getEmail())) {
            return ResponseEntity.badRequest().body("Email already exists!");
        }

        Role userRole = roleRepo.findByName("ROLE_USER").orElseThrow();

        User user = new User();
        user.setUsername(signupRequest.getUsername());
        user.setPassword(passwordEncoder.encode(signupRequest.getPassword()));
        user.setEmail(signupRequest.getEmail());
        user.setRoles(Set.of(userRole));

        userRepo.save(user);

        String token = jwtUtil.generateToken(user.getUsername());

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "id", user.getId(),
                        "username", user.getUsername(),
                        "email", user.getEmail(),
                        "roles", user.getRoles().stream()
                                .map(Role::getName) // e.g. "ROLE_ADMIN"
                                .toList()
                )
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody SigninRequest signinRequest) {

        User _user = userRepo.findByEmail(signinRequest.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(signinRequest.getPassword(), _user.getPassword())) {
            return ResponseEntity.badRequest().body("Invalid email or password");
        }

        String token = jwtUtil.generateToken(_user.getUsername());

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "id", _user.getId(),
                        "username", _user.getUsername(),
                        "email", _user.getEmail(),
                        "roles", _user.getRoles().stream()
                                .map(Role::getName) // e.g. "ROLE_ADMIN"
                                .toList()
                )
        ));
    }
}
