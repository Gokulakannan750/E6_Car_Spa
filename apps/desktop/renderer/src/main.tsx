import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';
import { applyStoredTheme } from './lib/theme';

applyStoredTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
 <App />
 </React.StrictMode>,
);
