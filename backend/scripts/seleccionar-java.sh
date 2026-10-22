#!/usr/bin/env bash
# Compartir el mismo JDK entre Maven y el servidor; ignorar JAVA_HOME antiguos.
seleccionarJava() {
  local candidato version
  for candidato in "$@"; do
    [[ -x "$candidato/bin/java" && -x "$candidato/bin/javac" ]] || continue
    version=$("$candidato/bin/java" -version 2>&1) || continue
    if [[ "$version" =~ version\ \"25[.\"] ]]; then
      export JAVA_HOME="$candidato"
      return 0
    fi
  done
  echo 'METRONET requiere JDK 25. Instalalo o indicá su carpeta en JAVA_HOME.' >&2
  return 1
}
