const formulario = document.getElementById("loginForm");
const mensaje = document.getElementById("mensaje");

formulario.addEventListener("submit", async function(evento) {
    evento.preventDefault();

    const datos = {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };

    const respuesta = await fetch("http://localhost:8080/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
    });

    if (respuesta.ok) {
        const usuario = await respuesta.json();

        localStorage.setItem("usuario", JSON.stringify(usuario));

        mensaje.textContent = "Login correcto";

        setTimeout(function() {
            window.location.href = "principal.html";
        }, 1000);
    } else {
        mensaje.textContent = "Email o contraseña incorrectos";
    }
});