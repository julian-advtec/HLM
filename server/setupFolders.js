const fs = require('fs');
const path = require('path');

const folders = [
    path.join(__dirname, '../branding'),
    path.join(__dirname, '../media')
];

const files = [
    {
        path: path.join(__dirname, 'historial.json'),
        defaultContent: JSON.stringify([[], []], null, 2)
    },
    {
        path: path.join(__dirname, 'datos.json'),
        defaultContent: JSON.stringify([], null, 2)
    }
];

function ensureEnvironment() {
    folders.forEach(folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            console.log(`📁 Carpeta creada: ${folder}`);
        }
    });

    files.forEach(file => {
        if (!fs.existsSync(file.path)) {
            fs.writeFileSync(file.path, file.defaultContent);
            console.log(`📄 Archivo creado: ${file.path}`);
        }
    });
}

module.exports = { ensureEnvironment };
