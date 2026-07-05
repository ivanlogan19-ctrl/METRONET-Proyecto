const registroForm = document.getElementById("registroForm");
const registroButton = document.getElementById("registroButton");

registroForm.addEventListener("submit", async function(evento) {
  evento.preventDefault();

  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };

  if (!datos.nombre || !datos.email || !datos.password) {
    showMessage("Completá todos los campos", "error");
    return;
  }

  try {
    setLoading(registroButton, true);
    showMessage("Creando usuario...", "success");

    const respuesta = await fetch("http://localhost:8080/auth/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo crear el usuario");
    }

    const usuario = await respuesta.json();
    localStorage.setItem("usuario", JSON.stringify(usuario));
    registroForm.reset();

    showMessage("Usuario creado correctamente. Redirigiendo...", "success");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setLoading(registroButton, false);
  }
});
