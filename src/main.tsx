import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import App from './App';
import './styles/index.css';

// Sin JIT: la política de seguridad (CSP) no permite eval y zod lo sondea en cada carga.
z.config({ jitless: true });
document.documentElement.dataset.theme = 'dark';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
