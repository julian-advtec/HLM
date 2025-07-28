const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const isPkg = typeof process.pkg !== 'undefined';
const BASE_PATH = isPkg ? path.dirname(process.execPath) : __dirname;

// Rutas absolutas
const PUBLIC_FOLDER = path.join(BASE_PATH, 'public');
const BRANDING_FOLDER = path.join(BASE_PATH, 'branding');
const MEDIA_FOLDER = path.join(BASE_PATH, 'media');
const SERVER_FOLDER = path.join(BASE_PATH, 'server');

const HISTORIAL_PATH = path.join(SERVER_FOLDER, 'historial.json');
const DATOS_PATH = path.join(SERVER_FOLDER, 'datos.json');

// Crear carpetas si no existen
[PUBLIC_FOLDER, BRANDING_FOLDER, MEDIA_FOLDER, SERVER_FOLDER].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Crear archivos si no existen
if (!fs.existsSync(HISTORIAL_PATH)) fs.writeFileSync(HISTORIAL_PATH, JSON.stringify([[], []], null, 2));
if (!fs.existsSync(DATOS_PATH)) fs.writeFileSync(DATOS_PATH, JSON.stringify([], null, 2));

// Leer historial
let columnas = [[], []];
try {
    columnas = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));
    if (!Array.isArray(columnas) || columnas.length !== 2) throw new Error('Historial malformado');
} catch {
    columnas = [[], []];
}

// Utilidades
function leerDatos() {
    try {
        return JSON.parse(fs.readFileSync(DATOS_PATH, 'utf8'));
    } catch {
        return [];
    }
}

function guardarDatos(datos) {
    fs.writeFileSync(DATOS_PATH, JSON.stringify(datos, null, 2));
}

function emitirDatosActualizados() {
    io.emit('actualizar-datos', leerDatos());
}

// Middlewares
app.use(express.json());
app.use(express.static(PUBLIC_FOLDER));
app.use('/media', express.static(MEDIA_FOLDER));
app.use('/branding', express.static(BRANDING_FOLDER));

// Rutas limpias para HTML (🆕 AGREGADO)
app.get('/usuario', (req, res) => {
    res.sendFile(path.join(PUBLIC_FOLDER, 'html', 'usuario.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(PUBLIC_FOLDER, 'html', 'admin.html'));
});
app.get('/tv', (req, res) => {
    res.sendFile(path.join(PUBLIC_FOLDER, 'html', 'tv.html'));
});
app.get('/datos', (req, res) => {
    res.sendFile(path.join(PUBLIC_FOLDER, 'html', 'datos.html'));
});

// Endpoints
app.get('/media-files', (req, res) => {
    fs.readdir(MEDIA_FOLDER, (err, files) => {
        if (err) return res.status(500).json({ error: 'No se pudo leer la carpeta media' });
        const extensiones = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm'];
        const filtrados = files.filter(f => extensiones.includes(path.extname(f).toLowerCase()));
        res.json(filtrados);
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

    try {
        let historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));
        let indices = [];

        for (let i = 0; i < historial[0].length; i++) {
            if (historial[0][i] === eliminado) {
                indices.push(i);
            }
        }

        for (let i = indices.length - 1; i >= 0; i--) {
            historial[0].splice(indices[i], 1);
            historial[1].splice(indices[i], 1);
        }

        fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historial, null, 2));
        io.emit('update', historial);
    } catch (e) {
        console.error('Error procesando historial al eliminar:', e);
    }

    res.json({ ok: true });
});

// Confirmar cambio de estado desde usuario.html o admin.html
app.post('/api/historial', (req, res) => {
    const { paciente, estado } = req.body;

    if (!paciente || !estado) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        let historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));

        const orden = ['En preparación', 'En cirugía', 'En recuperación'];
        const indexExistente = historial[0].lastIndexOf(paciente);
        const estadoActual = indexExistente !== -1 ? historial[1][indexExistente] : null;

        const idxActual = orden.indexOf(estadoActual);
        const idxNuevo = orden.indexOf(estado);

        const esValido = (estadoActual === null) || (Math.abs(idxNuevo - idxActual) === 1);

        if (!esValido) {
            return res.status(400).json({ error: 'Cambio de estado inválido' });
        }

        if (indexExistente !== -1) {
            historial[0].splice(indexExistente, 1);
            historial[1].splice(indexExistente, 1);
        }

        historial[0].push(paciente);
        historial[1].push(estado);

        fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historial, null, 2));
        io.emit('update', historial);

        res.json({ ok: true });
    } catch (e) {
        console.error('Error al actualizar historial:', e);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/api/historial', (req, res) => {
    try {
        const historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));
        res.json(historial);
    } catch (e) {
        res.status(500).json({ error: 'No se pudo leer el historial' });
    }
});

// WebSockets
io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado');

    // Leer historial en tiempo real (no usar variable columnas)
    try {
        const historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));
        socket.emit('update', historial);
    } catch (e) {
        console.error('Error al leer historial en conexión:', e);
        socket.emit('update', [[], []]);
    }

    socket.emit('actualizar-datos', leerDatos());

    socket.on('nuevo-dato', ({ textos }) => {
        if (!Array.isArray(textos) || textos.length !== 2) return;

        let historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));

        historial[0].unshift(textos[0]);
        historial[1].unshift(textos[1]);

        historial[0] = historial[0].slice(0, 100);
        historial[1] = historial[1].slice(0, 100);

        fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historial, null, 2));
        io.emit('update', historial);
    });

    socket.on('agregar-dato', (nuevoDato) => {
        const datos = leerDatos();
        datos.push(nuevoDato);
        guardarDatos(datos);
        emitirDatosActualizados();
    });

    socket.on('actualizar-estado', ({ nombre, nuevoEstado }) => {
        try {
            let historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));

            const nuevasColumnas = [[], []];
            for (let i = 0; i < historial[0].length; i++) {
                if (historial[0][i] !== nombre) {
                    nuevasColumnas[0].push(historial[0][i]);
                    nuevasColumnas[1].push(historial[1][i]);
                }
            }

            nuevasColumnas[0].push(nombre);
            nuevasColumnas[1].push(nuevoEstado);

            fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(nuevasColumnas, null, 2));
            io.emit('update', nuevasColumnas);
        } catch (e) {
            console.error('Error al actualizar estado:', e);
        }
    });
});

app.post('/api/confirmar-estado', (req, res) => {
    const { paciente, estado } = req.body;

    if (!paciente || !estado) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {
        let historial = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));

        const nuevasColumnas = [[], []];
        for (let i = 0; i < historial[0].length; i++) {
            if (historial[0][i] !== paciente) {
                nuevasColumnas[0].push(historial[0][i]);
                nuevasColumnas[1].push(historial[1][i]);
            }
        }

        nuevasColumnas[0].push(paciente);
        nuevasColumnas[1].push(estado);

        fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(nuevasColumnas, null, 2));

        io.emit('update', nuevasColumnas);
        res.json({ ok: true });
    } catch (e) {
        console.error('Error al confirmar estado:', e);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { usuario, clave } = req.body;
    try {
        const usuarios = JSON.parse(fs.readFileSync(path.join(SERVER_FOLDER, 'usuarios.json'), 'utf8'));
        const existe = usuarios.some(u => u.usuario === usuario && u.clave === clave);
        res.json({ ok: existe });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'Error leyendo usuarios' });
    }
});

// Iniciar servidor
const PORT = 8081;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
});
