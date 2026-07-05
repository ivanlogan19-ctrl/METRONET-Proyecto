const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async function(evento) {
  evento.preventDefault();

  const datos = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };

  if (!datos.email || !datos.password) {
    showMessage("Completá email y contraseña", "error");
    return;
  }

  try {
    setLoading(loginButton, true);
    showMessage("Validando credenciales...", "success");

    const respuesta = await fetch("http://localhost:8080/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    if (!respuesta.ok) {
      throw new Error("Email o contraseña incorrectos");
    }

    const usuario = await respuesta.json();
    localStorage.setItem("usuario", JSON.stringify(usuario));

    showMessage("Login correcto. Redirigiendo...", "success");

    setTimeout(() => {
      window.location.href = "principal.html";
    }, 900);
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setLoading(loginButton, false);
  }
});
