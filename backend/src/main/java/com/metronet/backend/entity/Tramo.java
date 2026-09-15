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

    @Column(name = "id_linea", nullable = false)
    private Integer idLinea;

    @Column(name = "id_estacion_a", nullable = false)
    private Integer idEstacionA;

    @Column(name = "id_estacion_b", nullable = false)
    private Integer idEstacionB;

    public Tramo() {
    }

    public Tramo(
        Integer idDiseno,
        Integer idLinea,
        Integer idEstacionA,
        Integer idEstacionB
    ) {
        this.idDiseno = idDiseno;
        this.idLinea = idLinea;
        this.idEstacionA = idEstacionA;
        this.idEstacionB = idEstacionB;
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

    public Integer getIdLinea() {
        return idLinea;
    }

    public void setIdLinea(Integer idLinea) {
        this.idLinea = idLinea;
    }

    public Integer getIdEstacionA() {
        return idEstacionA;
    }

    public void setIdEstacionA(Integer idEstacionA) {
        this.idEstacionA = idEstacionA;
    }

    public Integer getIdEstacionB() {
        return idEstacionB;
    }

    public void setIdEstacionB(Integer idEstacionB) {
        this.idEstacionB = idEstacionB;
    }
}