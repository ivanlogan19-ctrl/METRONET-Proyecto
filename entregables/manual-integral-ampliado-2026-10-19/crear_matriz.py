"""Registro auditable de páginas, funciones y capturas del manual."""
from pathlib import Path
from collections import defaultdict
import base_visual as B
from contenido_ampliado import DETAILS
from crear_manual_ampliado import DETAIL_SHOTS

HERE=Path(__file__).resolve().parent
OUT=HERE/'Matriz de cobertura y verificación.md'
by_base=defaultdict(list)
for d in DETAILS:by_base[d['base']].append(d)
lines=[
 '# METRONET — matriz de cobertura del manual',
 '',
 '## Criterio de estado',
 '',
 '- **DEFINIDO:** Documento METRONET, fuente funcional y técnica principal. Sus capítulos de requisitos, casos de uso, administración y simulación establecen el alcance general.',
 '- **IMPLEMENTADO:** interfaz y comportamiento observables en las 46 capturas aportadas y en los archivos del frontend citados abajo. Una captura documenta una vista; los flujos no capturados se contrastaron con código.',
 '- **PROPUESTO:** no hay funciones propuestas presentadas como instrucciones del manual.',
 '',
 'Esta matriz distingue la fuente de cada afirmación. El manual explica el comportamiento implementado de la versión observada; las diferencias con el documento oficial se registran al final.',
 '',
 '## Cobertura por apartado',
 '',
 '| Parte | Apartado detallado | Página PDF/DOCX | Evidencia visual | Estado de la explicación |',
 '|---|---|---:|---|---|',
]
pageno=1
visual_used=[]
for i,p in enumerate(B.PAGES,1):
    pageno+=1
    keys=[p['main']]+p['extra'];visual_used.extend(keys)
    for d in by_base[i]:
        pageno+=1
        key=DETAIL_SHOTS.get(d['title'],p['main'])
        state='IMPLEMENTADO: captura y código' if key in keys else 'IMPLEMENTADO: código; vista no aportada'
        if d['title'] in ('Usuarios: editar datos y eliminar','Diseños: elementos y registro de Actividad'):
            state='IMPLEMENTADO: código; vista interna no aportada'
        lines.append(f'| {"1 Administrador" if i<=10 else "2 Usuario"} | {d["title"]} | {pageno} | {key} | {state} |')
assert pageno==49
lines += [
 '',
 '## Capturas incorporadas',
 '',
 'Las 46 capturas originales aparecen en las páginas visuales: el recorte elimina la ventana del navegador y conserva la interfaz del juego. Algunas se repiten en las páginas detalladas para enfocar controles. No se inventó ninguna pantalla.',
 '',
 '| Página visual | Captura principal | Capturas de apoyo |',
 '|---:|---|---|',
]
pageno=1
for idx,p in enumerate(B.PAGES,1):
    pageno+=1
    lines.append(f'| {pageno} | {p["main"]} | {", ".join(p["extra"])} |')
    pageno+=len(by_base[idx])
assert len(set(visual_used))==46
lines += [
 '',
 '## Fuentes de implementación revisadas',
 '',
 '- `frontend/admin.html`: menú y paneles de Gestión, Juego y Sistema.',
 '- `frontend/src/administracion/administracion.js`: usuarios, diseños, actividad, fuentes, unidades y configuración.',
 '- `frontend/src/administracion/AdministracionNiveles.js`: editor de niveles, guardado, validación, publicación e historial.',
 '- `frontend/src/administracion/EditorMetasNivel.js`: metas y lugares objetivo.',
 '- `frontend/src/administracion/EditorRedReferenciaNivel.js`: red privada de comprobación.',
 '- `docs/verificacion/experiencia-auditoria-integral-2026-10-09.md`: auditoría funcional de la experiencia editorial.',
 '- `docs/Documento METRONET.docx`: alcance y requisitos definidos oficialmente.',
 '',
 '## Diferencias y límites de evidencia',
 '',
 '1. **Mantenimiento.** DEFINIDO: el documento oficial describe una restricción temporal de operaciones de jugadores que modifican diseños y simulaciones. IMPLEMENTADO/visible: la pantalla administrativa indica que los jugadores no podrán ingresar y los administradores conservarán acceso. El manual describe el texto implementado; la discrepancia requiere decisión del proyecto y no se corrige aquí.',
 '2. **UV/UT en niveles.** IMPLEMENTADO: el ajuste de una línea recalcula la otra magnitud a partir de su distancia. La pantalla estática de Unidades y equivalencias afirma que son independientes en niveles. El manual advierte esta contradicción sin convertir una afirmación de interfaz en regla oficial.',
 '3. **Capturas no aportadas.** No hay imagen del diálogo de edición de usuario, detalle interno de diseño, tabla de Actividad ni resultado final aprobado. Esas acciones se explican con la implementación y se marcan como tales; se usan capturas de navegación relacionadas.',
 '4. **Cuenta de ejemplo.** Varias imágenes muestran una sesión administradora, en la que los diez niveles y los trofeos tienen un estado especial. El manual aclara que un jugador ve disponibilidad y marcas según su progreso.',
 '',
 '## Verificación del entregable',
 '',
 '- PDF final: 49 páginas apaisadas; fuentes Calibri y Calibri Bold incrustadas.',
 '- DOCX editable: 49 páginas al convertirlo con LibreOffice headless para control visual.',
 '- 46 de 46 capturas únicas usadas; imágenes del juego recortadas del navegador.',
 '- Todas las páginas de ambos formatos revisadas mediante contactos visuales; se inspeccionaron detalles ampliados de administración y Nivel 1.',
 '- No se modificaron código de producto, datos, esquema, endpoints ni documentación oficial.',
]
OUT.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(OUT)
