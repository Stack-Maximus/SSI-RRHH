# Correo real para las notificaciones — guía de despliegue

Esto conecta la campanita interna con correos de verdad, usando Resend +
una Edge Function de Supabase. Son pasos que tienes que correr tú (necesitan
tu cuenta y tu CLI, no los puedo hacer desde aquí).

## 1. Crea tu cuenta en Resend

1. Ve a [resend.com](https://resend.com) y crea una cuenta (tiene plan gratis).
2. En el dashboard, genera una **API Key** (empieza con `re_`). Guárdala.
3. **Importante sobre el remitente**: sin verificar un dominio propio, Resend
   solo te deja enviar usando `onboarding@resend.dev` como remitente, y
   **solo a la casilla con la que te registraste** en Resend — no a
   cualquier destinatario. Para que llegue correo a cualquier persona de
   Metalium, necesitas verificar tu dominio (`metalium.cl`) en
   Resend → Domains. Toma unos minutos (agregar registros DNS).

## 2. Instala la CLI de Supabase (si no la tienes)

```bash
npm install -g supabase
```

## 3. Conecta la CLI a tu proyecto

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

`TU_PROJECT_REF` lo encuentras en la URL de tu proyecto en el dashboard de
Supabase (`https://supabase.com/dashboard/project/TU_PROJECT_REF`).

## 4. Configura el secreto y despliega la función

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase functions deploy send-email --no-verify-jwt
```

Si ya verificaste tu dominio y quieres usar tu propio remitente:

```bash
supabase secrets set FROM_EMAIL="SGC Metalium <notificaciones@metalium.cl>"
```

## 5. Consigue la URL de la función

Queda con esta forma:

```
https://TU_PROJECT_REF.supabase.co/functions/v1/send-email
```

## 6. Conecta la base de datos a la función

Abre `database/migracion_notificaciones_email.sql`, reemplaza los dos
valores de ejemplo por los tuyos reales:

```sql
alter database postgres set app.edge_function_url = 'https://TU_PROJECT_REF.supabase.co/functions/v1/send-email';
alter database postgres set app.edge_function_key = 'TU-ANON-KEY';  -- la de Project Settings → API
```

y corre el archivo completo en el SQL Editor.

## 7. Probar

Genera cualquiera de los 5 eventos que disparan notificación (por ejemplo,
reporta un ticket de postventa de prueba) y revisa si te llegó el correo.

Si no llega, revisa los logs de la función:

```bash
supabase functions logs send-email
```

o mira la tabla de resultados de las llamadas HTTP que hace Postgres:

```sql
select * from net._http_response order by created desc limit 5;
```

## Nota sobre el orden de estas dos migraciones

`migracion_notificaciones.sql` (la campanita) funciona sola, sin nada de
esto — puedes usarla desde ya. `migracion_notificaciones_email.sql` es un
paso aparte y posterior, solo cuando quieras que además llegue correo real.
