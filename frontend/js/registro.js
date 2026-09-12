const formulario = document.getElementById("registroForm");
const mensaje = document.getElementById("mensaje");

formulario.addEventListener("submit", async function(evento) {
    evento.preventDefault();

    const datos = {
        nombre: document.getElementById("nombre").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };

    const respuesta = await fetch("http://localhost:8080/auth/registro", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
    });

    if (respuesta.ok) {
        mensaje.textContent = "Usuario creado correctamente";
        formulario.reset();

        setTimeout(function() {
            window.location.href = "login.html";
        }, 1000);
    } else {
        mensaje.textContent = "No se pudo crear el usuario";
    }
});