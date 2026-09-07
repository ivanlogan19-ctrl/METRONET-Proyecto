package com.metronet.backend.controller;

import com.metronet.backend.dto.CrearLineaRequest;
import com.metronet.backend.dto.TramoRequest;
import com.metronet.backend.service.LineaService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/lineas")
public class LineaController {

    private final LineaService lineaService;

    public LineaController(LineaService lineaService) {
        this.lineaService = lineaService;
    }

    @PostMapping
    public ResponseEntity<String> crearLinea(
        @RequestBody CrearLineaRequest request
    ) {
        lineaService.crearLinea(request);

        return ResponseEntity.ok("Línea creada correctamente");
    }

    @PostMapping("/diseno/{idDiseno}/{nombreLinea}/tramos")
    public ResponseEntity<String> agregarTramo(
        @PathVariable Integer idDiseno,
        @PathVariable String nombreLinea,
        @RequestBody TramoRequest request
    ) {
        lineaService.agregarTramo(
            idDiseno,
            nombreLinea,
            request
        );

        return ResponseEntity.ok(
            "Tramo agregado correctamente"
        );
    }

    @GetMapping("/diseno/{idDiseno}")
    public ResponseEntity<?> obtenerLineasPorDiseno(
        @PathVariable Integer idDiseno
    ) {
        return ResponseEntity.ok(
            lineaService.obtenerLineasPorDiseno(idDiseno)
        );
    }

    @GetMapping("/diseno/{idDiseno}/{nombreLinea}/tramos")
    public ResponseEntity<?> obtenerTramos(
        @PathVariable Integer idDiseno,
        @PathVariable String nombreLinea
    ) {
        return ResponseEntity.ok(
            lineaService.obtenerTramos(idDiseno, nombreLinea)
        );
    }
}