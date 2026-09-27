import React, { useState, useEffect } from 'react';

export default function Resources() {
  const [sources, setSources] = useState(null);

  useEffect(() => {
    fetch('/findings.json')
      .then(res => res.json())
      .then(data => setSources(data.sources))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'left', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1>Resources</h1>
      <p>Data sources used in this analysis:</p>
      {!sources && <p>Loading resources...</p>}
      {sources && (
        <ul>
          {sources.map((s, idx) => (
            <li key={idx} style={{ marginBottom: '1rem' }}>
              <strong>{s.name}</strong> - {s.detail}<br/>
              <em>Used for: {s.use}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
