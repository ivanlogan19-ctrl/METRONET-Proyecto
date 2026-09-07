package com.metronet.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "linea")
public class Linea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_linea")
    private Integer idLinea;

    @Column(name = "id_diseno", nullable = false)
    private Integer idDiseno;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "modificable", nullable = false)
    private Boolean modificable = true;

    public Linea() {
    }

    public Linea(Integer idDiseno, String nombre, Boolean modificable) {
        this.idDiseno = idDiseno;
        this.nombre = nombre;
        this.modificable = modificable;
    }

    public Integer getIdLinea() {
        return idLinea;
    }

    public void setIdLinea(Integer idLinea) {
        this.idLinea = idLinea;
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

    public Boolean getModificable() {
        return modificable;
    }

    public void setModificable(Boolean modificable) {
        this.modificable = modificable;
    }
}