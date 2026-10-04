-- 019: añade una séptima tarjeta a cada publicación vigente sin modificar versiones históricas.
-- Ejecutar con rol de migración tras un respaldo restaurable y antes de arrancar el backend nuevo.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE nivel_publicacion_tarjeta DROP CONSTRAINT IF EXISTS nivel_publicacion_tarjeta_posicion_check;
ALTER TABLE nivel_publicacion_tarjeta ADD CONSTRAINT nivel_publicacion_tarjeta_posicion_check
  CHECK (posicion BETWEEN 1 AND 7);

CREATE TEMP TABLE metronet_tarjeta_70 ON COMMIT DROP AS
SELECT numero,id,imagen,titulo,texto,aprendizaje,fuente,url,"descripcionImagen",sha256
FROM jsonb_to_recordset($tarjetas$[{"numero":1,"id":"1-7","imagen":"/assets/educacion/metro-ciudad.svg","titulo":"El metro también modifica la ciudad","texto":"Una estación no solamente responde a la demanda de transporte existente: también puede crear nueva demanda. Al mejorar la accesibilidad de una zona, puede favorecer la aparición de viviendas, comercios y oficinas alrededor de ella. Por este motivo, transporte y planificación urbana están estrechamente relacionados y las decisiones sobre dónde construir una línea pueden influir en el crecimiento futuro de una ciudad.","aprendizaje":"Relacionar accesibilidad y desarrollo urbano.","fuente":"TransLink, Transit-Oriented Communities","url":"https://www.translink.ca/plans-and-projects/strategies-plans-and-guidelines/transit-oriented-communities","descripcionImagen":"Una estación de metro conecta un barrio con viviendas, comercios y oficinas.","sha256":"ee47b91eefdf9f928230869866edddcd4a8e1657529f499d03edaafab16cdce1"},{"numero":2,"id":"2-7","imagen":"/assets/educacion/metro-vapor-1863.svg","titulo":"El primer metro del mundo","texto":"El primer ferrocarril subterráneo del mundo comenzó a funcionar en Londres en 1863. Curiosamente, el primer metro de Londres todavía no usaba trenes eléctricos: las primeras locomotoras funcionaban a vapor, por lo que controlar el humo y la ventilación dentro de los túneles era uno de los grandes problemas del sistema. La electrificación posterior hizo posible desarrollar redes subterráneas mucho más extensas.","aprendizaje":"Distinguir el metro a vapor de su electrificación posterior.","fuente":"Transport for London, Tube 160 Heritage Leaflet","url":"https://foi.tfl.gov.uk/FOI-0773-2324/TUBE160%20Heritage%20Leaflet.pdf","descripcionImagen":"Un tren a vapor circula por un túnel histórico con ventilación hacia la superficie.","sha256":"c74fb213d5cdb6391d40c4bfac243a27513de7a463d373cfd98dabdcb1198f80"},{"numero":3,"id":"3-7","imagen":"/assets/educacion/metro-red-radial.svg","titulo":"El problema de las redes radiales","texto":"Muchas redes históricas crecieron conectando los barrios periféricos con el centro de la ciudad. Este diseño funciona muy bien cuando la mayoría de los viajes tienen como destino el centro, pero puede hacer incómodo viajar entre dos barrios periféricos: a veces el pasajero debe acercarse al centro para después volver a alejarse. Las líneas circulares y transversales ayudan a evitar este problema.","aprendizaje":"Comparar recorridos radiales con conexiones transversales.","fuente":"Société des Grands Projets, Grand Paris Express","url":"https://www.grandparisexpress.fr/gpe-essentiel","descripcionImagen":"Una red radial obliga a pasar por el centro; un arco transversal une dos barrios exteriores.","sha256":"36fc645e4b4bb3839706b7c3836ec6cffea76c4fc5810abd85e836554628c684"},{"numero":4,"id":"4-7","imagen":"/assets/educacion/metro-distancia-estaciones.svg","titulo":"Más estaciones no siempre significa mejor servicio","texto":"Colocar muchas estaciones aumenta la cantidad de lugares a los que llega una línea, pero también hace que los trenes tengan que detenerse, frenar y acelerar con mayor frecuencia. Separarlas demasiado produce el problema contrario: los viajes son más rápidos, pero menos personas tienen una estación cerca. Elegir la distancia entre estaciones es, por tanto, un equilibrio entre cobertura y velocidad.","aprendizaje":"Equilibrar cobertura y velocidad al ubicar estaciones.","fuente":"TransLink, Transit-Oriented Communities","url":"https://www.translink.ca/plans-and-projects/strategies-plans-and-guidelines/transit-oriented-communities","descripcionImagen":"Dos esquemas comparan estaciones cercanas y separadas con áreas de cobertura.","sha256":"d480e08a620c70564f2cc4286046b60310ff39f83fb90fee450bfae050617efd"},{"numero":5,"id":"5-7","imagen":"/assets/educacion/metro-grafo.svg","titulo":"Una red de metro también es un problema matemático","texto":"Para estudiar una red de metro no es necesario dibujar calles, edificios o incluso las distancias reales entre estaciones. Podemos imaginarla simplemente como puntos unidos por líneas: cada punto representa una estación y cada unión indica que es posible viajar directamente entre ambas. Esta representación se conoce como grafo y permite responder preguntas como cuál es el camino más corto entre dos estaciones, qué recorrido requiere menos transbordos o qué estaciones son fundamentales para mantener conectada la red. La misma idea se utiliza para estudiar carreteras, redes informáticas e incluso relaciones entre personas.","aprendizaje":"Modelar estaciones y conexiones como un grafo.","fuente":"Princeton University, Algorithms, Undirected Graphs","url":"https://algs4.cs.princeton.edu/41graph/index.php","descripcionImagen":"Un mapa esquemático de metro se transforma en nodos y enlaces de un grafo.","sha256":"d64f6e48740d3ab1ed1b45ece434c03e5236781f271758d4f2478acf18aa6501"},{"numero":6,"id":"6-7","imagen":"/assets/educacion/metro-bajo-tierra.svg","titulo":"¿Por qué construir bajo tierra?","texto":"Construir túneles es mucho más caro y complejo que instalar vías en la superficie, pero tiene una gran ventaja en ciudades densamente construidas: permite crear nuevas rutas sin ocupar calles ni dividir barrios con vías ferroviarias. Además, al circular en una infraestructura completamente separada, los trenes no interfieren con automóviles, peatones o semáforos. Por eso muchos sistemas combinan tramos subterráneos en las zonas más congestionadas con tramos elevados o en superficie donde existe más espacio.","aprendizaje":"Comparar tramos subterráneos y superficiales según el espacio urbano.","fuente":"Metrolinx, Ontario Line and other world-class transit systems","url":"https://www.metrolinx.com/en/discover/how-the-ontario-line-lines-up-other-world-class-transit-systems","descripcionImagen":"Corte de ciudad con peatones y tránsito en superficie, y un tren en un túnel separado debajo.","sha256":"3e978129b936ffc9bd28c2566f92c64f32d1a675ee98118bbc6b8a9c7b9f7f6e"},{"numero":7,"id":"7-7","imagen":"/assets/educacion/metro-transbordos.svg","titulo":"Los transbordos conectan la red","texto":"Los transbordos permiten pasar de una línea a otra y hacen posible llegar a lugares que una sola línea no podría cubrir. Su ubicación es especialmente importante, un transbordo bien situado puede evitar grandes rodeos, mientras que una red con pocas conexiones entre líneas puede obligar a los pasajeros a realizar recorridos mucho más largos, caminar más de lo deseado o incluso combinar varios sistemas de transporte diferentes. Por eso, al diseñar una red, no sólo importa por dónde pasa cada línea, sino también dónde se conectan entre sí.","aprendizaje":"Ubicar conexiones entre líneas para evitar rodeos.","fuente":"Transport for London, West London Orbital","url":"https://haveyoursay.tfl.gov.uk/west-london-orbital?tool=news_feed","descripcionImagen":"Dos líneas de metro se conectan en una estación de intercambio, con recorridos antes y después.","sha256":"19654592ce1388e00bc0956325f6f64d6928ead3696ecfd176c340a15ef2847d"},{"numero":8,"id":"8-7","imagen":"/assets/educacion/metro-nueva-linea.svg","titulo":"Una línea nueva puede mejorar líneas antiguas","texto":"El beneficio de construir una línea no se limita a las estaciones nuevas que incorpora. Si cruza varias líneas existentes y crea nuevos transbordos, también puede reducir los recorridos necesarios entre estaciones que ya formaban parte de la red. Por eso, al planificar una ampliación, importa tanto qué lugares atraviesa, como las conexiones que genera.","aprendizaje":"Evaluar conexiones nuevas entre estaciones existentes.","fuente":"Société des Grands Projets, Benefit of the metro for Île-de-France","url":"https://www.grandparisexpress.fr/benefit-metro-ile-de-france","descripcionImagen":"Una línea nueva enlaza dos líneas antiguas mediante estaciones de transbordo.","sha256":"9cbb7f0ca7783703d7857203075b1c4647f425a224e2f267375217a695a19961"},{"numero":9,"id":"9-7","imagen":"/assets/educacion/metro-redundancia.svg","titulo":"Construir redundancia tiene un precio","texto":"Tener varios caminos posibles entre dos zonas hace que una red sea más resistente: si un tramo queda fuera de servicio, los pasajeros pueden utilizar otra ruta. Sin embargo, construir infraestructura redundante también cuesta dinero. Parte del diseño de una red consiste en decidir dónde merece la pena disponer de alternativas y dónde una única conexión resulta suficiente.","aprendizaje":"Comparar resiliencia de rutas alternativas con su costo.","fuente":"Federal Highway Administration, Transportation Network Redundancy","url":"https://ops.fhwa.dot.gov/publications/fhwahop08015/lit6_8.htm","descripcionImagen":"Un tramo bloqueado contrasta una red con ruta alternativa y otra sin desvío.","sha256":"c8b3fccdebc26c948fb269b24563bd8af259f3e2ca7164b6288a175b51c9a9f3"},{"numero":10,"id":"10-7","imagen":"/assets/educacion/metro-estacion-critica.svg","titulo":"Una estación puede ser importante aunque no sea la más utilizada","texto":"Algunas estaciones tienen un papel crítico simplemente por su posición dentro de la red. Si queda fuera de servicio una estación que constituye el único enlace entre dos sectores, esto podría obligar a realizar enormes desvíos o incluso separar la red en dos partes. Analizar estos puntos vulnerables permite diseñar sistemas más resistentes ante averías o interrupciones.","aprendizaje":"Identificar estaciones cuyo enlace sostiene la conectividad de la red.","fuente":"Princeton University, Algorithms, Undirected Graphs","url":"https://algs4.cs.princeton.edu/41graph/index.php","descripcionImagen":"Una estación puente es el único enlace entre dos sectores; al interrumpirse el paso, los sectores quedan separados.","sha256":"9023d0054f986640e61d231ba8bd9a6288b3701252a87a2f514bb9426a244f39"}]$tarjetas$::jsonb)
AS t(numero integer,id text,imagen text,titulo text,texto text,aprendizaje text,
     fuente text,url text,"descripcionImagen" text,sha256 text);

DO $migracion$
DECLARE nivel record; tarjeta record; actual nivel_publicacion%ROWTYPE;
        nueva_id bigint; borrador_tarjetas jsonb; nueva_version integer;
BEGIN
  IF (SELECT COUNT(*) FROM metronet_tarjeta_70) <> 10 THEN
    RAISE EXCEPTION '019 necesita exactamente diez tarjetas nuevas';
  END IF;
  FOR nivel IN SELECT id_escenario,numero FROM escenario
      WHERE progresivo=TRUE AND modo='NIVEL' ORDER BY numero LOOP
    SELECT * INTO tarjeta FROM metronet_tarjeta_70 WHERE numero=nivel.numero;
    IF NOT FOUND THEN RAISE EXCEPTION 'Falta tarjeta nueva del nivel %',nivel.numero; END IF;
    PERFORM 1 FROM escenario WHERE id_escenario=nivel.id_escenario FOR UPDATE;
    SELECT * INTO actual FROM nivel_publicacion WHERE id_escenario=nivel.id_escenario
      ORDER BY numero_version DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Falta publicación del nivel %',nivel.numero; END IF;
    IF EXISTS (SELECT 1 FROM nivel_publicacion_tarjeta
      WHERE id_nivel_publicacion=actual.id_nivel_publicacion AND id_tarjeta=tarjeta.id) THEN
      CONTINUE; -- Reejecución después de un COMMIT anterior.
    END IF;
    IF (SELECT COUNT(*) FROM nivel_publicacion_tarjeta
        WHERE id_nivel_publicacion=actual.id_nivel_publicacion) <> 6 THEN
      RAISE EXCEPTION 'La publicación vigente del nivel % no tiene seis tarjetas previas',nivel.numero;
    END IF;
    nueva_version:=actual.numero_version+1;
    INSERT INTO nivel_publicacion(id_escenario,numero_version,version_criterio_uv_ut,
      contenido,red_referencia,huella,autor_id,confirmacion_editorial)
    VALUES (nivel.id_escenario,nueva_version,actual.version_criterio_uv_ut,
      actual.contenido,actual.red_referencia,
      md5(actual.huella || ':' || tarjeta.sha256 || ':' || tarjeta.id),NULL,TRUE)
    RETURNING id_nivel_publicacion INTO nueva_id;
    INSERT INTO nivel_publicacion_tarjeta(id_nivel_publicacion,posicion,id_tarjeta,titulo,
      texto,aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo,sha256_svg)
    SELECT nueva_id,posicion,id_tarjeta,titulo,texto,aprendizaje,fuente,url_fuente,
      descripcion_imagen,id_svg_catalogo,sha256_svg
    FROM nivel_publicacion_tarjeta WHERE id_nivel_publicacion=actual.id_nivel_publicacion;
    INSERT INTO nivel_publicacion_tarjeta(id_nivel_publicacion,posicion,id_tarjeta,titulo,
      texto,aprendizaje,fuente,url_fuente,descripcion_imagen,id_svg_catalogo,sha256_svg)
    VALUES (nueva_id,7,tarjeta.id,tarjeta.titulo,tarjeta.texto,tarjeta.aprendizaje,
      tarjeta.fuente,tarjeta.url,tarjeta."descripcionImagen",tarjeta.imagen,tarjeta.sha256);
    SELECT tarjetas INTO borrador_tarjetas FROM nivel_borrador
      WHERE id_escenario=nivel.id_escenario FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Falta borrador del nivel %',nivel.numero; END IF;
    IF jsonb_array_length(borrador_tarjetas)=6 THEN
      borrador_tarjetas:=borrador_tarjetas || jsonb_build_array(jsonb_build_object(
        'id',tarjeta.id,'titulo',tarjeta.titulo,'texto',tarjeta.texto,
        'aprendizaje',tarjeta.aprendizaje,'fuente',tarjeta.fuente,
        'urlFuente',tarjeta.url,'descripcionImagen',tarjeta."descripcionImagen",
        'idSvgCatalogo',tarjeta.imagen));
    ELSIF jsonb_array_length(borrador_tarjetas)<>7 OR borrador_tarjetas->6->>'id'<>tarjeta.id THEN
      RAISE EXCEPTION 'El borrador del nivel % tiene cardinalidad o ID inesperado',nivel.numero;
    END IF;
    UPDATE nivel_borrador SET tarjetas=borrador_tarjetas,version_base=nueva_version,
      revision=revision+1,actualizado_en=clock_timestamp()
      WHERE id_escenario=nivel.id_escenario;
  END LOOP;
  IF (SELECT COUNT(*) FROM escenario WHERE progresivo=TRUE AND modo='NIVEL')<>10 THEN
    RAISE EXCEPTION '019 requiere exactamente diez niveles';
  END IF;
END $migracion$;
COMMIT;
