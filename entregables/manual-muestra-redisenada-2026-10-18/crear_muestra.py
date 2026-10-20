"""Dos páginas visuales de muestra; conserva intactas las capturas originales."""

from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CAPTURES = ROOT / "entregables/manual-usuario-2026-10-18-revision4/materiales/capturas_originales"
PDF = OUT / "Muestra visual METRONET - Administrador y Usuario.pdf"

pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Silkscreen", str(ROOT / "frontend/public/assets/fonts/silkscreen/Silkscreen-Regular.ttf")))

NAVY = HexColor("#07172C")
INK = HexColor("#16304B")
MUTED = HexColor("#526579")
PALE = HexColor("#F5F9FC")
LINE = HexColor("#CBD9E6")
BLUE = HexColor("#147FCE")
TEAL = HexColor("#009F9C")
AMBER = HexColor("#C78310")
PURPLE = HexColor("#8B54BE")
PINK = HexColor("#C74772")
GREEN = HexColor("#16885A")
CYAN = HexColor("#0C92C5")
COLORS = [BLUE, TEAL, AMBER, PURPLE, PINK, GREEN, CYAN]

PAGE_W, PAGE_H = 1000, 700
DISPLAY_W, DISPLAY_H = 1987, 1248
NATIVE_W, NATIVE_H = 2940, 1846


def shot(key):
    return next(CAPTURES.glob(f"*{key}*.png"))


def ptext(c, text, x, top, width, size=12, color=INK, bold=False, leading=None):
    style = ParagraphStyle(
        "local", fontName="Arial-Bold" if bold else "Arial", fontSize=size,
        leading=leading or size * 1.32, textColor=color, spaceAfter=0,
    )
    p = Paragraph(text, style)
    _, h = p.wrap(width, 999)
    p.drawOn(c, x, top - h)
    return h


def header(c, part, title, subtitle, page):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 18, PAGE_W, 18, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(0, PAGE_H - 18, 125, 4, fill=1, stroke=0)
    c.setFont("Silkscreen", 12)
    c.setFillColor(HexColor("#87CEF8"))
    c.drawString(42, PAGE_H - 46, "METRONET  /  MANUAL VISUAL")
    c.setFont("Arial-Bold", 10)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - 42, PAGE_H - 44, f"{part}  ·  MUESTRA DE ESTILO")
    c.setFont("Arial-Bold", 27)
    c.setFillColor(NAVY)
    c.drawString(42, PAGE_H - 88, title)
    ptext(c, subtitle, 43, PAGE_H - 99, 900, 11.5, MUTED)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(42, 38, PAGE_W - 42, 38)
    c.setFont("Arial", 9)
    c.setFillColor(MUTED)
    c.drawString(42, 23, "Ejemplo de maquetación · capturas reales de METRONET")
    c.drawRightString(PAGE_W - 42, 23, f"{page} / 2")


def crop_image(c, file, crop, view):
    """Recorta al dibujar el PDF; no modifica la captura original."""
    left, top, right, bottom = crop
    vx, vy, vw, vh = view
    native = [left * NATIVE_W / DISPLAY_W, top * NATIVE_H / DISPLAY_H,
              right * NATIVE_W / DISPLAY_W, bottom * NATIVE_H / DISPLAY_H]
    l, t, r, b = native
    sx, sy = vw / (r - l), vh / (b - t)
    assert abs(sx - sy) < 0.015, (sx, sy)
    c.saveState()
    path = c.beginPath()
    path.rect(vx, vy, vw, vh)
    c.clipPath(path, stroke=0)
    c.drawImage(ImageReader(str(file)), vx - l * sx, vy - (NATIVE_H - b) * sy,
                width=NATIVE_W * sx, height=NATIVE_H * sy)
    c.restoreState()
    c.setStrokeColor(HexColor("#85A8C3"))
    c.setLineWidth(0.9)
    c.rect(vx, vy, vw, vh, fill=0, stroke=1)


def box(c, crop, view, rect, num, color, marker_at="top"):
    l, t, r, b = crop
    vx, vy, vw, vh = view
    x1, y1, x2, y2 = rect
    sx, sy = vw / (r - l), vh / (b - t)
    xx = vx + (x1 - l) * sx
    yy = vy + (b - y2) * sy
    ww = (x2 - x1) * sx
    hh = (y2 - y1) * sy
    c.setStrokeColor(color)
    c.setLineWidth(2.4)
    c.roundRect(xx, yy, ww, hh, 3, fill=0, stroke=1)
    bx = xx + 10 if marker_at == "top" else xx + ww - 10
    by = yy + hh + 8 if marker_at == "top" else yy - 8
    c.setFillColor(color)
    c.circle(bx, by, 12, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Arial-Bold", 11)
    c.drawCentredString(bx, by - 3.8, str(num))


def card(c, x, y, w, h, num, color, title, description):
    c.setFillColor(PALE)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 6, fill=1, stroke=1)
    c.setFillColor(color)
    c.roundRect(x + 13, y + h - 38, 25, 25, 5, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Arial-Bold", 12)
    c.drawCentredString(x + 25.5, y + h - 30, str(num))
    ptext(c, title, x + 47, y + h - 14, w - 60, 13, NAVY, True)
    ptext(c, description, x + 47, y + h - 39, w - 60, 10.4, INK)


def make_admin(c):
    header(c, "PARTE 1 · ADMINISTRADOR", "Gestión de usuarios", "Buscá una cuenta y ubicá los controles que intervienen en la administración de privilegios.", 1)
    crop = (331, 278, 1967, 841)
    view = (42, 267, 916, 315)
    crop_image(c, shot("6.59.10"), crop, view)
    for rect, num, col in [
        ((699, 588, 1135, 645), 1, BLUE),
        ((1212, 588, 1554, 645), 2, TEAL),
        ((1028, 765, 1370, 822), 3, AMBER),
        ((1483, 764, 1620, 823), 4, PURPLE),
    ]:
        box(c, crop, view, rect, num, col)
    card(c, 42, 170, 447, 86, 1, BLUE, "Buscar usuario", "Escribí el nombre o correo electrónico para localizar la cuenta en la lista.")
    card(c, 511, 170, 447, 86, 2, TEAL, "Filtrar por rol", "Abrí «Todos los roles» para acotar la lista según el permiso asignado.")
    card(c, 42, 65, 447, 86, 3, AMBER, "Revisar el rol de una fila", "El selector de la cuenta muestra el rol actual y permite elegir otro.")
    card(c, 511, 65, 447, 86, 4, PURPLE, "Guardar el cambio", "Después de elegir el rol, pulsá «Guardar» en esa misma fila.")
    c.showPage()


def make_user(c):
    header(c, "PARTE 2 · USUARIO", "Nivel 1: primeros pasos", "Tras elegir Nivel 01 e Iniciar, usá esta guía para reconocer cada herramienta y construir el primer recorrido.", 2)
    crop = (1406, 275, 1980, 1240)
    view = (42, 55, 312, 524)
    crop_image(c, shot("7.01.02"), crop, view)
    calls = [
        ((1875, 285, 1919, 330), 1, BLUE),
        ((1412, 349, 1977, 384), 2, TEAL),
        ((1434, 949, 1562, 1003), 3, AMBER),
        ((1565, 949, 1693, 1003), 4, PURPLE),
        ((1697, 949, 1826, 1003), 5, PINK),
        ((1829, 949, 1958, 1003), 6, GREEN),
        ((1432, 1167, 1959, 1222), 7, CYAN),
    ]
    for rect, num, col in calls:
        box(c, crop, view, rect, num, col, marker_at="bottom" if num == 1 else "top")
    rows = [
        ("Tutorial", "Abrí el botón amarillo de la cabecera. La guía te acompaña paso a paso y podés volver a abrirla.", BLUE),
        ("Metas del nivel", "Leé lo que falta: estaciones, línea, conexión, Metro y simulación. Los contadores muestran el avance.", TEAL),
        ("Estación", "Elegí el icono rojo y hacé clic en dos ubicaciones distintas del mapa.", AMBER),
        ("Línea", "Elegí el icono violeta; seleccioná una estación de origen y otra de destino.", PURPLE),
        ("Conexión", "El icono turquesa extiende una línea: elegí una estación de esa línea y otra como destino.", PINK),
        ("Metro", "Elegí el icono naranja y hacé clic sobre la vía para asignar una unidad a esa línea.", GREEN),
        ("Acciones", "Disquete: guardá. Azul: abrí Simulación y pulsá Iniciar. Al volver a Edición, la bandera comprueba el nivel.", CYAN),
    ]
    x, w, top, rowh = 384, 574, 576, 73
    for i, (title, desc, col) in enumerate(rows, 1):
        y = top - i * rowh + 4
        c.setFillColor(PALE if i % 2 else HexColor("#FFFFFF"))
        c.setStrokeColor(LINE)
        c.roundRect(x, y, w, rowh - 7, 5, fill=1, stroke=1)
        c.setFillColor(col)
        c.roundRect(x + 11, y + rowh - 38, 27, 27, 5, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Arial-Bold", 12)
        c.drawCentredString(x + 24.5, y + rowh - 29, str(i))
        ptext(c, title, x + 49, y + rowh - 12, w - 60, 12.7, NAVY, True)
        ptext(c, desc, x + 49, y + rowh - 36, w - 61, 10.3, INK)
    c.showPage()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PDF), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Muestra visual METRONET: administrador y usuario")
    c.setAuthor("Manual METRONET")
    make_admin(c)
    make_user(c)
    c.save()
    print(PDF)


if __name__ == "__main__":
    main()
