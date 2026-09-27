import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="app-container">
      <div className="main-content">
        {children}
      </div>
      <div className="bottom-bar">
        <div className="bottom-nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Map View</Link>
          <Link to="/analysis" className={location.pathname === '/analysis' ? 'active' : ''}>Analysis</Link>
        </div>
      </div>
    </div>
  );
}
