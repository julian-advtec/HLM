const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const IP_LOCAL = '192.168.0.11';

const HISTORIAL_PATH = path.join(__dirname, 'historial.json');
const MEDIA_FOLDER = path.join(__dirname, '../media');
const DATOS_PATH = path.join(__dirname, 'datos.json');



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
app.use(express.static(path.join(__dirname, '../public')));
app.use('/media', express.static(path.join(__dirname, '../media')));


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
  datos.splice(index, 1);
  guardarDatos(datos);
  emitirDatosActualizados();
  res.json({ ok: true });
});

// ===================
// WebSocket
// ===================
io.on('connection', (socket) => {
  console.log('📡 Cliente conectado');

  // Enviar historial de columnas y datos actuales al conectar
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
    emitirDatosActualizados(); // Emitir a todos
  });
});

// ===================
// Iniciar servidor
// ===================
server.listen(PORT, IP_LOCAL, () => {
  console.log(`🟢 Servidor corriendo en http://${IP_LOCAL}:${PORT}`);
});



