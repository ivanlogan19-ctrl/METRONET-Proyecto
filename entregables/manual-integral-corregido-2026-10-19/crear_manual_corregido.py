"""Manual METRONET corregido: capturas limpias, texto contrastado y dos partes."""
from __future__ import annotations

import sys
from collections import defaultdict
from html import escape
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from pypdf import PdfReader
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'manual-integral-ampliado-2026-10-19'
sys.path.insert(0, str(OLD))
import base_visual as B
from contenido_ampliado import DETAILS

HERE.mkdir(exist_ok=True)
PDF = HERE / 'Manual METRONET corregido - Administrador y Usuario.pdf'
DOCX = HERE / 'Manual METRONET corregido - Administrador y Usuario.docx'
EDITABLE_DOCX = DOCX
PNG = HERE / 'paginas'
PNG.mkdir(exist_ok=True)
W, H = 1000, 700

details = defaultdict(list)
for d in DETAILS:
    details[d['base']].append(dict(d))

# La captura y la consigna muestran que Línea une el primer par y que Conexión
# extiende el recorrido. El manual anterior invertía esas dos instrucciones.
d = details[16][0]
d['controls'][3] = 'Conexión: extiende el recorrido de una línea entre estaciones existentes.'
d['steps'] = [
    'Ubicá al menos dos estaciones separadas en el mapa.',
    'Creá una línea y uní las primeras dos estaciones con su primer tramo.',
    'Asigná un Metro a la línea. Usá Conexión si necesitás extender el recorrido.',
    'Revisá las metas y corregí cualquier elemento pendiente.',
]

# La barra de Metas y POI muestra cinco metas y cero de tres lugares posibles.
# La captura no demuestra que cada POI tenga un radio editable en esta vista.
details[5][1]['controls'][3] = 'Lugares objetivo: la vista muestra un contador de hasta tres referencias.'
details[5][1]['steps'][2] = 'Para un lugar objetivo, agregá la referencia y revisá el texto y las condiciones visibles.'

# Dos afirmaciones del texto antiguo excedían la evidencia disponible.
details[3][1]['purpose'] = 'El detalle del diseño permite revisar sus elementos. Actividad ofrece un registro de operaciones administrativas.'
details[3][1]['caution'] = 'La captura aportada solo muestra el acceso a Diseños y Actividad; el detalle y la tabla se describen según el frontend local.'
details[17][0]['result'] = 'Después de ejecutar la red, volvé a Edición y usá Finalizar red para comprobar la consigna. La captura aportada no muestra el resultado final.'

BLUE = '#177FC4'; NAVY = '#0B2744'; LIGHT = '#EAF5FC'; INK = '#173650'; MUTED = '#536C80'; BORDER = '#B9D6EA'; WHITE = '#FFFFFF'


def para(c, value, x, top, width, size=11, color=INK, bold=False, leading=None):
    style = ParagraphStyle('p', fontName='Calibri-Bold' if bold else 'Calibri',
                           fontSize=size, leading=leading or size*1.23,
                           textColor=HexColor(color))
    p = Paragraph(escape(str(value)), style)
    _, height = p.wrap(width, 3000)
    p.drawOn(c, x, top-height)
    return height


def image_in(c, img, x, y, width, height):
    iw, ih = img.size
    scale = min(width/iw, height/ih)
    w, h = iw*scale, ih*scale
    xx, yy = x+(width-w)/2, y+(height-h)/2
    c.drawImage(ImageReader(img), xx, yy, w, h)
    c.setStrokeColor(HexColor(BORDER))
    c.setLineWidth(0.8)
    c.rect(xx, yy, w, h)
    return xx, yy, w, h


def clean_shot(key, crop):
    im = B.crop_img(key, crop)
    assert im.width > 100 and im.height > 100
    return im


def main_shot(index, item):
    if index != 16:
        return clean_shot(item['main'], item['crop'])
    # Composición de las dos pantallas originales, sin rectángulos sobre controles.
    map_img = clean_shot('7.01.14', (0, 270, 1405, 1235))
    tools_img = clean_shot('7.01.02', (1406, 275, 1980, 1240))
    map_img.thumbnail((1500, 940))
    tools_img.thumbnail((600, 940))
    out = Image.new('RGB', (map_img.width+tools_img.width+16,
                            max(map_img.height, tools_img.height)), '#07172C')
    out.paste(map_img, (0, 0))
    out.paste(tools_img, (map_img.width+16, 0))
    return out


def numbered_shot(index, item):
    """Marcadores pequeños junto al control, sin cubrirlo con rectángulos."""
    im = main_shot(index, item).copy()
    marks = list(item['marks'])
    if index == 5:
        marks[0] = [(1520, 554)]
        marks[1] = [(1018, 675)]
        marks[2] = [(1890, 675), (1890, 970)]  # Objetivo e instrucciones.
        marks[3] = [(773, 440)]  # Pestaña Metas y POI.
    if index == 7:
        marks[0] = [(860, 515)]
        marks[1] = [(1890, 566)]
        marks[2] = [(1115, 650), (1115, 1010)]  # Texto y aprendizaje.
        marks[3] = [(1895, 716), (1170, 1108)]  # Imagen y fuente.
    if index == 10:
        marks = marks[:2]  # Música se señala en la captura de apoyo.
    if index == 21:
        marks[0] = [(500, 465)]
        marks[1] = [(950, 465)]
        marks[2] = [(955, 600)]
        marks[3] = [(1850, 600)]
    draw = ImageDraw.Draw(im)
    radius = max(16, round(min(im.size) * .023))
    font = ImageFont.truetype(str(B.BOLD), round(radius*1.15))
    if index == 16:
        map_img = clean_shot('7.01.14', (0, 270, 1405, 1235))
        map_img.thumbnail((1500, 940))
        tools_img = clean_shot('7.01.02', (1406, 275, 1980, 1240))
        tools_img.thumbnail((600, 940))
        for number, rect in enumerate(marks, 1):
            x = rect[0] if isinstance(rect, tuple) else rect[0][0]
            y = rect[1] if isinstance(rect, tuple) else rect[0][1]
            anchors = [(map_img.width + 16 + (x-1406)*tools_img.width/574,
                        (y-275)*tools_img.height/965)]
            for cx,cy in anchors:
                circle(draw,cx,cy,number,radius,font)
        return im
    l,t,r,b=item['crop']
    for number, mark in enumerate(marks, 1):
        anchors = mark if isinstance(mark, list) else [(mark[0],mark[1])]
        for x,y in anchors:
            cx=(x-l)*im.width/(r-l)+radius
            cy=(y-t)*im.height/(b-t)+radius
            circle(draw,cx,cy,number,radius,font)
    return im


def circle(draw, cx, cy, number, radius, font):
    cx=max(radius+2,cx);cy=max(radius+2,cy)
    draw.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),fill='#126EA9',outline='white',width=max(2,radius//7))
    text=str(number)
    box=draw.textbbox((0,0),text,font=font)
    draw.text((cx-(box[2]-box[0])/2,cy-(box[3]-box[1])/2-box[1]),text,font=font,fill='white')


def extra_shot(key):
    # Todos los recortes empiezan debajo de la barra del navegador.
    if key.startswith('6.57.'):
        crop = (245, 245, 1745, 1190)
        if key == '6.57.55': crop = (0, 165, 1987, 1248)
    elif key.startswith('6.59.') or key.startswith('7.00.1') or key.startswith('7.00.2'):
        crop = (325, 280, 1965, 1200)
    elif key in ('7.00.44', '7.00.48'):
        crop = (245, 300, 1750, 1210)
    elif key.startswith('6.58.'):
        crop = (105, 280, 1885, 1120)
    else:
        crop = (0, 265, 1987, 1235)
    if key == '7.00.34': crop = (1570, 160, 1987, 520)
    if key == '6.58.15': crop = (1570, 165, 1987, 425)
    if key == '7.00.57': crop = (15, 345, 415, 550)
    if key == '7.01.02': crop = (1406, 275, 1980, 1235)
    if key == '7.01.17': crop = (550, 320, 1520, 840)
    if key == '6.58.59': crop = (100, 280, 1885, 1070)
    im=clean_shot(key, crop)
    if key == '7.00.34':
        draw=ImageDraw.Draw(im)
        radius=max(13,round(min(im.size)*.042))
        font=ImageFont.truetype(str(B.BOLD),round(radius*1.15))
        circle(draw,(1645-crop[0])*im.width/(crop[2]-crop[0]),
               (306-crop[1])*im.height/(crop[3]-crop[1]),3,radius,font)
    return im


def header(c, part, index, title, kind):
    c.setFillColor(HexColor(WHITE)); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor(NAVY)); c.rect(0, H-74, W, 74, fill=1, stroke=0)
    c.setFillColor(HexColor(BLUE)); c.rect(0, H-78, W, 4, fill=1, stroke=0)
    c.setFont('Calibri-Bold', 10); c.setFillColor(HexColor('#A9D8F3'))
    c.drawString(43, 673, 'METRONET  /  GUÍA DE USO')
    c.drawRightString(957, 673, f'PARTE {1 if part == "ADMINISTRADOR" else 2}  ·  {part}')
    para(c, title, 43, 657, 880, 25, WHITE, True)
    c.setFillColor(HexColor(MUTED)); c.setFont('Calibri', 9)
    c.drawString(43, 18, f'{index:02d}  /  {kind}')
    c.drawRightString(957, 18, f'{c.getPageNumber():02d}')
    c.setStrokeColor(HexColor(BORDER)); c.line(43, 37, 957, 37)


def cover(c):
    c.setFillColor(HexColor(NAVY)); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor(BLUE)); c.rect(0, 655, W, 9, fill=1, stroke=0)
    logo = Image.open(B.LOGO).convert('RGB')
    image_in(c, logo, 290, 300, 420, 260)
    para(c, 'MANUAL METRONET', 115, 284, 770, 39, WHITE, True)
    para(c, 'PARTE 1  ·  ADMINISTRADOR     |     PARTE 2  ·  USUARIO', 115, 230, 770, 18, '#B5DDF4', True)
    para(c, 'Guía visual de las pantallas y acciones del juego', 115, 194, 770, 14, '#B5DDF4')
    c.showPage()


def overview(c, i, item):
    header(c, item['part'], i, item['title'], 'PANTALLA PRINCIPAL')
    para(c, item['lead'], 43, 605, 914, 12, MUTED)
    im = numbered_shot(i, item)
    image_in(c, im, 43, 123, 914, 433)
    c.setFillColor(HexColor(LIGHT)); c.roundRect(43, 50, 914, 59, 7, fill=1, stroke=0)
    for row in range(0,len(item['items']),2):
        line = '     ·     '.join(f'{j+1}  {item["items"][j][0]}' for j in range(row,min(row+2,len(item['items']))))
        para(c, line, 59, 101-row//2*22, 882, 10.5, NAVY, True)
    c.showPage()


def text_blocks(ds):
    blocks=[]
    for d in ds:
        blocks += [('heading', d['title']), ('text', d['purpose']), ('label', 'DÓNDE ENTRAR'), ('text', d['route']),
                   ('label', 'CONTROLES Y ELEMENTOS')]
        blocks += [('bullet', s) for s in d['controls']]
        blocks.append(('label', 'PASOS'))
        blocks += [('step', f'{i}. {s}') for i, s in enumerate(d['steps'], 1)]
        blocks += [('result', 'RESULTADO  '+d['result'])]
        if d['caution']: blocks += [('caution', 'ATENCIÓN  '+d['caution'])]
    return blocks


def render_block(c, kind, text, x, y, width, factor=1):
    if kind=='heading':
        h=para(c,text,x,y,width,13.1*factor,BLUE,True,15.4*factor); return h+9
    if kind=='label':
        h=para(c,text,x,y,width,9.2*factor,NAVY,True,11*factor); return h+3
    if kind=='result':
        h=para(c,text,x,y,width,9.1*factor,BLUE,True,11*factor); return h+6
    if kind=='caution':
        h=para(c,text,x,y,width,8.8*factor,MUTED,False,10.4*factor); return h+5
    prefix='•  ' if kind=='bullet' else ''
    h=para(c,prefix+text,x+4,y,width-5,9.15*factor,INK,False,11*factor)
    return h+(3 if kind in ('bullet','step') else 6)


def content(c, i, item):
    header(c, item['part'], i, item['title'], 'EXPLICACIÓN Y PASOS')
    n=len(item['extra']); gap=13; width=(914-gap*(n-1))/n
    single=len(details[i])==1
    if n==1 and single:
        key,name=item['extra'][0],item['extra_names'][0]
        image_in(c,extra_shot(key),43,220,458,340)
        para(c,name,43,207,458,10.5,BLUE,True)
        blocks=text_blocks(details[i]);x=526;y=574
        for kind,value in blocks:
            factor=1.11
            size={'heading':13.1,'label':9.2,'result':9.1,'caution':8.8}.get(kind,9.15)*factor
            lead={'heading':15.4,'label':11,'result':11,'caution':10.4}.get(kind,11)*factor
            p=Paragraph(escape(('•  ' if kind=='bullet' else '')+str(value)),ParagraphStyle('m',fontName='Calibri-Bold' if kind in ('heading','label','result') else 'Calibri',fontSize=size,leading=lead))
            _,h=p.wrap(426,2000)
            required=h+({'heading':9,'label':3,'result':6,'caution':5}.get(kind,3 if kind in ('bullet','step') else 6))
            if y-required<53:
                raise RuntimeError(f'No cabe contenido de una columna: {i} {kind} {value[:35]}')
            y-=render_block(c,kind,value,x,y,426,factor)
        c.showPage();return
    support_y=390 if n==1 else 386
    support_height=190 if n==1 else 187
    for j, (key, name) in enumerate(zip(item['extra'], item['extra_names'])):
        x=43+j*(width+gap)
        image_in(c, extra_shot(key), x, support_y, width, support_height)
        para(c, name, x, support_y-7, width, 10.2, BLUE, True)
    line_y=369 if n==1 else 365
    c.setStrokeColor(HexColor(BORDER)); c.line(43, line_y, 957, line_y)
    blocks=text_blocks(details[i]); col=0; x=43; y=line_y-13
    factor=.97 if len(details[i])>1 else 1.09
    headings_seen=0
    for kind, value in blocks:
        if kind=='heading':
            headings_seen+=1
            if headings_seen==2:
                col=1; x=514; y=line_y-13
        if single and n>=2 and kind=='label' and value=='PASOS' and col==0:
            col=1; x=514; y=line_y-13
        size={'heading':13.1,'label':9.2,'result':9.1,'caution':8.8}.get(kind,9.15)*factor
        lead={'heading':15.4,'label':11,'result':11,'caution':10.4}.get(kind,11)*factor
        p=Paragraph(escape(('•  ' if kind=='bullet' else '')+str(value)),ParagraphStyle('m',fontName='Calibri-Bold' if kind in ('heading','label','result') else 'Calibri',fontSize=size,leading=lead))
        _,h=p.wrap(440,2000)
        required=h+({'heading':9,'label':3,'result':6,'caution':5}.get(kind,3 if kind in ('bullet','step') else 6))
        if y-required<51:
            col+=1; x=514; y=line_y-13
        if col>1 or y-required<51:
            raise RuntimeError(f'No cabe el contenido {i} {item["title"]}: {kind} {value[:35]}')
        y-=render_block(c,kind,value,x,y,440,factor)
    c.showPage()


def make_pdf():
    c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
    c.setTitle('Manual METRONET corregido — Administrador y Usuario')
    cover(c)
    for i,item in enumerate(B.PAGES,1):
        overview(c,i,item)
        content(c,i,item)
    c.save()


def rgb(hexcode):
    v=hexcode.lstrip('#');return RGBColor(*(int(v[z:z+2],16) for z in (0,2,4)))


def doc_run(p,s,size,bold=False,color=INK):
    r=p.add_run(s);r.font.name='Calibri';r.font.size=Pt(size);r.bold=bold;r.font.color.rgb=rgb(color)


def shaded_paragraph(p, color):
    ppr=p._p.get_or_add_pPr()
    shd=OxmlElement('w:shd');shd.set(qn('w:fill'),color.lstrip('#'));ppr.append(shd)
    p.paragraph_format.left_indent=Inches(.16)
    p.paragraph_format.space_before=Pt(6)
    p.paragraph_format.space_after=Pt(11)
    p.paragraph_format.line_spacing=1.3


def picture(p,img,max_w,max_h):
    w,h=img.size;ratio=min(max_w/w,max_h/h)
    import io
    b=io.BytesIO();img.save(b,format='PNG');b.seek(0)
    p.add_run().add_picture(b,width=Inches(w*ratio),height=Inches(h*ratio))


def make_docx():
    doc=Document();sec=doc.sections[0]
    sec.page_width=Inches(W/72);sec.page_height=Inches(H/72);sec.orientation=WD_ORIENT.LANDSCAPE
    sec.top_margin=Inches(.35);sec.bottom_margin=Inches(.35);sec.left_margin=Inches(.6);sec.right_margin=Inches(.6)
    normal=doc.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(9.3);normal.font.color.rgb=rgb(INK)
    normal.paragraph_format.space_after=Pt(3)
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before=Pt(100)
    picture(p,Image.open(B.LOGO).convert('RGB'),7.2,4.1)
    for s,z,col in [('MANUAL METRONET',32,NAVY),('PARTE 1 · ADMINISTRADOR  |  PARTE 2 · USUARIO',18,BLUE),('Guía visual de las pantallas y acciones del juego',13,MUTED)]:
        p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;doc_run(p,s,z,True,col)
    for i,item in enumerate(B.PAGES,1):
        p=doc.add_paragraph();p.paragraph_format.page_break_before=True
        doc_run(p,f'PARTE {1 if i<=10 else 2} · {item["part"]}     /     {i:02}',9,True,BLUE)
        p=doc.add_paragraph();shaded_paragraph(p,NAVY);doc_run(p,item['title'],22,True,WHITE)
        p=doc.add_paragraph();doc_run(p,item['lead'],11,False,MUTED)
        p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        picture(p,numbered_shot(i,item),12.35,6.0)
        p=doc.add_paragraph();doc_run(p,'  ·  '.join(f'{j+1} {name}' for j,(name,_) in enumerate(item['items'])),10,True,BLUE)
        p=doc.add_paragraph();p.paragraph_format.page_break_before=True
        doc_run(p,f'PARTE {1 if i<=10 else 2} · {item["part"]}     /     {i:02}',9,True,BLUE)
        p=doc.add_paragraph();shaded_paragraph(p,NAVY);doc_run(p,item['title']+' · explicación y pasos',19,True,WHITE)
        n=len(item['extra']);t=doc.add_table(rows=1,cols=n);t.autofit=False
        for j,(key,name) in enumerate(zip(item['extra'],item['extra_names'])):
            cell=t.cell(0,j);cell.width=Inches(12.4/n)
            q=cell.paragraphs[0];q.alignment=WD_ALIGN_PARAGRAPH.CENTER
            picture(q,extra_shot(key),12.1/n,2.35)
            q=cell.add_paragraph();doc_run(q,name,8.5,True,BLUE)
        ct=doc.add_table(rows=1,cols=2);ct.autofit=False
        ct.columns[0].width=Inches(6.18);ct.columns[1].width=Inches(6.18)
        col=0; used=0
        headings_seen=0
        for kind,value in text_blocks(details[i]):
            if kind=='heading':
                headings_seen+=1
                if headings_seen==2:col=1;used=0
            estimate=1.5 if kind=='heading' else 1 if kind=='label' else 2.3 if len(value)>105 else 1.4
            if used+estimate>28 and col==0:col=1;used=0
            cell=ct.cell(0,col)
            q=cell.add_paragraph();q.paragraph_format.space_after=Pt(2)
            if kind=='heading':doc_run(q,value,11.5,True,BLUE)
            elif kind=='label':doc_run(q,value,9.4,True,NAVY)
            elif kind=='result':doc_run(q,value,9.2,True,BLUE)
            else:doc_run(q,('•  ' if kind=='bullet' else '')+value,9.1,False,MUTED if kind=='caution' else INK)
            used+=estimate
    doc.core_properties.title='Manual METRONET corregido — Administrador y Usuario'
    doc.save(EDITABLE_DOCX)


def make_visual_docx():
    """Mismas páginas que el PDF, para lectura fiel dentro de Word."""
    import io
    import pypdfium2 as pdfium
    pdf=pdfium.PdfDocument(str(PDF))
    doc=Document();sec=doc.sections[0]
    sec.page_width=Pt(W);sec.page_height=Pt(H);sec.orientation=WD_ORIENT.LANDSCAPE
    sec.top_margin=Pt(1);sec.bottom_margin=Pt(1)
    sec.left_margin=Pt(1);sec.right_margin=Pt(1)
    normal=doc.styles['Normal'];normal.paragraph_format.space_after=Pt(0)
    normal.paragraph_format.space_before=Pt(0)
    normal.paragraph_format.line_spacing=1
    for i,page in enumerate(pdf):
        image=page.render(scale=1.5).to_pil().convert('RGB')
        buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=86,optimize=True)
        buffer.seek(0)
        p=doc.add_paragraph()
        if i:p.paragraph_format.page_break_before=True
        p.paragraph_format.space_after=Pt(0)
        p.add_run().add_picture(buffer,width=Pt(W-3),height=Pt(H-4))
    doc.core_properties.title='Manual METRONET corregido — Administrador y Usuario'
    doc.save(DOCX)


if __name__=='__main__':
    assert len(B.PAGES)==21 and len(set(B.used))==46
    make_pdf();make_docx()
    print(PDF, DOCX, 'páginas PDF:',len(PdfReader(str(PDF)).pages))
