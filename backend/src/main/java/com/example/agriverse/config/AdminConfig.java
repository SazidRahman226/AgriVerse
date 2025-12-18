package com.example.agriverse.config;

import com.example.agriverse.model.Role;
import com.example.agriverse.model.User;
import com.example.agriverse.repository.RoleRepository;
import com.example.agriverse.repository.UserRepository;
import lombok.AllArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@AllArgsConstructor
public class AdminConfig implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_USER")));

        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_ADMIN")));
        Role govtOfficerRole = roleRepository.findByName("ROLE_GOVT_OFFICER")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_GOVT_OFFICER")));

        if (!userRepository.existsByUsername("admin")) {
            User user = new User();
            user.setUsername("admin");
            user.setEmail("admin@example.com");
            user.setPassword(passwordEncoder.encode("admin"));
            user.setRoles(Set.of(userRole, adminRole));
            user.setEmailVerified(true);

            userRepository.save(user);
            System.out.println("✅ Admin user created: admin / admin");
        } else {
            System.out.println("ℹ️ Admin user already exists");
        }

        // Seed sample Govt Officers with geographic coordinates for the Map feature
        if (!userRepository.existsByUsername("officer_dhaka")) {
            User officer1 = new User();
            officer1.setUsername("officer_dhaka");
            officer1.setEmail("officer.dhaka@agriverse.gov");
            officer1.setPassword(passwordEncoder.encode("officer123"));
            officer1.setRoles(Set.of(govtOfficerRole));
            officer1.setEmailVerified(true);
            officer1.setIdentificationNumber("GOV-DHK-001");
            officer1.setLatitude(23.8103);
            officer1.setLongitude(90.4125);

            userRepository.save(officer1);
            System.out.println("✅ Sample officer created: officer_dhaka (Dhaka)");
        }

        if (!userRepository.existsByUsername("officer_chittagong")) {
            User officer2 = new User();
            officer2.setUsername("officer_chittagong");
            officer2.setEmail("officer.chittagong@agriverse.gov");
            officer2.setPassword(passwordEncoder.encode("officer123"));
            officer2.setRoles(Set.of(govtOfficerRole));
            officer2.setEmailVerified(true);
            officer2.setIdentificationNumber("GOV-CTG-002");
            officer2.setLatitude(22.3569);
            officer2.setLongitude(91.7832);

            userRepository.save(officer2);
            System.out.println("✅ Sample officer created: officer_chittagong (Chittagong)");
        }
    }

}
