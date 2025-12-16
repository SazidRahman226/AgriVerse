package com.example.agriverse.repository;

import com.example.agriverse.model.Forum;
import com.example.agriverse.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ForumRepository extends JpaRepository<Forum, Long> {
    Boolean existsByAuthor(String author);
    Optional<Forum> findByAuthor(String author);
    Optional<Forum> findByTitle(String title);
}
