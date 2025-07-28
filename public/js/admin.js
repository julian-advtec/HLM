function login() {
    const usuario = document.getElementById('usuario').value;
    const clave = document.getElementById('clave').value;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave })
    })
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-interface').style.display = 'block';
                iniciarInterfazAdmin();
            } else {
                document.getElementById('error-msg').style.display = 'block';
            }
        });
}

function iniciarInterfazAdmin() {
    const socket = io();
    const buscador = document.getElementById('buscador-paciente');
    const container = document.getElementById('datos-container');
    const modal = document.getElementById('modal-confirmacion');
    const modalTexto = document.getElementById('modal-texto');
    const btnConfirmar = document.getElementById('btn-confirmar');
    const btnCancelar = document.getElementById('btn-cancelar');

    let pacientePendiente = null;
    let estadoPendiente = null;
    let selectPendiente = null;
    let estadosActuales = [];

    buscador.addEventListener('input', () => {
        const filtro = buscador.value.toLowerCase();
        const filas = container.querySelectorAll('.fila');
        filas.forEach(fila => {
            const nombre = fila.querySelector('.dato.izquierda').textContent.toLowerCase();
            fila.style.display = nombre.includes(filtro) ? 'flex' : 'none';
        });
    });

    function renderizarFilas(pacientes, estados) {
        container.innerHTML = `
        <div class="titulos-fila">
<div class="titulo" >Listado general de pacientes</div>
        </div>
    `;

        estadosActuales = [...estados];

        pacientes.forEach((paciente, i) => {
            const estadoActual = estados[i];

            const transiciones = {
                "En preparación": ["En preparación", "En cirugía"],
                "En cirugía": ["En cirugía", "En preparación", "En recuperación"],
                "En recuperación": ["En recuperación", "En cirugía"]
            };

            const opcionesPermitidas = transiciones[estadoActual] || [estadoActual];

            const opcionesHTML = opcionesPermitidas.map(estado =>
                `<option value="${estado}" ${estado === estadoActual ? 'selected' : ''}>${estado}</option>`
            ).join('');

            container.innerHTML += `
            <div class="fila">
                <div class="dato izquierda">${paciente}</div>
                <div class="dato derecha">
                    <select class="estado-select" data-paciente="${paciente}" data-index="${i}">
                        ${opcionesHTML}
                    </select>
                </div>
            </div>
        `;
        });

        document.querySelectorAll('.estado-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const paciente = e.target.dataset.paciente;
                const index = parseInt(e.target.dataset.index);
                const nuevoEstado = e.target.value;

                pacientePendiente = paciente;
                estadoPendiente = nuevoEstado;
                selectPendiente = e.target;

                modalTexto.textContent = `¿Estás seguro de cambiar el estado de "${paciente}" a "${nuevoEstado}"?`;
                modal.style.display = 'flex';
            });
        });
    }

    btnConfirmar.addEventListener('click', () => {
        fetch('/api/historial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paciente: pacientePendiente,
                estado: estadoPendiente
            })
        }).then(res => res.json())
            .then(resp => {
                if (!resp.ok) {
                    alert(resp.error || 'Error al cambiar estado');
                    selectPendiente.value = estadosActuales[selectPendiente.dataset.index];
                }
                cerrarModal();
            }).catch(err => {
                console.error('Error al enviar cambio:', err);
                selectPendiente.value = estadosActuales[selectPendiente.dataset.index];
                cerrarModal();
            });
    });

    btnCancelar.addEventListener('click', () => {
        const index = selectPendiente.getAttribute('data-index');
        selectPendiente.value = estadosActuales[index];
        cerrarModal();
    });

    function cerrarModal() {
        modal.style.display = 'none';
        pacientePendiente = null;
        estadoPendiente = null;
        selectPendiente = null;
    }

    socket.on('update', ([pacientes, estados]) => {
        renderizarFilas(pacientes, estados);
    });

    fetch('/api/historial')
        .then(res => res.json())
        .then(([pacientes, estados]) => renderizarFilas(pacientes, estados));
}