package com.belot.server.web;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class RoomCorsConfiguration implements WebMvcConfigurer {
    private final String[] origins;
    public RoomCorsConfiguration(@Value("${belot.rooms.allowed-origins:}") String origins) {
        this.origins = Arrays.stream(origins.split(",")).map(String::strip).filter(value -> !value.isEmpty()).toArray(String[]::new);
    }
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (origins.length > 0) registry.addMapping("/api/rooms/**").allowedOrigins(origins)
                .allowedMethods("GET", "POST", "OPTIONS").allowedHeaders("Authorization", "Content-Type").maxAge(3600);
    }
}
