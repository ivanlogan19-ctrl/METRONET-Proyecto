package com.metronet.backend.dto;

import java.util.List;

public class CrearLineaRequest {

    private Integer idDiseno;
    private String nombre;
    private List<TramoRequest> tramos;

    public CrearLineaRequest() {
    }

    public Integer getIdDiseno() {
        return idDiseno;
    }

    public void setIdDiseno(Integer idDiseno) {
        this.idDiseno = idDiseno;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public List<TramoRequest> getTramos() {
        return tramos;
    }

    public void setTramos(List<TramoRequest> tramos) {
        this.tramos = tramos;
    }
}