const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf-8');

app = app.replace('<div className="map-legend">', '<div className={`map-legend ${isMenuOpen ? \'pushed-up\' : \'\'}`}>');

fs.writeFileSync('frontend/src/App.jsx', app);
