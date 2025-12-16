package com.example.agriverse.service;

import com.example.agriverse.dto.ForumPostRequest;
import com.example.agriverse.model.Forum;
import com.example.agriverse.model.User;
import com.example.agriverse.repository.ForumRepository;
import com.example.agriverse.repository.UserRepository;
import com.example.agriverse.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ForumService {

    private final ForumRepository forumRepo;

    public List<Forum> findAll() {
        return forumRepo.findAll();
    }

    public Optional<Forum> findByTitle(String title) {
        return forumRepo.findByTitle(title);
    }

    public Forum createPost(ForumPostRequest request) {

        Forum forumPost = Forum.builder()
                .author(request.getAuthor())
                .title(request.getTitle())
                .description(request.getDescription())
                .categories(request.getCategories())
                .created(new Date()) // Set the current timestamp here
                .build();

        return forumRepo.save(forumPost);
    }

}
