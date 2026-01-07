# HU02 - Bloqueo por Intentos Fallidos

## Descripción General
Implementación del mecanismo de seguridad que bloquea cuentas de usuario tras múltiples intentos fallidos de login, para proteger la plataforma de ataques automatizados de fuerza bruta.

---

## Información del Requisito

| Propiedad | Valor |
|-----------|-------|
| **Tipo** | Requisito Funcional (RF) |
| **Complejidad** | 3 Story Points |
| **Responsable** | David Alejandro Quille Llumiguano |
| **Principio de Seguridad** | Disponibilidad / Autenticación |
| **Mapeo Common Criteria** | FIA_AFL.1 (Authentication failure handling) |

---

## Criterios de Aceptación

✅ **Bloqueo automático tras 3 intentos fallidos consecutivos**
- Después del tercer intento fallido, la cuenta se bloquea automáticamente
- El usuario no puede intentar login durante el período de bloqueo

✅ **Duración del bloqueo: 5 minutos**
- El bloqueo es temporal, no permanente
- El usuario puede intentar de nuevo después de 5 minutos

✅ **Reseteo de contador en login exitoso**
- Si el usuario ingresa las credenciales correctas, el contador se resetea a 0
- El campo `lockedUntil` se limpia

---

## Implementación Técnica

### 1. Cambios en el Modelo de Datos (Prisma)

#### Campos Agregados al Modelo `User`

```prisma
model User {
  // ...campos existentes...
  failedLoginAttempts Int       @default(0)  // Contador de intentos fallidos
  lockedUntil         DateTime?              // Timestamp hasta el cual la cuenta está bloqueada
  // ...relaciones...
}
```

**Justificación de cada campo:**

| Campo | Tipo | Por Defecto | Propósito |
|-------|------|-------------|----------|
| `failedLoginAttempts` | Int | 0 | Rastrea cuántos intentos fallidos consecutivos ha habido |
| `lockedUntil` | DateTime? | null | Almacena la fecha/hora hasta la cual la cuenta permanece bloqueada |

#### Migración de Base de Datos

Se ejecutó la migración con el comando:
```bash
npx prisma migrate dev --name add_failed_login_attempts_and_locked_until
```

**Script SQL generado:**
```sql
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP;
```

---

### 2. Lógica de Bloqueo en loginUserCtrl

#### Flujo de Autenticación (Diagrama de Flujo)

```
┌─ Inicio: Recibir credenciales (email, password)
│
├─ Validar campos requeridos
│  └─ Si faltan → Rechazar (400)
│
├─ Validar formato de email
│  └─ Si inválido → Rechazar (400)
│
├─ Buscar usuario en BD
│  └─ Si no existe → Rechazar (401)
│
├─ Verificar si cuenta está bloqueada
│  │ (lockedUntil > fecha_actual)
│  │
│  ├─ Si BLOQUEADA → Rechazar (403) con tiempo restante
│  └─ Si NO BLOQUEADA → Continuar
│
├─ ¿Ha expirado el bloqueo anterior?
│  │ (lockedUntil ≤ fecha_actual)
│  │
│  ├─ Si EXPIRADO → Resetear failedLoginAttempts y lockedUntil
│  └─ Si NO EXPIRADO → Continuar
│
├─ Verificar contraseña (comparar con hash bcrypt)
│  │
│  ├─ Si INCORRECTA:
│  │  ├─ Incrementar failedLoginAttempts += 1
│  │  ├─ ¿failedLoginAttempts >= 3?
│  │  │  ├─ SÍ → Bloquear cuenta
│  │  │  │      lockedUntil = ahora + 5 minutos
│  │  │  └─ NO → Solo incrementar contador
│  │  └─ Rechazar (401)
│  │
│  └─ Si CORRECTA:
│     ├─ Resetear failedLoginAttempts = 0
│     ├─ Resetear lockedUntil = null
│     ├─ Generar JWT
│     └─ Retornar token y datos (200)
│
└─ Fin
```

#### Implementación en Código

**Archivo:** `Back/src/controllers/user-ctrl.ts`

**Sección 1: Verificación de Bloqueo (líneas ~24-30)**
```typescript
// Verificar si la cuenta está bloqueada (HU02)
const now = new Date();
if (user.lockedUntil && user.lockedUntil > now) {
  const remainingTime = Math.ceil(
    (user.lockedUntil.getTime() - now.getTime()) / 1000 / 60
  );
  res.status(403).json({
    error: `Account is locked. Try again in ${remainingTime} minute(s)`,
  });
  return;
}
```

**Sección 2: Expiración de Bloqueo (líneas ~32-40)**
```typescript
// Si el bloqueo ha expirado, resetear los intentos fallidos
if (user.lockedUntil && user.lockedUntil <= now) {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}
```

**Sección 3: Incremento de Intentos Fallidos (líneas ~45-65)**
```typescript
if (!isPasswordValid) {
  // Incrementar contador de intentos fallidos (HU02)
  const newFailedAttempts = user.failedLoginAttempts + 1;
  const updateData: any = {
    failedLoginAttempts: newFailedAttempts,
  };

  // Si alcanza 3 intentos, bloquear por 5 minutos
  if (newFailedAttempts >= 3) {
    const lockUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos
    updateData.lockedUntil = lockUntil;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  res.status(401).json({ error: "Invalid credentials" });
  return;
}
```

**Sección 4: Reseteo en Login Exitoso (líneas ~68-74)**
```typescript
// Login exitoso: resetear contador de intentos fallidos (HU02)
await prisma.user.update({
  where: { id: user.id },
  data: {
    failedLoginAttempts: 0,
    lockedUntil: null,
  },
});
```

---

## Respuestas HTTP del Sistema

### 1. Cuenta Bloqueada (HTTP 403 Forbidden)
**Cuando:** El usuario intenta login pero su cuenta está bloqueada

```json
{
  "error": "Account is locked. Try again in 4 minute(s)"
}
```

**Cálculo del tiempo restante:**
```typescript
const remainingTime = Math.ceil(
  (user.lockedUntil.getTime() - now.getTime()) / 1000 / 60
);
// Conversión: milisegundos → segundos → minutos (redondeado hacia arriba)
```

### 2. Credenciales Inválidas (HTTP 401 Unauthorized)
**Cuando:** Email incorrecto, contraseña incorrecta, o intento fallido sin bloqueo

```json
{
  "error": "Invalid credentials"
}
```

**Nota de Seguridad:** No especificamos si fue el email o contraseña por razones de seguridad (prevenir enumeración de usuarios)

### 3. Login Exitoso (HTTP 200 OK)
**Cuando:** Las credenciales son correctas

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNsZTEyMzQ1Njc4OTAi...",
  "user": {
    "id": "cuid123456",
    "email": "usuario@example.com",
    "username": "usuario",
    "role": "STUDENT_FREE",
    "createdAt": "2026-01-06T10:30:00Z",
    "profilePicture": "default-profile-picture.jpg"
  }
}
```

### 4. Campos Faltantes (HTTP 400 Bad Request)
**Cuando:** Email o contraseña no se proporcionan

```json
{
  "error": "Email and password are required"
}
```

### 5. Email Inválido (HTTP 400 Bad Request)
**Cuando:** El formato del email no es válido

```json
{
  "error": "Invalid email format"
}
```

---

## Ejemplos de Uso - Casos Prácticos

### Caso 1: Usuario Olvida Contraseña

**Timeline:**
```
14:00:00 → Intento 1: Contraseña incorrecta
           Base de datos: failedLoginAttempts = 1, lockedUntil = null
           Respuesta: 401 "Invalid credentials"

14:00:30 → Intento 2: Contraseña incorrecta (intenta otra)
           Base de datos: failedLoginAttempts = 2, lockedUntil = null
           Respuesta: 401 "Invalid credentials"

14:01:00 → Intento 3: Contraseña incorrecta (últmo intento)
           Base de datos: failedLoginAttempts = 3, lockedUntil = 14:06:00
           Respuesta: 401 "Invalid credentials"

14:01:30 → Intento 4: Aún bloqueado
           Respuesta: 403 "Account is locked. Try again in 4 minute(s)"

14:06:00 → Después de 5 minutos, bloqueo expirado
           Base de datos: failedLoginAttempts se resetea a 0, lockedUntil = null
           Intento 5: Contraseña correcta
           Respuesta: 200 "Login successful" + token + user data
```

### Caso 2: Ataque Automatizado de Fuerza Bruta

**Escenario:** Bot intenta contraseñas automáticamente

```
Bot: 100 intentos por segundo durante 30 segundos

Sistema:
├─ Intento 1: failedLoginAttempts = 1
├─ Intento 2: failedLoginAttempts = 2
├─ Intento 3: failedLoginAttempts = 3, CUENTA BLOQUEADA ✓
├─ Intento 4+: Respuesta 403, sin incrementar contador
│  (el bloqueo sigue activo)
│
└─ Resultado: Después de 5 minutos se resetea automáticamente
   pero el ataque se ha detenido efectivamente
```

**Beneficio:** El bot debe esperar 5 minutos entre cada set de 3 intentos, haciendo impracticable el ataque de fuerza bruta.

### Caso 3: Login Exitoso Después de Intentos Fallidos

**Timeline:**
```
10:00:00 → Intento 1: Contraseña incorrecta
           failedLoginAttempts = 1

10:00:15 → Intento 2: Contraseña correcta (usuario recordó)
           ✓ RESETEO COMPLETO:
             - failedLoginAttempts = 0
             - lockedUntil = null
           Respuesta: 200 "Login successful" + token
```

**Beneficio:** El usuario no es penalizado indefinidamente por un error previo.

---

## Cambios en la Base de Datos

### Estructura de la Tabla `User` Actualizada

```sql
CREATE TABLE "User" (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  username            TEXT NOT NULL,
  password            TEXT NOT NULL,
  answerSecret        TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'STUDENT_FREE',
  createdAt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt           TIMESTAMP,
  profilePicture      TEXT DEFAULT 'default-profile-picture.jpg',
  failedLoginAttempts INTEGER DEFAULT 0,         -- ← NUEVO
  lockedUntil         TIMESTAMP,                  -- ← NUEVO
  /* otras columnas... */
);
```

### Datos de Ejemplo

| id | email | username | failedLoginAttempts | lockedUntil | Descripción |
|----|-------|----------|---------------------|-------------|-------------|
| 1 | user1@test.com | user1 | 0 | NULL | Usuario normal, sin intentos fallidos |
| 2 | user2@test.com | user2 | 2 | NULL | Usuario con 2 intentos fallidos |
| 3 | user3@test.com | user3 | 3 | 2026-01-06 14:05:00 | Usuario bloqueado hasta las 14:05 |

---

## Ventajas de Seguridad

| Aspecto | Beneficio | Impacto |
|--------|----------|--------|
| **Prevención de Fuerza Bruta** | Limita intentos automáticos a 3 cada 5 minutos | 🔒 Alto |
| **Protección de Datos** | Reduce riesgo de acceso no autorizado | 🔒 Alto |
| **Experiencia de Usuario** | Bloqueo temporal, no permanente | 👤 Moderado |
| **Auditabilidad** | Campos rastreables en BD para análisis | 📊 Moderado |
| **Cumplimiento** | Alineado con FIA_AFL.1 (Common Criteria) | ✓ Compliant |

---

## Testing Recomendado

### Test 1: Login Exitoso (Contraseña Correcta)
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "correct_password"
}
```

**Esperado:**
```
✓ Status: 200
✓ Retorna: token, user data
✓ BD: failedLoginAttempts = 0, lockedUntil = null
```

---

### Test 2: Primer Intento Fallido
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "wrong_password"
}
```

**Esperado:**
```
✓ Status: 401
✓ Mensaje: "Invalid credentials"
✓ BD: failedLoginAttempts = 1, lockedUntil = null
```

---

### Test 3: Segundo Intento Fallido
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "wrong_password2"
}
```

**Esperado:**
```
✓ Status: 401
✓ Mensaje: "Invalid credentials"
✓ BD: failedLoginAttempts = 2, lockedUntil = null
```

---

### Test 4: Tercer Intento Fallido (BLOQUEO ACTIVADO)
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "wrong_password3"
}
```

**Esperado:**
```
✓ Status: 401
✓ Mensaje: "Invalid credentials"
✓ BD: failedLoginAttempts = 3, lockedUntil = 2026-01-06 14:05:00
```

---

### Test 5: Intento Mientras Bloqueado
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "correct_password"  (incluso con contraseña correcta)
}
```

**Esperado:**
```
✓ Status: 403
✓ Mensaje: "Account is locked. Try again in 4 minute(s)"
✓ La contraseña NO se valida mientras esté bloqueado
```

---

### Test 6: Después de 5 minutos (Bloqueo Expirado)
```bash
(Esperar 5 minutos)

POST /api/auth/login
{
  "email": "user@example.com",
  "password": "correct_password"
}
```

**Esperado:**
```
✓ Status: 200
✓ Retorna: token, user data
✓ BD: failedLoginAttempts se resetea a 0, lockedUntil = null (automático)
```

---

## Notas de Seguridad e Implementación

⚠️ **Puntos Importantes:**

1. **Reseteo Automático**
   - El `failedLoginAttempts` se resetea **automáticamente** tras 5 minutos
   - No se requiere intervención de administrador para desbloquear
   - El usuario puede intentar de nuevo sin contactar soporte

2. **Bloqueo Temporal vs Permanente**
   - Este sistema solo implementa bloqueo **temporal** (5 minutos)
   - Para bloqueos **permanentes**, se necesitaría un campo adicional: `manuallyLockedBy`

3. **Consideraciones de Rendimiento**
   - Cada intento fallido requiere una actualización en BD
   - Con alta concurrencia, considerar caché de intentos fallidos en futuro

4. **Logging y Auditoría**
   - Se recomienda agregar logs de intentos fallidos para:
     - Detección de patrones de ataque
     - Análisis forense
     - Alertas de seguridad

5. **Comunicación al Usuario**
   - El mensaje "Account is locked" es claramente diferente de "Invalid credentials"
   - Esto permite al usuario saber si está bloqueado vs credenciales incorrectas

---

## Futuras Mejoras

🔜 **Recomendaciones para próximas versiones:**

- [ ] Registrar intentos fallidos en tabla `LoginAttempt` para auditoría
- [ ] Agregar alertas por email cuando se detecten patrones de ataque
- [ ] Implementar CAPTCHA después de 2 intentos fallidos
- [ ] Crear endpoint de administrador para desbloquear usuarios manualmente
- [ ] Implementar diferentes tiempos de bloqueo según tipo de usuario
- [ ] Usar Redis para cache de intentos fallidos (rendimiento)
- [ ] Agregar IP del cliente a los logs de intento fallido

---

## Comandos de Ejecución

### Aplicar Migración
```bash
cd Back/
npx prisma migrate dev --name add_failed_login_attempts_and_locked_until
```

### Verificar Cambios
```bash
npx prisma studio
# Luego inspeccionar la tabla User y verificar nuevas columnas
```

### Revertir Cambios (si es necesario)
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## Referencias

- **Especificación de Requisito:** HU02 - Bloqueo por Intentos Fallidos
- **Estándar de Seguridad:** Common Criteria (FIA_AFL.1)
- **Documentación Prisma:** https://www.prisma.io/docs/
- **OWASP Authentication Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

## Versión y Histórico

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 06 Ene 2026 | David Alejandro Quille | Implementación inicial de HU02 |

---

**Documento generado:** 06 de Enero, 2026  
**Última actualización:** 06 de Enero, 2026  
**Estado:** ✅ Implementado
