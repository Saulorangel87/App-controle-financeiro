import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);

// Registra o service worker (public/sw.js) depois que a página termina de
// carregar, para não competir por recursos de rede com o carregamento inicial.
// A checagem 'serviceWorker' in navigator evita erro em navegadores antigos
// que não suportam a API.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=7', { updateViaCache: 'none' }).catch((erro) => {
      console.error('Falha ao registrar o service worker:', erro);
    });
  });
}
