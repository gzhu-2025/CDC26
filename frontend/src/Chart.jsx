import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Chart() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const country = searchParams.get('country');

  return (
    <div>
      <h1>Chart {country ? `- ${country}` : ''}</h1>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}

export default Chart;
