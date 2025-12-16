package com.example.agriverse.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;
import java.util.Set;

@Entity
@Table(name = "forum")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Forum {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "forum_id_seq_gen")
    @SequenceGenerator(name = "forum_id_seq_gen", sequenceName = "forum_id_seq", allocationSize = 1)
    private Long id;

    @Column(nullable = false)
    private String author;

    @Column(nullable = false, unique = true)
    private String title;

    @Column(nullable = false)
    private String description;

    @ElementCollection
    @Column(nullable = false)
    private Set<String> categories;

    @Column(nullable = false)
    private Date created;

}
