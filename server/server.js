const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const { ensureEnvironment } = require('./setupFolders');
ensureEnvironment();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const IP_LOCAL = '0.0.0.0'; // Escucha en toda la red

const BASE_PATH = process.cwd(); // Donde se ejecuta el EXE
const HISTORIAL_PATH = path.join(BASE_PATH, 'server', 'historial.json');
const DATOS_PATH = path.join(BASE_PATH, 'server', 'datos.json');
const MEDIA_FOLDER = path.join(BASE_PATH, 'media');

// ===================
// Inicializar columnas
// ===================
let columnas = [[], []];
try {
    const data = fs.readFileSync(HISTORIAL_PATH, 'utf8');
    columnas = JSON.parse(data);
    if (!Array.isArray(columnas) || columnas.length !== 2) throw new Error("Historial malformado");
} catch {
    columnas = [[], []];
    fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(columnas, null, 2));
}

// ===================
// Funciones para datos.json
// ===================
function leerDatos() {
    try {
        const raw = fs.readFileSync(DATOS_PATH, 'utf8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function guardarDatos(datos) {
    fs.writeFileSync(DATOS_PATH, JSON.stringify(datos, null, 2));
}

function emitirDatosActualizados() {
    const datos = leerDatos();
    io.emit('actualizar-datos', datos);
}

// ===================
// Rutas estáticas y API
// ===================
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/media', express.static(path.join(process.cwd(), 'media')));
app.use('/branding', express.static(path.join(process.cwd(), 'branding')));
app.use(express.json());

app.get('/media-files', (req, res) => {
    fs.readdir(MEDIA_FOLDER, (err, files) => {
        if (err) return res.status(500).json({ error: 'No se pudo leer la carpeta media' });
        const valid = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm'];
        const filtered = files.filter(f => valid.includes(path.extname(f).toLowerCase()));
        res.json(filtered);
    });
});

app.get('/api/datos', (req, res) => {
    res.json(leerDatos());
});

app.post('/api/datos', (req, res) => {
    const { valor } = req.body;
    if (typeof valor !== 'string' || !valor.trim()) {
        return res.status(400).json({ error: 'Dato inválido' });
    }

    const datos = leerDatos();
    datos.push(valor.trim());
    guardarDatos(datos);
    emitirDatosActualizados();

    res.json({ ok: true });
});

app.delete('/api/datos/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const datos = leerDatos();

    if (isNaN(index) || index < 0 || index >= datos.length) {
        return res.status(400).json({ error: 'Índice inválido' });
    }

    const eliminado = datos.splice(index, 1)[0];
    guardarDatos(datos);
    emitirDatosActualizados();

    fs.readFile(HISTORIAL_PATH, 'utf8', (err, data) => {
        if (!err) {
            try {
                let columnas = JSON.parse(data);
                let indices = [];

                for (let i = 0; i < columnas[0].length; i++) {
                    if (columnas[0][i] === eliminado) {
                        indices.push(i);
                    }
                }

                for (let i = indices.length - 1; i >= 0; i--) {
                    columnas[0].splice(indices[i], 1);
                    columnas[1].splice(indices[i], 1);
                }

                fs.writeFile(HISTORIAL_PATH, JSON.stringify(columnas, null, 2), err => {
                    if (err) console.error('Error actualizando historial tras eliminación:', err);
                    io.emit('update', columnas);
                });
            } catch (e) {
                console.error('Error procesando historial al eliminar:', e);
            }
        }
    });

    res.json({ ok: true });
});

// ===================
// WebSocket
// ===================
io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado');

    socket.emit('update', columnas);
    socket.emit('actualizar-datos', leerDatos());

    socket.on('nuevo-dato', ({ textos }) => {
        if (!Array.isArray(textos) || textos.length !== 2) return;

        columnas[0].unshift(textos[0]);
        columnas[1].unshift(textos[1]);

        columnas[0] = columnas[0].slice(0, 100);
        columnas[1] = columnas[1].slice(0, 100);

        fs.writeFile(HISTORIAL_PATH, JSON.stringify(columnas, null, 2), err => {
            if (err) console.error('❌ Error guardando historial:', err);
        });

        io.emit('update', columnas);
    });

    socket.on('agregar-dato', (nuevoDato) => {
        const datos = leerDatos();
        datos.push(nuevoDato);
        guardarDatos(datos);
        emitirDatosActualizados();
    });

    socket.on('actualizar-estado', ({ nombre, nuevoEstado }) => {
        fs.readFile(HISTORIAL_PATH, 'utf8', (err, data) => {
            if (err) return console.error('Error leyendo historial:', err);

            let columnas = [[], []];
            try {
                columnas = JSON.parse(data);
            } catch (e) {
                console.error('Error parseando historial:', e);
            }

            const indexExistente = columnas[0].indexOf(nombre);
            const estadoActual = indexExistente !== -1 ? columnas[1][indexExistente] : null;

            const orden = ['En preparación', 'En cirugía', 'En recuperación'];
            const idxActual = orden.indexOf(estadoActual);
            const idxNuevo = orden.indexOf(nuevoEstado);

            const esTransicionValida = (estadoActual === null && idxNuevo === 0) || (idxNuevo === idxActual + 1);
            if (!esTransicionValida) {
                console.log(`Transición inválida para ${nombre}: de ${estadoActual} a ${nuevoEstado}`);
                return;
            }

            if (indexExistente !== -1) {
                columnas[0].splice(indexExistente, 1);
                columnas[1].splice(indexExistente, 1);
            }

            columnas[0].push(nombre);
            columnas[1].push(nuevoEstado);

            fs.writeFile(HISTORIAL_PATH, JSON.stringify(columnas, null, 2), err => {
                if (err) return console.error('Error escribiendo historial:', err);
                io.emit('update', columnas);
            });
        });
    });
});

// ===================
// Iniciar servidor
// ===================
server.listen(PORT, IP_LOCAL, () => {
    console.log(`🟢 Servidor corriendo en http://${IP_LOCAL}:${PORT}`);
});
