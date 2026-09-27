const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf-8');

const startIdx = app.indexOf('<div className="map-legend">');
const endIdx = app.indexOf('<MapContainer', startIdx);

const replacement = `<div className="map-legend">
            <div className="legend-title">{selectedOption}</div>
            <div className="legend-scale">
              {(() => {
                let metricKey = 'intensity_12m';
                if (metricsCatalog) {
                  const found = Object.keys(metricsCatalog).find(k => metricsCatalog[k].label === selectedOption);
                  if (found) metricKey = found;
                }
                const s = SCALES[metricKey] || SCALES.intensity_12m;
                const colors = s.kind === 'diverging' ? DIV : SEQ;
                return colors.map((color, i) => {
                  const lo = i === 0 ? null : s.t[i - 1];
                  const hi = i < s.t.length ? s.t[i] : null;
                  let label = '';
                  if (lo == null) label = \`Up to \${hi}\`;
                  else if (hi == null) label = \`Over \${lo}\`;
                  else label = \`\${lo} to \${hi}\`;
                  
                  return (
                    <div className="legend-item" key={i}>
                      <div className="legend-color" style={{ backgroundColor: color }}></div>
                      <span>{label}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          `;

if (startIdx !== -1 && endIdx !== -1) {
    app = app.slice(0, startIdx) + replacement + app.slice(endIdx);
    fs.writeFileSync('frontend/src/App.jsx', app);
    console.log("Successfully replaced legend.");
} else {
    console.log("Could not find start or end index.");
}
