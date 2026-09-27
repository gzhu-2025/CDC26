function Chart({ country, onClose }) {
  return (
    <div className="chart-container" style={{ padding: '20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Chart {country ? `- ${country}` : ''}</h2>
        <button 
          onClick={onClose} 
          style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '24px', lineHeight: 1, padding: '0 8px', color: '#666' }}
        >
          &times;
        </button>
      </div>
      <div>
        <p>Chart data for {country}</p>
      </div>
    </div>
  );
}

export default Chart;
