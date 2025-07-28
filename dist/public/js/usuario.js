const socket = io();
const selector = document.getElementById('selector-dato');
const estado = document.getElementById('estado-dato');
const form = document.getElementById('formulario');
const container = document.getElementById('datos-container');

function actualizarSelector(datos) {
    const opcionesUnicas = [...new Set(datos.filter(d => d && d.trim() !== ''))];
    const opcionesOrdenadas = opcionesUnicas.sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

    selector.innerHTML = '<option value="">Seleccione una opción</option>';
    opcionesOrdenadas.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        selector.appendChild(opt);
    });
}

fetch('/api/datos')
    .then(res => res.json())
    .then(actualizarSelector);

socket.on('actualizar-datos', (datos) => {
    actualizarSelector(datos);
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = selector.value;
    const nuevoEstado = estado.value;
    if (!nombre || !nuevoEstado) return;

    socket.emit('actualizar-estado', { nombre, nuevoEstado });

    form.reset();
    selector.selectedIndex = 0;
    estado.innerHTML = '<option value="">Seleccione estado</option>';
});

function renderizarFilas(pacientes, estados) {
    container.innerHTML = `
                <div class="titulos-fila">
<div class="titulo" >Listado general de pacientes</div>

                </div>
            `;
    for (let i = 0; i < pacientes.length; i++) {
        container.innerHTML += `
                    <div class="fila">
                        <div class="dato izquierda">${pacientes[i]}</div>
                        <div class="dato derecha">${estados[i]}</div>
                    </div>
                `;
    }
}

socket.on('update', ([pacientes, estados]) => {
    renderizarFilas(pacientes, estados);

    const datosMap = {};
    for (let i = 0; i < pacientes.length; i++) {
        datosMap[pacientes[i]] = estados[i];
    }

    estado.innerHTML = '<option value="">Seleccione estado</option>';
    selector.onchange = () => {
        const sel = selector.value;
        const actual = datosMap[sel];
        const siguiente = getEstadoPermitido(actual);

        estado.innerHTML = '<option value="">Seleccione estado</option>';
        if (siguiente) {
            const opt = document.createElement('option');
            opt.value = siguiente;
            opt.textContent = siguiente;
            estado.appendChild(opt);
        } else if (!actual) {
            // Paciente nuevo
            ['En preparación'].forEach(e => {
                const opt = document.createElement('option');
                opt.value = e;
                opt.textContent = e;
                estado.appendChild(opt);
            });
        }
    };
});

function getEstadoPermitido(estadoActual) {
    const orden = ['En preparación', 'En cirugía', 'En recuperación'];
    const index = orden.indexOf(estadoActual);
    return orden[index + 1] || null;
}