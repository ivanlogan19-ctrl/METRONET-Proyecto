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

    private List<Integer> obtenerExtremos(List<Tramo> tramos) {

        Map<Integer, Integer> cantidadConexiones = new HashMap<>();

        for (Tramo tramo : tramos) {

            cantidadConexiones.put(
                tramo.getIdEstacionA(),
                cantidadConexiones.getOrDefault(tramo.getIdEstacionA(), 0) + 1
            );

            cantidadConexiones.put(
                tramo.getIdEstacionB(),
                cantidadConexiones.getOrDefault(tramo.getIdEstacionB(), 0) + 1
            );
        }

        List<Integer> extremos = new ArrayList<>();

        for (Map.Entry<Integer, Integer> entrada : cantidadConexiones.entrySet()) {

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

            var estacionAObj = estacionRepository
                .findByIdDisenoAndNombre(
                    idDiseno,
                    tramoRequest.getEstacionA()
                )
                .orElseThrow(() -> new IllegalArgumentException(
                    "La estación A no existe en el diseño"
                ));

            var estacionBObj = estacionRepository
                .findByIdDisenoAndNombre(
                    idDiseno,
                    tramoRequest.getEstacionB()
                )
                .orElseThrow(() -> new IllegalArgumentException(
                    "La estación B no existe en el diseño"
                ));

            Integer idEstacionA = estacionAObj.getIdEstacion();
            Integer idEstacionB = estacionBObj.getIdEstacion();

            if (tramoRequest.getEstacionA().equals(tramoRequest.getEstacionB())) {
                throw new IllegalArgumentException(
                    "Debes seleccionar dos estaciones diferentes"
                );
            }

            boolean tramoYaExiste =
                tramoRepository.existsByIdDisenoAndIdEstacionAAndIdEstacionB(
                    idDiseno,
                    idEstacionA,
                    idEstacionB
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

            Integer idEstacionA = estacionRepository
                .findByIdDisenoAndNombre(
                    idDiseno,
                    tramoRequest.getEstacionA()
                )
                .orElseThrow(() -> new IllegalArgumentException(
                    "La estación A no existe en el diseño"
                ))
                .getIdEstacion();

            Integer idEstacionB = estacionRepository
                .findByIdDisenoAndNombre(
                    idDiseno,
                    tramoRequest.getEstacionB()
                )
                .orElseThrow(() -> new IllegalArgumentException(
                    "La estación B no existe en el diseño"
                ))
                .getIdEstacion();

            Tramo tramo = new Tramo(
                idDiseno,
                linea.getIdLinea(),
                idEstacionA,
                idEstacionB
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

        Linea linea = lineaRepository
            .findByIdDisenoAndNombre(idDiseno, nombreLinea)
            .orElseThrow(() -> new IllegalArgumentException(
                "La línea no existe"
            ));

        Integer idLinea = linea.getIdLinea();

        var estacionAObj = estacionRepository
            .findByIdDisenoAndNombre(
                idDiseno,
                request.getEstacionA()
            )
            .orElseThrow(() -> new IllegalArgumentException(
                "La estación A no existe en el diseño"
            ));

        var estacionBObj = estacionRepository
            .findByIdDisenoAndNombre(
                idDiseno,
                    request.getEstacionB()
            )
            .orElseThrow(() -> new IllegalArgumentException(
                "La estación B no existe en el diseño"
            ));

        Integer idEstacionA = estacionAObj.getIdEstacion();
        Integer idEstacionB = estacionBObj.getIdEstacion();

        if (request.getEstacionA().equals(request.getEstacionB())) {
            throw new IllegalArgumentException(
                "Debes seleccionar dos estaciones diferentes"
            );
        }

        List<Tramo> tramosActuales = tramoRepository.findByIdDisenoAndIdLinea(
            idDiseno,
            idLinea
        );

        List<Integer> extremos = obtenerExtremos(tramosActuales);

            boolean estacionAEsExtremo = extremos.contains(idEstacionA);
            boolean estacionBEsExtremo = extremos.contains(idEstacionB);

        if (estacionAEsExtremo == estacionBEsExtremo) {
            throw new IllegalArgumentException(
                "Debes conectar un extremo de la línea con una nueva estación"
            );
        }

        for (Tramo tramo : tramosActuales) {

            boolean estacionAYaPertenece =
                tramo.getIdEstacionA().equals(idEstacionA) ||
                tramo.getIdEstacionB().equals(idEstacionA);

            boolean estacionBYaPertenece =
                tramo.getIdEstacionA().equals(idEstacionB) ||
                tramo.getIdEstacionB().equals(idEstacionB);

            if ((!estacionAEsExtremo && estacionAYaPertenece) ||
                (!estacionBEsExtremo && estacionBYaPertenece)) {

                throw new IllegalArgumentException(
                    "La nueva estación ya pertenece a esta línea"
                );
            }
        }

        boolean tramoYaExiste =
            tramoRepository.existsByIdDisenoAndIdEstacionAAndIdEstacionB(
                idDiseno,
                idEstacionA,
                idEstacionB
            );

        if (tramoYaExiste) {
            throw new IllegalArgumentException(
                "Ya existe un tramo entre estas estaciones"
            );
        }

        Tramo tramo = new Tramo(
            idDiseno,
            idLinea,
            idEstacionA,
            idEstacionB
        );

        tramoRepository.save(tramo);
    }

    public List<Tramo> obtenerTramos(
        Integer idDiseno,
        String nombreLinea
    ) {
        Linea linea = lineaRepository
            .findByIdDisenoAndNombre(idDiseno, nombreLinea)
            .orElseThrow(() -> new IllegalArgumentException(
                "La línea no existe"
            ));

        return tramoRepository.findByIdDisenoAndIdLinea(
            idDiseno,
            linea.getIdLinea()
        );
    }

    @Transactional
    public void cambiarNombreLinea(
        Integer idDiseno,
        String nombreLinea,
        String nuevoNombre
    ) {
        Linea linea = lineaRepository
            .findByIdDisenoAndNombre(idDiseno, nombreLinea)
            .orElseThrow(() -> new IllegalArgumentException(
                "La línea no existe"
            ));

        nuevoNombre = nuevoNombre.trim();

        if (nuevoNombre.isEmpty()) {
            throw new IllegalArgumentException(
                "El nombre de la línea no puede estar vacío"
            );
        }

        if (lineaRepository.existsByIdDisenoAndNombre(
            idDiseno,
            nuevoNombre
        )) {
            throw new IllegalArgumentException(
                "Ya existe una línea con ese nombre"
            );
        }

        linea.setNombre(nuevoNombre);

        lineaRepository.save(linea);
    }

    @Transactional
    public void eliminarLinea(Integer idDiseno, String nombreLinea) {

        Linea linea = lineaRepository
            .findByIdDisenoAndNombre(idDiseno, nombreLinea)
            .orElseThrow(() -> new RuntimeException("Línea no encontrada"));

        List<Tramo> tramos =
            tramoRepository.findByIdDisenoAndIdLinea(
                idDiseno,
                linea.getIdLinea()
            );

        tramoRepository.deleteAll(tramos);

        lineaRepository.delete(linea);
    }
}