package com.metronet.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class HealthService {

    private final JdbcTemplate jdbcTemplate;

    public HealthService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, String> health() {

        jdbcTemplate.queryForObject("SELECT 1", Integer.class);

        return Map.of(
                "status", "UP",
                "database", "CONNECTED"
        );
    }
}