// Perspectiva común: las ruedas y los rieles comparten el mismo punto de fuga.
export function crearDibujoEntradaModoLibre(canvas) {
  const c = canvas.getContext('2d');
  if (!c) throw new Error('No se pudo preparar la entrada de Modo Libre');
  function rect(x, y, ancho, alto, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(ancho), Math.round(alto));
  }
  function pol(puntos, color) {
    c.fillStyle = color;
    c.beginPath();
    puntos.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fill();
  }
  function arco(x, y, ancho, alto, paso, color) {
    pol([[x,y+alto],[x,y+paso*3],[x+paso,y+paso*3],[x+paso,y+paso*2],
      [x+paso*2,y+paso*2],[x+paso*2,y+paso],[x+paso*3,y+paso],[x+paso*3,y],
      [x+ancho-paso*3,y],[x+ancho-paso*3,y+paso],[x+ancho-paso*2,y+paso],
      [x+ancho-paso*2,y+paso*2],[x+ancho-paso,y+paso*2],[x+ancho-paso,y+paso*3],
      [x+ancho,y+paso*3],[x+ancho,y+alto]], color);
  }
  function tren(escala, suelo, tiempo) {
    c.save();
    c.translate(360, suelo - 57 * escala);
    c.scale(escala, escala);
    rect(-91,-151,182,197,'#071221');
    rect(-83,-143,166,176,'#c7d8e4');
    rect(-73,-154,146,14,'#8aa1b6');
    rect(-79,-135,158,38,'#071221');
    c.textAlign = 'center';
    c.fillStyle = '#ffd078';
    c.font = '10px Silkscreen';
    c.fillText('ESTACIÓN',0,-120);
    c.font = '15px Silkscreen';
    c.fillStyle = Math.floor(tiempo / 650) % 2 === 0 ? '#ffd078' : '#675637';
    c.fillText('MODO LIBRE',0,-103);
    rect(-72,-88,68,64,'#142d47'); rect(4,-88,68,64,'#142d47');
    rect(-64,-80,47,6,'#365570'); rect(12,-80,47,6,'#365570');
    rect(-70,-38,29,3,'#8da2bd'); rect(12,-38,29,3,'#8da2bd');
    rect(-83,-14,166,21,'#48b4ff'); rect(-83,7,166,5,'#70e5b1');
    rect(-72,17,25,13,'#ffe4a0'); rect(47,17,25,13,'#ffe4a0');
    rect(-30,19,60,9,'#637d94'); rect(-68,33,136,12,'#334b61');
    rect(-57,45,22,12,'#071221'); rect(35,45,22,12,'#071221');
    rect(-12,40,24,15,'#8296a9');
    c.restore();
  }
  return function dibujar(tiempo) {
    rect(0,0,720,450,'#060c1c');
    arco(44,30,632,420,25,'#1c3450'); arco(66,48,588,402,24,'#10243a');
    arco(118,90,484,360,20,'#294762'); arco(133,103,454,347,19,'#09172a');
    arco(197,149,326,301,15,'#243e57'); arco(210,159,300,291,14,'#07101f');
    arco(268,198,184,252,10,'#182d44'); arco(278,207,164,243,9,'#040a16');
    pol([[360,220],[192,450],[528,450]],'#0d1b2b');
    for (let i = 1; i <= 12; i++) {
      const y = 220 + i * i * 1.6, ancho = (y - 220) * .58, alto = Math.max(1,(y - 220) * .025);
      pol([[360-ancho,y],[360+ancho,y],[360+ancho+alto,y+alto],[360-ancho-alto,y+alto]],'#30465a');
    }
    pol([[359,220],[361,220],[266,450],[252,450]],'#66829c');
    pol([[359,220],[361,220],[468,450],[454,450]],'#66829c');
    for (const x of [91,614]) {
      rect(x,156,15,48,'#284c68'); rect(x+4,160,7,32,'#79caff');
    }
    const avance = Math.max(0,Math.min(1,tiempo / 3300));
    const suelo = 232 + 143 * avance * avance * (3 - 2 * avance);
    tren(.44 * (suelo - 220) / 46, suelo, tiempo);
  };
}
