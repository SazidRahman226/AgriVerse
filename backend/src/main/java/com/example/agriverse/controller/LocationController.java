package com.example.agriverse.controller;

import com.example.agriverse.dto.LocationRequest;
import com.example.agriverse.model.Location;
import com.example.agriverse.repository.LocationRepository; // You need to create this Repo interface
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/location")
@CrossOrigin(origins = "http://localhost:3000")
public class LocationController {

    @Autowired
    private LocationRepository locationRepository;

    @PostMapping("/update")
    public String updateLocation(@RequestBody LocationRequest request, Authentication authentication) {

        Location loc = new Location();
        loc.setUsername(authentication.getName());
        loc.setLatitude(request.latitude);
        loc.setLongitude(request.longitude);

        locationRepository.save(loc);

        return "Location updated!";
    }
}