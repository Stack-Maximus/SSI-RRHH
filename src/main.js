/**
 * SSI-RRHH · Solicitudes de Ingreso y Traslado · Metalium SpA — Entry point
 */

import './styles/main.css';
import { Auth } from './core/auth.js';
import { Shell } from './core/shell.js';
import { Router } from './core/router.js';
import { Toast, Confirm } from './ui/toast.js';

// Globales para los handlers de las vistas (evita imports circulares)
window.Auth = Auth;
window.Shell = Shell;
window.Router = Router;
window.Toast = Toast;
window.Confirm = Confirm;

(async () => {
  Auth.init();
  await Auth.checkSession();
})();
