package com.metronet.backend.dto;

public class TramoRequest {

    private String estacionA;
    private String estacionB;

    public TramoRequest() {
    }

    public String getEstacionA() {
        return estacionA;
    }

    public void setEstacionA(String estacionA) {
        this.estacionA = estacionA;
    }

    public String getEstacionB() {
        return estacionB;
    }

    public void setEstacionB(String estacionB) {
        this.estacionB = estacionB;
    }
}