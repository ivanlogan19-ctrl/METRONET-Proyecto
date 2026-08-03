import Phaser from 'phaser';

let usuarios = [];

fetch('http://localhost:8080/api/usuarios')
    .then(response => response.json())
    .then(data => {
        usuarios = data;
        console.log("Usuarios desde Backend:", usuarios);
    })
    .catch(error => {
        console.error("Error conectando con Backend:", error);
    });


const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#222222',
    scene: {
        create
    }
};


function create() {

    this.add.text(50, 50, 'METRONET', {
        fontSize: '40px',
        fill: '#ffffff'
    });

    this.add.text(50, 120, 'Usuarios:', {
        fontSize: '24px',
        fill: '#ffffff'
    });

    setTimeout(() => {

        usuarios.forEach((usuario, index) => {

            this.add.text(
                50,
                170 + (index * 40),
                `${usuario.nombre} - ${usuario.rol}`,
                {
                    fontSize: '20px',
                    fill: '#ffffff'
                }
            );

        });

    }, 500);
}


new Phaser.Game(config);