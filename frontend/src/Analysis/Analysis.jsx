import React, { useState, useEffect } from 'react';

export default function Analysis() {
  const [findings, setFindings] = useState(null);

  useEffect(() => {
    fetch('/findings.json')
      .then(res => res.json())
      .then(data => setFindings(data.sections))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'left', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1>Analysis</h1>
      {!findings && <p>Loading analysis...</p>}
      {findings && findings.map((sec, idx) => (
        <div key={idx} style={{ marginBottom: '2rem' }}>
          <h2>{sec.heading}</h2>
          {sec.sentences && sec.sentences.map((s, sIdx) => (
            <p key={sIdx}>{s}</p>
          ))}
          {sec.how_we_know && (
            <p style={{ fontStyle: 'italic', color: '#666', fontSize: '0.9em' }}>
              How we know: {sec.how_we_know}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
