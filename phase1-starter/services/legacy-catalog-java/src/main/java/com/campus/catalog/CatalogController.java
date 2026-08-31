package com.campus.catalog;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogController {

    @Autowired
    private CatalogRepository repository;

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/api/catalog")
    public List<CatalogEvent> listAll() {
        return repository.findAll();
    }

    @GetMapping("/api/catalog/{id}")
    public Optional<CatalogEvent> getOne(@PathVariable Long id) {
        return repository.findById(id);
    }
}