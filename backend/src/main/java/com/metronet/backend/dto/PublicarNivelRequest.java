package com.metronet.backend.dto;

public record PublicarNivelRequest(Integer versionEsperada, Integer revisionEsperada,
                                  String huellaPreview, Boolean confirmacionEditorial) {}
