"""Manual visual METRONET. Capturas originales: solo se recortan al maquetar."""
from __future__ import annotations

from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
CAP=ROOT/'entregables/manual-usuario-2026-10-18-revision4/materiales/capturas_originales'
LOGO=ROOT/'entregables/manual-usuario-2026-10-18-revision4/materiales/logo METRONET Nuevo.png'
FONTS=Path('/Applications/Microsoft Word.app/Contents/Resources/DFonts')
REG=FONTS/'Calibri.ttf'; BOLD=FONTS/'Calibrib.ttf'
assert REG.exists() and BOLD.exists(), 'Calibri no está disponible; no se sustituye.'
pdfmetrics.registerFont(TTFont('Calibri',str(REG)))
pdfmetrics.registerFont(TTFont('Calibri-Bold',str(BOLD)))
HERE.mkdir(parents=True,exist_ok=True)
FIG=HERE/'figuras'; FIG.mkdir(exist_ok=True)
PDF=HERE/'Manual METRONET - Administrador y Usuario.pdf'
DOCX=HERE/'Manual METRONET - Administrador y Usuario.docx'

NAVY='#07172C'; DEEP='#102B4A'; BLUE='#147FCE'; SKY='#3FA9F5'; ICE='#DCEFFD'; PALE='#F4F9FE'; INK='#19334C'; MUTED='#536D84'; LINE='#C2D7E8'; WHITE='#FFFFFF'
SHADES=['#075C9D','#147FCE','#2D91CF','#006FAE']
PAGE_W,PAGE_H=1000,700
DW,DH=1987,1248

def shot(key):
    matches=list(CAP.glob(f'*{key}*.png'))
    assert len(matches)==1,(key,matches)
    return matches[0]

def crop_img(key,crop=None):
    im=Image.open(shot(key)).convert('RGB')
    crop=crop or (0,270,DW,1235)
    l,t,r,b=crop
    return im.crop((round(l*im.width/DW),round(t*im.height/DH),round(r*im.width/DW),round(b*im.height/DH)))

def annotated(key,crop,marks,file):
    im=crop_img(key,crop)
    draw=ImageDraw.Draw(im)
    scale=im.width/(crop[2]-crop[0])
    font=ImageFont.truetype(str(BOLD),max(27,round(30*scale)))
    for i,rect in enumerate(marks,1):
        x1,y1,x2,y2=rect
        box=[round((x1-crop[0])*scale),round((y1-crop[1])*scale),round((x2-crop[0])*scale),round((y2-crop[1])*scale)]
        color=SHADES[(i-1)%len(SHADES)]
        draw.rounded_rectangle(box,radius=8,outline=color,width=max(5,round(5*scale)))
        bx=min(max(box[0]+24,25),im.width-27); by=max(box[1]-20,27)
        rad=max(21,round(22*scale))
        draw.ellipse((bx-rad,by-rad,bx+rad,by+rad),fill=color,outline='white',width=3)
        txt=str(i); bb=draw.textbbox((0,0),txt,font=font)
        draw.text((bx-(bb[2]-bb[0])/2,by-(bb[3]-bb[1])/2-bb[1]),txt,font=font,fill='white')
    im.save(file,optimize=True)
    return im

# Cada página une instrucciones editables, una captura principal con referencias y
# capturas de apoyo. Los rectángulos se expresan sobre la imagen visible de 1987x1248.
PAGES=[
 dict(part='ADMINISTRADOR',title='Acceso y navegación',lead='Ingresá con una cuenta que tenga permisos de administrador. Luego abrí Administración desde la barra superior.',main='6.57.24',crop=(250,320,1740,1035),marks=[(885,615,1690,716),(885,772,1690,833),(885,864,1690,928)],items=[('Identificador','Escribí el identificador de administrador asociado a la cuenta.'),('Contraseña','Completá la contraseña; «Mostrar» permite revisar lo escrito.'),('Ingresar','Pulsá «Ingresar a administración» para acceder al panel.')],extra=['6.57.55','6.59.18'],extra_names=['Pantalla de entrada','Menú de Gestión, Juego y Sistema']),
 dict(part='ADMINISTRADOR',title='Gestión de usuarios',lead='Buscá cuentas, filtrá la lista y gestioná el rol de cada fila.',main='6.59.10',crop=(320,285,1965,850),marks=[(700,586,1135,644),(1210,586,1555,645),(1030,765,1370,821),(1480,765,1620,821)],items=[('Buscar','Ingresá nombre o correo para localizar una cuenta.'),('Filtrar','Elegí un rol para mostrar solo las cuentas correspondientes.'),('Rol de la cuenta','Abrí el selector de la fila y elegí el rol adecuado.'),('Guardar','Confirmá el cambio en esa misma fila. «Editar» abre la cuenta y «Eliminar» la quita.')],extra=['7.02.19'],extra_names=['Supervisión de diseños por jugador']),
 dict(part='ADMINISTRADOR',title='Diseños y actividad',lead='En Gestión, «Diseños» permite consultar las redes guardadas de cada jugador. «Actividad» forma parte del menú de gestión.',main='7.02.19',crop=(0,285,1970,940),marks=[(13,429,302,496),(337,530,1138,666),(1487,748,1620,818)],items=[('Diseños','Abrí la sección en el menú lateral.'),('Buscar diseños','Localizá un jugador para ver sus diseños agrupados.'),('Abrir','Entrá al diseño elegido desde la fila. La captura no muestra su vista interna.')],extra=['6.59.18'],extra_names=['Ubicación de Actividad en el menú']),
 dict(part='ADMINISTRADOR',title='Experiencia de juego',lead='Elegí uno de los diez niveles y pulsá «Editar». El trabajo se organiza en pestañas antes de guardar y publicar.',main='6.59.18',crop=(320,285,1970,1050),marks=[(343,455,1890,1040),(1810,536,1940,592)],items=[('Lista de niveles','Cada tarjeta identifica número y nombre del desafío.'),('Editar','Abrí el editor del nivel seleccionado.')],extra=['6.59.21'],extra_names=['Desafío: nombre, dificultad, relato y consigna']),
 dict(part='ADMINISTRADOR',title='Desafío y metas',lead='El texto del desafío guía al jugador. Las metas y lugares objetivo determinan qué debe completar.',main='6.59.21',crop=(330,315,1965,1225),marks=[(356,554,1567,609),(356,675,1064,1215),(1080,675,1940,918),(805,440,1030,500)],items=[('Nombre','Identifica el nivel en la lista y en el juego.'),('Relato','Da contexto al recorrido.'),('Objetivo e instrucciones','Explican las acciones que el jugador debe realizar.'),('Metas y POI','Abrí esta pestaña para editar metas y lugares objetivo.')],extra=['6.59.24'],extra_names=['Metas secuenciales y lugares objetivo']),
 dict(part='ADMINISTRADOR',title='Reglas y red de referencia',lead='Definí cantidades, herramientas y condiciones; ubicá las referencias del nivel sobre el mapa.',main='6.59.27',crop=(330,315,1965,1155),marks=[(365,534,1935,718),(365,740,800,918),(1165,740,1940,920),(1030,438,1265,500)],items=[('Cantidades','Ajustá los mínimos de líneas, unidades, conexiones y estaciones.'),('Herramientas','Activá las herramientas disponibles para el nivel.'),('Condiciones','Marcá requisitos como exigir simulación.'),('Red de referencia','Elegí una estación u otro elemento y configurá sus datos en el mapa.')],extra=['6.59.30'],extra_names=['Mapa y propiedades del elemento']),
 dict(part='ADMINISTRADOR',title='Tarjetas de aprendizaje',lead='Cada tarjeta combina contenido histórico, imagen, explicación y fuente. Revisá el material antes de publicar.',main='6.59.33',crop=(335,345,1960,1228),marks=[(356,557,938,609),(1065,566,1942,611),(355,650,1158,999),(1180,715,1945,996)],items=[('Seleccionar tarjeta','Usá la lista y las flechas para cambiar de tarjeta.'),('Título','Escribí el encabezado que leerá el jugador.'),('Texto y aprendizaje','Redactá el dato y la idea clave que deja.'),('Imagen y fuente','Elegí una imagen del catálogo, describila y citá la fuente.')],extra=['7.00.48'],extra_names=['Cómo aparece una tarjeta en el juego']),
 dict(part='ADMINISTRADOR',title='Guardar, previsualizar y publicar',lead='El editor separa borrador, vista previa e historial. Publicá solo tras revisar la versión preparada.',main='6.59.46',crop=(335,315,1965,1000),marks=[(1250,341,1410,397),(1416,341,1635,397),(1647,341,1812,397),(1740,440,1958,500)],items=[('Guardar','Conservá el borrador antes de revisar.'),('Previsualizar','Inspeccioná cómo queda el nivel guardado.'),('Publicar','Dejá disponible la versión revisada.'),('Historial','Consultá las versiones registradas en esta pestaña.')],extra=['6.59.51'],extra_names=['Historial de versiones']),
 dict(part='ADMINISTRADOR',title='Fuentes del mapa y equivalencias',lead='Estas secciones informan la procedencia de las capas y las unidades que utiliza el juego.',main='7.00.19',crop=(330,285,1965,1045),marks=[(343,462,1140,735),(1160,462,1957,735),(343,754,1140,1037),(1160,754,1957,1037)],items=[('Calles','Consultá la fuente cartográfica y su actualización indicada.'),('Tráfico histórico','Leé período, actualización y escala relativa. No representa tráfico en vivo.'),('Población','La capa expresa densidad del conjunto de datos citado, no población actual.'),('Desplazamientos','Consultá la encuesta origen-destino y el alcance histórico de los flujos.')],extra=['7.00.22'],extra_names=['UT, UV, distancia y cobertura']),
 dict(part='ADMINISTRADOR',title='Configuración del sistema',lead='El modo de mantenimiento restringe el ingreso de jugadores, mientras las cuentas administradoras conservan acceso.',main='7.00.28',crop=(335,285,1965,855),marks=[(632,662,974,848),(1620,662,1817,718)],items=[('Estado','Elegí «Desactivado» o «Activado» en el selector.'),('Guardar','Aplicá el estado escogido con este botón.'),('Música','El altavoz del encabezado abre silencio y volumen; su captura aparece abajo.')],extra=['7.00.34'],extra_names=['Control de música y volumen']),
 dict(part='USUARIO',title='Crear cuenta y usar datos',lead='La cuenta se crea con datos personales, correo y contraseña. Leé el uso de datos antes de aceptar.',main='6.57.29',crop=(250,300,1740,1180),marks=[(880,500,1690,594),(880,700,1690,797),(880,900,1690,989),(880,1021,1690,1073)],items=[('Nombre y apellido','Completá tus datos personales.'),('Correo y contraseña','Usá un correo al que tengas acceso y una contraseña propia.'),('Privacidad','Leé el aviso y aceptá el uso de datos para crear la cuenta.'),('Crear cuenta','Enviá el formulario para registrarte.')],extra=['6.57.33'],extra_names=['Detalle del uso de datos']),
 dict(part='USUARIO',title='Ingresar y recuperar acceso',lead='Iniciá sesión con correo y contraseña. Si olvidaste la clave, solicitá un código de recuperación.',main='6.57.18',crop=(250,310,1740,1098),marks=[(880,580,1690,644),(880,700,1690,767),(880,795,1690,859),(1120,885,1465,916)],items=[('Correo','Ingresá el correo de tu cuenta.'),('Contraseña','Escribí la clave; «Mostrar» permite comprobarla.'),('Iniciar sesión','Entrá a METRONET.'),('Recuperación','Abrí «¿Olvidaste tu contraseña?» si no recordás la clave.')],extra=['6.57.41'],extra_names=['Enviar código de recuperación']),
 dict(part='USUARIO',title='Inicio y perfil',lead='Desde Inicio elegí Mi recorrido o Modo Libre. El menú de la cuenta abre Mi perfil y Cerrar sesión.',main='6.58.11',crop=(0,165,1987,1145),marks=[(266,563,980,1135),(1008,563,1725,1135),(1690,186,1945,244)],items=[('Mi recorrido','Comenzá la campaña por niveles.'),('Modo Libre','Diseñá y simulá una red propia.'),('Cuenta','Abrí el menú para entrar al perfil o cerrar sesión.')],extra=['6.58.15','6.58.29'],extra_names=['Menú de cuenta','Datos, correo y contraseña del perfil']),
 dict(part='USUARIO',title='Niveles y misión inicial',lead='Seleccioná Nivel 01, leé la misión y luego iniciá. El juego muestra la presentación del nivel y una tarjeta educativa.',main='6.58.35',crop=(115,285,1865,1095),marks=[(150,647,830,1050),(897,643,1845,999),(1615,1012,1837,1070)],items=[('Elegir nivel','Marcá el número del nivel. La tarjeta lateral resume su desafío.'),('Tu desafío','Leé la consigna antes de entrar.'),('Iniciar','Abrí la preparación del nivel seleccionado.')],extra=['7.00.44','7.00.48'],extra_names=['Preparación del Nivel 1','Tarjeta educativa previa']),
 dict(part='USUARIO',title='Tutorial y ayuda',lead='Al entrar a Edición, elegí si querés hacer la guía. La ayuda contextual puede volver a abrirse desde el encabezado.',main='7.00.53',crop=(0,260,1987,1240),marks=[(1050,550,1450,840),(1874,280,1919,330),(1430,350,1975,625)],items=[('Empezar el tutorial','La ventana propone una guía paso a paso; también permite ignorarla.'),('Ayuda','El botón amarillo de la cabecera vuelve a abrir la guía.'),('Metas','El panel indica objetivos y avance durante la edición.')],extra=['7.00.57','7.01.02'],extra_names=['Primer paso en el mapa','Ayuda contextual']),
 dict(part='USUARIO',title='Nivel 1 · construir la red',lead='Objetivo práctico: dos estaciones, una línea con su primer tramo, una conexión y una unidad de Metro.',main='7.01.02',crop=(1406,275,1980,1240),marks=[(1434,949,1562,1003),(1565,949,1693,1003),(1697,949,1826,1003),(1829,949,1958,1003)],items=[('Estaciones','Elegí estación y hacé clic en dos lugares distintos del mapa.'),('Línea','Elegí línea y conectá el primer par de estaciones.'),('Conexión','Extendé el recorrido con una conexión admitida por el nivel.'),('Metro','Elegí la unidad y asignala a la vía de la línea.')],extra=['7.01.14','7.01.17'],extra_names=['Red construida','Confirmación de guardado']),
 dict(part='USUARIO',title='Nivel 1 · simular y finalizar',lead='Con la red armada, guardá y entrá en Simulación. Allí aplicá las UV/UT, ejecutá la red actual y después volvé a Edición para finalizar.',main='7.01.22',crop=(0,270,1987,1230),marks=[(697,545,1290,869),(1647,376,1965,565),(1647,850,1965,1220)],items=[('Aviso UV/UT','Leé el aviso y continuá a la simulación.'),('Controles','Usá «Iniciar» para ejecutar la red actual y observá el recorrido.'),('Valores','Revisá velocidad y tiempo del Metro en el panel de simulación.')],extra=['7.01.32','6.58.45'],extra_names=['Tarjeta dentro de Simulación','Regla para aprobar y finalizar'],note='No se aportó una captura del resultado final. Al volver a Edición, usá «Finalizar red» para comprobar la consigna y la puntuación.'),
 dict(part='USUARIO',title='Modo Libre y capas del mapa',lead='Modo Libre permite construir una red propia y consultar referencias territoriales. Los Extras introducen cómo leer estas capas.',main='7.01.52',crop=(0,265,1987,1240),marks=[(1430,340,1970,610),(1430,620,1970,925),(1430,930,1970,1215)],items=[('Capas','Abrí los controles de población, tráfico y desplazamientos para comparar zonas.'),('Valores y línea','Configurá la línea y sus UV/UT de forma independiente.'),('Herramientas','Usá estaciones, líneas, conexiones, Metro y la búsqueda del mapa.')],extra=['7.01.46','7.01.49','7.02.00'],extra_names=['Presentación de Extras','Calles y avenidas','Puntos de interés']),
 dict(part='USUARIO',title='Guardar y recuperar diseños',lead='Guardá el trabajo antes de abandonar la edición. En Mis diseños podés localizar proyectos de niveles y de Modo Libre.',main='7.02.05',crop=(0,265,1987,1000),marks=[(450,440,1370,500),(480,640,830,810),(790,700,885,735)],items=[('Pestañas','Alterná entre Diseños de los niveles y Modo Libre.'),('Tarjeta','Identificá el diseño por nombre y nivel.'),('Acciones','Usá los controles de su tarjeta para volver a abrirlo o gestionarlo.')],extra=['7.02.08'],extra_names=['Diseño guardado de Modo Libre']),
 dict(part='USUARIO',title='Aprendizaje y reglas',lead='Las tarjetas quedan disponibles en Aprendizaje. Las reglas explican puntaje, aprobación y acciones de la partida.',main='6.58.38',crop=(115,285,1865,1010),marks=[(130,440,1860,510),(150,620,1850,980)],items=[('Elegir nivel','Abrí las tarjetas del nivel completado cuando quieras consultarlas.'),('Tarjetas','Seleccioná una para releer el hecho, su imagen, la idea clave y la fuente.')],extra=['6.58.42','6.58.45','6.58.48'],extra_names=['Puntuación','Cómo aprobar','Guardar, simular y finalizar']),
 dict(part='USUARIO',title='Velocidad, tiempo y ranking',lead='La velocidad y el tiempo pertenecen a cada línea. El ranking conserva la mejor marca lograda por nivel.',main='6.58.54',crop=(95,285,1885,1050),marks=[(100,460,985,590),(1000,460,1885,590),(100,600,990,805),(1000,600,1885,805)],items=[('Tiempo','1 UT representa una hora del escenario.'),('Velocidad','1 UV equivale a 1 km por UT.'),('Ejemplo','En 12 km, 4 UV requieren 3 UT y 6 UV requieren 2 UT.'),('Por línea','La red calcula cada línea de forma independiente; el reloj sigue la mayor duración.')],extra=['6.58.59','6.59.03'],extra_names=['Mejor marca por nivel','Clasificación y trofeos']),
]

used=[p['main'] for p in PAGES]+[x for p in PAGES for x in p['extra']]
all_keys=sorted(p.name.split(' a las ')[1].split(' ')[0] for p in CAP.glob('Captura*.png'))
assert set(all_keys)==set(used),(set(all_keys)-set(used),set(used)-set(all_keys))

def hexrgb(h):
    h=h.lstrip('#'); return RGBColor(*(int(h[i:i+2],16) for i in (0,2,4)))

def text_pdf(c,s,x,top,w,size=12,bold=False,color=INK,leading=None):
    style=ParagraphStyle('x',fontName='Calibri-Bold' if bold else 'Calibri',fontSize=size,leading=leading or size*1.21,textColor=HexColor(color))
    p=Paragraph(s,style); _,h=p.wrap(w,999);p.drawOn(c,x,top-h);return h

def fit_image(c,img,x,top,w,max_h):
    iw,ih=img.size; scale=min(w/iw,max_h/ih); ww=iw*scale;hh=ih*scale
    c.drawImage(ImageReader(img),x,top-hh,width=ww,height=hh)
    c.setStrokeColor(HexColor(LINE));c.rect(x,top-hh,ww,hh,fill=0,stroke=1)
    return ww,hh

def make_pdf(figs,extras):
    c=canvas.Canvas(str(PDF),pagesize=(PAGE_W,PAGE_H),pageCompression=1)
    c.setTitle('Manual METRONET — Administrador y Usuario')
    # Portada sobria; el logotipo queda sin alterar.
    c.setFillColor(HexColor(NAVY));c.rect(0,0,PAGE_W,PAGE_H,fill=1,stroke=0)
    c.setFillColor(HexColor(BLUE));c.rect(0,665,PAGE_W,9,fill=1,stroke=0)
    logo=Image.open(LOGO).convert('RGB'); fit_image(c,logo,350,550,300,235)
    text_pdf(c,'MANUAL METRONET',155,285,690,42,True,WHITE)
    text_pdf(c,'Parte 1 · Administrador   /   Parte 2 · Usuario',155,225,690,19,False,'#BBDCF4')
    text_pdf(c,'Guía visual y operativa de todas las funciones',155,180,690,15,False,'#BBDCF4')
    c.showPage()
    for idx,p in enumerate(PAGES,1):
        c.setFillColor(HexColor(WHITE));c.rect(0,0,PAGE_W,PAGE_H,fill=1,stroke=0)
        c.setFillColor(HexColor(NAVY));c.rect(0,678,PAGE_W,22,fill=1,stroke=0)
        c.setFillColor(HexColor(SKY));c.rect(0,678,170,4,fill=1,stroke=0)
        c.setFont('Calibri-Bold',12);c.setFillColor(HexColor(BLUE));c.drawString(42,645,'METRONET  /  MANUAL VISUAL')
        c.setFont('Calibri-Bold',10);c.setFillColor(HexColor(MUTED));c.drawRightString(958,647,'PARTE 1 · ADMINISTRADOR' if p['part']=='ADMINISTRADOR' else 'PARTE 2 · USUARIO')
        text_pdf(c,p['title'],42,632,916,29,True,NAVY)
        text_pdf(c,p['lead'],43,589,915,12,False,MUTED)
        main=figs[idx]; iw,ih=main.size
        # El mapa/editor se agranda; los formularios completos conservan proporción.
        view_w=625; view_h=min(355,view_w*ih/iw)
        fit_image(c,main,42,555,view_w,355)
        x=685; y=555
        for i,(title,desc) in enumerate(p['items'],1):
            hh=86 if len(p['items'])<=3 else 78
            c.setFillColor(HexColor(PALE if i%2 else WHITE));c.setStrokeColor(HexColor(LINE));c.roundRect(x,y-hh,273,hh-8,5,fill=1,stroke=1)
            c.setFillColor(HexColor(SHADES[(i-1)%len(SHADES)]));c.roundRect(x+10,y-31,25,25,4,fill=1,stroke=0)
            c.setFont('Calibri-Bold',12);c.setFillColor(HexColor(WHITE));c.drawCentredString(x+22.5,y-23,str(i))
            text_pdf(c,title,x+43,y-11,222,13,True,NAVY)
            text_pdf(c,desc,x+43,y-35,219,10.5,False,INK)
            y-=hh
        c.setStrokeColor(HexColor(LINE));c.line(42,184,958,184)
        c.setFont('Calibri-Bold',11);c.setFillColor(HexColor(BLUE));c.drawString(42,168,'OTRAS PANTALLAS DE ESTE PASO')
        n=len(p['extra']); tile_w=min(280,(916-(n-1)*14)/n)
        for j,(key,label) in enumerate(zip(p['extra'],p['extra_names'])):
            ex=42+j*(tile_w+14); im=extras[(idx,j)]
            if p.get('note'):
                text_pdf(c,label,ex,155,tile_w,10,True,INK)
                fit_image(c,im,ex,140,tile_w,70)
            else:
                fit_image(c,im,ex,153,tile_w,93)
                text_pdf(c,label,ex,54,tile_w,10,True,INK)
        if p.get('note'):
            c.setFillColor(HexColor(ICE));c.roundRect(42,33,916,30,4,fill=1,stroke=0)
            text_pdf(c,p['note'],52,56,896,9.5,False,DEEP)
        c.setStrokeColor(HexColor(LINE));c.line(42,25,958,25)
        c.setFont('Calibri',9);c.setFillColor(HexColor(MUTED));c.drawString(42,11,'Capturas reales · recorte del navegador · referencias numeradas')
        c.drawRightString(958,11,f'{idx+1}')
        c.showPage()
    c.save()

def shade(cell,color):
    tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd');shd.set(qn('w:fill'),color.lstrip('#'));tcPr.append(shd)

def set_cell_text(cell,text,size=10,bold=False,color=INK):
    cell.text='';p=cell.paragraphs[0];p.paragraph_format.space_after=Pt(0)
    r=p.add_run(text);r.bold=bold;r.font.name='Calibri';r.font.size=Pt(size);r.font.color.rgb=hexrgb(color)

def make_docx(figs,extras):
    d=Document();sec=d.sections[0];sec.page_width=Inches(12);sec.page_height=Inches(8.4);sec.orientation=WD_ORIENT.LANDSCAPE
    sec.top_margin=Inches(.38);sec.bottom_margin=Inches(.35);sec.left_margin=Inches(.55);sec.right_margin=Inches(.55)
    normal=d.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(10);normal.font.color.rgb=hexrgb(INK)
    normal.paragraph_format.space_after=Pt(4)
    for style,size,col in [('Title',29,NAVY),('Heading 1',21,NAVY),('Heading 2',12,BLUE)]:
        st=d.styles[style];st.font.name='Calibri';st.font.bold=True;st.font.size=Pt(size);st.font.color.rgb=hexrgb(col)
    for s in ('Normal','Title','Heading 1','Heading 2'):
        d.styles[s]._element.rPr.rFonts.set(qn('w:eastAsia'),'Calibri')
    p=d.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.add_run().add_picture(str(LOGO),width=Inches(3.5))
    p=d.add_paragraph('MANUAL METRONET','Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p=d.add_paragraph('Parte 1 · Administrador     /     Parte 2 · Usuario');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p=d.add_paragraph('Guía visual y operativa de todas las funciones');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    d.add_page_break()
    for idx,item in enumerate(PAGES,1):
        h=d.add_paragraph('PARTE 1 · ADMINISTRADOR' if item['part']=='ADMINISTRADOR' else 'PARTE 2 · USUARIO','Heading 2')
        if idx>1:h.paragraph_format.page_break_before=True
        h.paragraph_format.space_after=Pt(2)
        h=d.add_paragraph(item['title'],'Heading 1');h.paragraph_format.space_after=Pt(1)
        p=d.add_paragraph(item['lead']);p.paragraph_format.space_after=Pt(5)
        tbl=d.add_table(rows=1,cols=2);tbl.alignment=WD_TABLE_ALIGNMENT.CENTER;tbl.autofit=False
        tbl.columns[0].width=Inches(7.1);tbl.columns[1].width=Inches(3.8)
        left,right=tbl.rows[0].cells;left.width=Inches(7.1);right.width=Inches(3.8)
        shade(right,PALE)
        pp=left.paragraphs[0];pp.paragraph_format.space_after=Pt(0);pp.add_run().add_picture(str(FIG/f'main-{idx:02}.png'),width=Inches(7.0))
        right.text='';
        for i,(title,desc) in enumerate(item['items'],1):
            pp=right.add_paragraph();pp.paragraph_format.space_after=Pt(6)
            rr=pp.add_run(f'{i}  {title}\n');rr.bold=True;rr.font.name='Calibri';rr.font.size=Pt(12);rr.font.color.rgb=hexrgb(SHADES[(i-1)%len(SHADES)])
            rr=pp.add_run(desc);rr.font.name='Calibri';rr.font.size=Pt(10)
        p=d.add_paragraph('OTRAS PANTALLAS DE ESTE PASO','Heading 2');p.paragraph_format.space_before=Pt(7);p.paragraph_format.space_after=Pt(3)
        n=len(item['extra']);tab=d.add_table(rows=1,cols=n);tab.autofit=False
        width=min(3.0,10.9/n)
        for j,label in enumerate(item['extra_names']):
            cell=tab.cell(0,j);cell.width=Inches(width);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.TOP
            cp=cell.paragraphs[0];cp.paragraph_format.space_after=Pt(2)
            cp.add_run().add_picture(str(FIG/f'extra-{idx:02}-{j}.png'),width=Inches(width-.1))
            pp=cell.add_paragraph();pp.paragraph_format.space_after=Pt(0)
            r=pp.add_run(label);r.font.name='Calibri';r.bold=True;r.font.size=Pt(9);r.font.color.rgb=hexrgb(DEEP)
        if item.get('note'):
            pp=d.add_paragraph();pp.paragraph_format.space_before=Pt(4)
            rr=pp.add_run(item['note']);rr.font.name='Calibri';rr.font.size=Pt(9);rr.font.color.rgb=hexrgb(DEEP)
    core=d.core_properties;core.title='Manual METRONET — Administrador y Usuario';core.subject='Guía visual de METRONET'
    d.save(DOCX)

def main():
    figs={}; extras={}
    for idx,p in enumerate(PAGES,1):
        file=FIG/f'main-{idx:02}.png';figs[idx]=annotated(p['main'],p['crop'],p['marks'],file)
        if p['title']=='Nivel 1 · construir la red':
            overview=crop_img('7.01.14',(0,270,1405,1235))
            overview.thumbnail((900,620))
            zoom=figs[idx];zoom.thumbnail((370,620))
            combined=Image.new('RGB',(1300,660),'#07172C')
            combined.paste(overview,(10,32))
            combined.paste(zoom,(925,32))
            dr=ImageDraw.Draw(combined)
            ff=ImageFont.truetype(str(BOLD),25)
            dr.text((10,3),'MAPA DEL NIVEL',font=ff,fill='white')
            dr.text((925,3),'HERRAMIENTAS',font=ff,fill='white')
            combined.save(file,optimize=True);figs[idx]=combined
        for j,key in enumerate(p['extra']):
            im=crop_img(key);im.thumbnail((850,390));im.save(FIG/f'extra-{idx:02}-{j}.png',optimize=True);extras[(idx,j)]=im
    make_pdf(figs,extras);make_docx(figs,extras)
    print(PDF);print(DOCX);print('capturas únicas',len(set(used)),'páginas',len(PAGES)+1)

if __name__=='__main__':main()
