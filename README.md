# SIT · Solicitudes de Ingreso y Traslado de Personal — Metalium SpA

App web (Vite + Supabase + Vercel) para gestionar solicitudes de ingreso y traslado
de personal a obra, con control de roles y flujo de aprobaciones.

Este paquete incluye el **inicio de sesión** completo (login, recuperación y reseteo
de contraseña), reutilizando los estilos y la lógica del proyecto GOL, adaptado al
esquema nuevo (`schema.sql`).

## Puesta en marcha

1. Crear un proyecto **nuevo** en Supabase (separado de GOL).
2. En Supabase → SQL Editor, pegar y ejecutar `schema.sql`.
3. Copiar credenciales: Supabase → Project Settings → API.
4. En la carpeta del proyecto:
   ```bash
   cp .env.example .env      # y completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
   npm install
   npm run dev               # desarrollo local
   npm run build             # build de producción (carpeta dist/)
   ```
5. Crear un usuario de prueba en Supabase → Authentication → Users, y su fila
   correspondiente en la tabla `perfiles` (mismo `id`, con `rol` y `activo = true`).

## Estructura

```
src/
  config.js            Roles del sistema (admin, rrhh, solicitante, aprobador)
  main.js              Entry point
  core/
    supabase.js        Cliente Supabase
    auth.js            Login / sesión / recuperación de contraseña
    state.js           Estado global
  ui/
    toast.js           Notificaciones (SweetAlert2)
  views/
    login.js           Pantalla de inicio de sesión
    forgot-password.js Recuperar contraseña
    reset-password.js  Definir nueva contraseña
    home.js            Pantalla de inicio provisoria (se reemplaza por el shell)
  styles/
    tokens.css base.css login.css home.css main.css
```

## Diferencias respecto a GOL

- La columna del rol en `perfiles` es **`rol`** (no `role`); no hay `telefono`.
- Roles: `admin`, `rrhh`, `solicitante`, `aprobador`.
- Se cargan además `centro_costo_id` y `es_gerente_operaciones` en la sesión.
- `storageKey` de la sesión: `sit_metalium_session` (no choca con la de GOL).

## Próximo paso

Construir el shell (sidebar + router) y la vista **nueva-solicitud**, que llama a la
función `crear_solicitud()` de la base de datos.
