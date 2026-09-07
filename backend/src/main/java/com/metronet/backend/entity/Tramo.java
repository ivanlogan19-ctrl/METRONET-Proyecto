package com.metronet.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "tramo")
public class Tramo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_tramo")
    private Integer idTramo;

    @Column(name = "id_diseno", nullable = false)
    private Integer idDiseno;

    @Column(name = "nombre_linea", nullable = false, length = 100)
    private String nombreLinea;

    @Column(name = "estacion_a", nullable = false, length = 100)
    private String estacionA;

    @Column(name = "estacion_b", nullable = false, length = 100)
    private String estacionB;

    public Tramo() {
    }

    public Tramo(Integer idDiseno, String nombreLinea,
                 String estacionA, String estacionB) {
        this.idDiseno = idDiseno;
        this.nombreLinea = nombreLinea;
        this.estacionA = estacionA;
        this.estacionB = estacionB;
    }

    public Integer getIdTramo() {
        return idTramo;
    }

    public void setIdTramo(Integer idTramo) {
        this.idTramo = idTramo;
    }

    public Integer getIdDiseno() {
        return idDiseno;
    }

    public void setIdDiseno(Integer idDiseno) {
        this.idDiseno = idDiseno;
    }

    public String getNombreLinea() {
        return nombreLinea;
    }

    public void setNombreLinea(String nombreLinea) {
        this.nombreLinea = nombreLinea;
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
