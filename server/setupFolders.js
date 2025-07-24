// server/setupFolders.js
const fs = require('fs');
const path = require('path');

function ensureEnvironment() {
  const basePath = process.cwd(); // Directorio donde se ejecuta el EXE

  const folders = ['branding', 'media', 'public', 'server'];
  folders.forEach(folder => {
    const fullPath = path.join(basePath, folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Carpeta creada: ${folder}`);
    }
  });

  const historialPath = path.join(basePath, 'server', 'historial.json');
  const datosPath = path.join(basePath, 'server', 'datos.json');

  if (!fs.existsSync(historialPath)) {
    fs.writeFileSync(historialPath, JSON.stringify([[], []], null, 2));
    console.log('📝 Archivo historial.json creado');
  }

  if (!fs.existsSync(datosPath)) {
    fs.writeFileSync(datosPath, JSON.stringify([], null, 2));
    console.log('📝 Archivo datos.json creado');
  }
}

module.exports = { ensureEnvironment };
