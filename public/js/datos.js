const lista = document.getElementById('lista-datos');
const form = document.getElementById('form-dato');
const input = document.getElementById('nuevo-dato');
const mensajeError = document.getElementById('mensaje-error');

const modal = document.getElementById('modal-confirmacion');
const modalTexto = document.getElementById('modal-texto');
const btnConfirmar = document.getElementById('btn-confirmar');
const btnCancelar = document.getElementById('btn-cancelar');

let datosActuales = [];
let indiceAEliminar = null;

async function cargarDatos() {
    const res = await fetch('/api/datos');
    datosActuales = await res.json();
    lista.innerHTML = '';

    datosActuales
        .slice()
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
        .forEach((d, i) => {
            const li = document.createElement('li');
            li.textContent = d;

            const btn = document.createElement('button');
            btn.textContent = 'X';

            btn.onclick = () => {
                indiceAEliminar = datosActuales.findIndex(x => x === d);
                modalTexto.textContent = `¿Estás seguro de eliminar el ingreso: "${d}"  ?`;
                modal.style.display = 'flex';
            };

            li.appendChild(btn);
            lista.appendChild(li);
        });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoValor = input.value.trim();

    // Validar si ya existe (ignorando mayúsculas/minúsculas)
    const existe = datosActuales.some(d => d.toLowerCase() === nuevoValor.toLowerCase());
    if (existe) {
        mensajeError.textContent = `El ingreso "${nuevoValor}" ya existe.`;
        return;
    }

    await fetch('/api/datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: nuevoValor })
    });

    input.value = '';
    mensajeError.textContent = '';
    cargarDatos();
});

btnConfirmar.onclick = async () => {
    if (indiceAEliminar !== null) {
        await fetch('/api/datos/' + indiceAEliminar, { method: 'DELETE' });
        indiceAEliminar = null;
        modal.style.display = 'none';
        cargarDatos();
    }
};

btnCancelar.onclick = () => {
    indiceAEliminar = null;
    modal.style.display = 'none';
};

window.onclick = function (event) {
    if (event.target === modal) {
        modal.style.display = 'none';
        indiceAEliminar = null;
    }
}

cargarDatos();


input.addEventListener('keydown', function (e) {

    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
        e.preventDefault();
    }
});
