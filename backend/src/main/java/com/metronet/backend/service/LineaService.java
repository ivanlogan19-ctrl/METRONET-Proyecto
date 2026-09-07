package com.metronet.backend.service;

import com.metronet.backend.repository.EstacionRepository;
import com.metronet.backend.repository.LineaRepository;
import com.metronet.backend.repository.TramoRepository;
import org.springframework.stereotype.Service;
import com.metronet.backend.dto.CrearLineaRequest;
import com.metronet.backend.dto.TramoRequest;
import org.springframework.transaction.annotation.Transactional;
import com.metronet.backend.entity.Linea;
import com.metronet.backend.entity.Tramo;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@Service
public class LineaService {

    private final LineaRepository lineaRepository;
    private final TramoRepository tramoRepository;
    private final EstacionRepository estacionRepository;

    public LineaService(
            LineaRepository lineaRepository,
            TramoRepository tramoRepository,
            EstacionRepository estacionRepository) {

        this.lineaRepository = lineaRepository;
        this.tramoRepository = tramoRepository;
        this.estacionRepository = estacionRepository;
    }

    private List<String> obtenerExtremos(List<Tramo> tramos) {

        Map<String, Integer> cantidadConexiones = new HashMap<>();

        for (Tramo tramo : tramos) {

            cantidadConexiones.put(
                tramo.getEstacionA(),
                cantidadConexiones.getOrDefault(tramo.getEstacionA(), 0) + 1
            );

            cantidadConexiones.put(
                tramo.getEstacionB(),
                cantidadConexiones.getOrDefault(tramo.getEstacionB(), 0) + 1
            );
        }

        List<String> extremos = new ArrayList<>();

        for (Map.Entry<String, Integer> entrada : cantidadConexiones.entrySet()) {

            if (entrada.getValue() == 1) {
                extremos.add(entrada.getKey());
            }
        }

        return extremos;
    }

    public List<Linea> obtenerLineasPorDiseno(Integer idDiseno) {
        return lineaRepository.findByIdDiseno(idDiseno);
    }

    @Transactional
    public void crearLinea(CrearLineaRequest request) {

        Integer idDiseno = request.getIdDiseno();

        if (request.getTramos() == null || request.getTramos().isEmpty()) {
            throw new IllegalArgumentException(
                "La línea debe tener al menos un tramo"
            );
        }

        Map<String, Integer> conexionesTemporales = new HashMap<>();

        for (TramoRequest tramoRequest : request.getTramos()) {

            boolean existeEstacionA = estacionRepository.existsByIdDisenoAndNombre(
                idDiseno,
                tramoRequest.getEstacionA()
            );

            boolean existeEstacionB = estacionRepository.existsByIdDisenoAndNombre(
                idDiseno,
                tramoRequest.getEstacionB()
            );

            if (!existeEstacionA || !existeEstacionB) {
                throw new IllegalArgumentException(
                    "Ambas estaciones deben existir en el diseño"
                );
            }

            if (tramoRequest.getEstacionA().equals(tramoRequest.getEstacionB())) {
                throw new IllegalArgumentException(
                    "Debes seleccionar dos estaciones diferentes"
                );
            }

            String estacionA;
            String estacionB;

            if (tramoRequest.getEstacionA().compareTo(tramoRequest.getEstacionB()) < 0) {
                estacionA = tramoRequest.getEstacionA();
                estacionB = tramoRequest.getEstacionB();
            } else {
                estacionA = tramoRequest.getEstacionB();
                estacionB = tramoRequest.getEstacionA();
            }

            boolean tramoYaExiste =
                tramoRepository.existsByIdDisenoAndEstacionAAndEstacionB(
                    idDiseno,
                    estacionA,
                    estacionB
                );

            if (tramoYaExiste) {
                throw new IllegalArgumentException(
                    "Ya existe un tramo entre estas estaciones"
                );
            }

            if (!conexionesTemporales.isEmpty()) {

                boolean estacionAYaPertenece =
                    conexionesTemporales.containsKey(tramoRequest.getEstacionA());

                boolean estacionBYaPertenece =
                    conexionesTemporales.containsKey(tramoRequest.getEstacionB());

                if (estacionAYaPertenece == estacionBYaPertenece) {
                    throw new IllegalArgumentException(
                        "Cada nuevo tramo debe extender uno de los extremos de la línea"
                    );
                }

                String estacionExistente;

                if (estacionAYaPertenece) {
                    estacionExistente = tramoRequest.getEstacionA();
                } else {
                    estacionExistente = tramoRequest.getEstacionB();
                }

                if (conexionesTemporales.get(estacionExistente) != 1) {
                    throw new IllegalArgumentException(
                        "Solo se puede extender la línea desde uno de sus extremos"
                    );
                }
            }

            conexionesTemporales.put(
                tramoRequest.getEstacionA(),
                conexionesTemporales.getOrDefault(tramoRequest.getEstacionA(), 0) + 1
            );

            conexionesTemporales.put(
                tramoRequest.getEstacionB(),
                conexionesTemporales.getOrDefault(tramoRequest.getEstacionB(), 0) + 1
            );
        }

        boolean existeLinea =
            lineaRepository.existsByIdDisenoAndNombre(
                idDiseno,
                request.getNombre()
            );

        if (existeLinea) {
            throw new IllegalArgumentException(
                "Ya existe una línea con ese nombre"
            );
        }

        Linea linea = new Linea(
            idDiseno,
            request.getNombre(),
            true
        );

        lineaRepository.save(linea);

        for (TramoRequest tramoRequest : request.getTramos()) {

            String estacionA;
            String estacionB;

            if (tramoRequest.getEstacionA().compareTo(tramoRequest.getEstacionB()) < 0) {
                estacionA = tramoRequest.getEstacionA();
                estacionB = tramoRequest.getEstacionB();
            } else {
                estacionA = tramoRequest.getEstacionB();
                estacionB = tramoRequest.getEstacionA();
            }

            Tramo tramo = new Tramo(
                idDiseno,
                request.getNombre(),
                estacionA,
                estacionB
            );

            tramoRepository.save(tramo);
        }
    }

    @Transactional
    public void agregarTramo(
        Integer idDiseno,
        String nombreLinea,
        TramoRequest request
    ) {

        boolean existeLinea = lineaRepository.existsByIdDisenoAndNombre(
            idDiseno,
            nombreLinea
        );

        if (!existeLinea) {
            throw new IllegalArgumentException(
                "La línea no existe"
            );
        }

        boolean existeEstacionA = estacionRepository.existsByIdDisenoAndNombre(
            idDiseno,
            request.getEstacionA()
        );

        boolean existeEstacionB = estacionRepository.existsByIdDisenoAndNombre(
            idDiseno,
            request.getEstacionB()
        );

        if (!existeEstacionA || !existeEstacionB) {
            throw new IllegalArgumentException(
                "Ambas estaciones deben existir en el diseño"
            );
        }

        if (request.getEstacionA().equals(request.getEstacionB())) {
            throw new IllegalArgumentException(
                "Debes seleccionar dos estaciones diferentes"
            );
        }

        List<Tramo> tramosActuales = tramoRepository.findByIdDisenoAndNombreLinea(
            idDiseno,
            nombreLinea
        );

        List<String> extremos = obtenerExtremos(tramosActuales);

        boolean estacionAEsExtremo = extremos.contains(request.getEstacionA());
        boolean estacionBEsExtremo = extremos.contains(request.getEstacionB());

        if (estacionAEsExtremo == estacionBEsExtremo) {
            throw new IllegalArgumentException(
                "Debes conectar un extremo de la línea con una nueva estación"
            );
        }

        for (Tramo tramo : tramosActuales) {

            boolean estacionAYaPertenece =
                tramo.getEstacionA().equals(request.getEstacionA()) ||
                tramo.getEstacionB().equals(request.getEstacionA());

            boolean estacionBYaPertenece =
                tramo.getEstacionA().equals(request.getEstacionB()) ||
                tramo.getEstacionB().equals(request.getEstacionB());

            if ((!estacionAEsExtremo && estacionAYaPertenece) ||
                (!estacionBEsExtremo && estacionBYaPertenece)) {

                throw new IllegalArgumentException(
                    "La nueva estación ya pertenece a esta línea"
                );
            }
        }

        String estacionA;
        String estacionB;

        if (request.getEstacionA().compareTo(request.getEstacionB()) < 0) {
            estacionA = request.getEstacionA();
            estacionB = request.getEstacionB();
        } else {
            estacionA = request.getEstacionB();
            estacionB = request.getEstacionA();
        }

        boolean tramoYaExiste =
            tramoRepository.existsByIdDisenoAndEstacionAAndEstacionB(
                idDiseno,
                estacionA,
                estacionB
            );

        if (tramoYaExiste) {
            throw new IllegalArgumentException(
                "Ya existe un tramo entre estas estaciones"
            );
        }

        Tramo tramo = new Tramo(
            idDiseno,
            nombreLinea,
            estacionA,
            estacionB
        );

        tramoRepository.save(tramo);
    }

    public List<Tramo> obtenerTramos(
        Integer idDiseno,
        String nombreLinea
    ) {
        return tramoRepository.findByIdDisenoAndNombreLinea(
            idDiseno,
            nombreLinea
        );
    }
}