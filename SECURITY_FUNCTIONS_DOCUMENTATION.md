# Documentación de Funciones de Seguridad - EduSoft Language DSS

> **Requisito del Entregable**: "Código fuente debidamente documentado, con énfasis en las funciones de seguridad añadidas"

## Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Mapeo de Historias de Usuario a Implementación](#mapeo-de-historias-de-usuario-a-implementación)
3. [Mapeo Common Criteria (ISO/IEC 15408)](#mapeo-common-criteria-isoiec-15408)
4. [Arquitectura de Seguridad](#arquitectura-de-seguridad)
5. [Detalle de Módulos de Seguridad](#detalle-de-módulos-de-seguridad)
6. [Vectores de Ataque Mitigados](#vectores-de-ataque-mitigados)
7. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)

---

## Resumen Ejecutivo

EduSoft Language DSS implementa un sistema de seguridad multicapa que protege:

- **Autenticación de usuarios** mediante JWT con bcrypt (12 salt rounds)
- **Datos de pago** con cifrado AES-256-GCM y verificación HMAC-SHA256
- **Control de acceso** basado en roles (RBAC) con modelo freemium
- **Protección contra ataques** de fuerza bruta, replay, MITM y más

### Estadísticas de Implementación

| Categoría               | Archivos | Funciones | Líneas de Código |
| ----------------------- | -------- | --------- | ---------------- |
| Cifrado y Hashing       | 2        | 12        | ~450             |
| Middleware de Seguridad | 6        | 15        | ~800             |
| Logging y Auditoría     | 2        | 18        | ~400             |
| **Total**               | **10**   | **45**    | **~1650**        |

---

## Mapeo de Historias de Usuario a Implementación

### HU01 - Autenticación de Usuarios

| Requisito             | Archivo       | Función             | Descripción                             |
| --------------------- | ------------- | ------------------- | --------------------------------------- |
| Login seguro          | `security.ts` | `comparePassword()` | Verificación timing-safe de contraseñas |
| Token de sesión       | `security.ts` | `generateToken()`   | JWT con HS256, expiración 7 días        |
| Verificación de token | `auth.ts`     | `authenticate()`    | Middleware de validación JWT            |

### HU02 - Bloqueo por Intentos Fallidos de Login

| Requisito             | Archivo          | Función                  | Descripción                   |
| --------------------- | ---------------- | ------------------------ | ----------------------------- |
| Límite de 10 intentos | `rateLimiter.ts` | `loginLimiter`           | Bloqueo IP por 15 minutos     |
| Contador de fallos    | `rateLimiter.ts` | `skipSuccessfulRequests` | Solo cuenta intentos fallidos |

### HU03 - Validación de Calidad de Contraseñas (FIA_SOS.1)

| Requisito              | Archivo                 | Función                    | Descripción                      |
| ---------------------- | ----------------------- | -------------------------- | -------------------------------- |
| Mínimo 8 caracteres    | `passwordValidation.ts` | `validateStrongPassword()` | Longitud mínima                  |
| 1 mayúscula            | `passwordValidation.ts` | Regex `/[A-Z]/`            | Verificación de complejidad      |
| 1 número               | `passwordValidation.ts` | Regex `/\d/`               | Verificación de complejidad      |
| 1 carácter especial    | `passwordValidation.ts` | Regex especial             | Verificación de complejidad      |
| No contener username   | `passwordValidation.ts` | Validación cruzada         | Previene passwords predecibles   |
| No secuencias          | `passwordValidation.ts` | `COMMON_PASSWORDS[]`       | Diccionario + patrones           |
| Bcrypt 12 rounds       | `security.ts`           | `hashPassword()`           | Almacenamiento seguro            |
| Rate limiting registro | `rateLimiter.ts`        | `registrationLimiter`      | 5 intentos/15min por IP          |
| Logging de intentos    | `securityLogger.ts`     | `logWeakPasswordAttempt()` | Auditoría de contraseñas débiles |

### HU05 - Control de Acceso Freemium (FDP_ACC.1)

| Requisito                       | Archivo                 | Función                      | Descripción                |
| ------------------------------- | ----------------------- | ---------------------------- | -------------------------- |
| STUDENT_FREE → PREMIUM: Denegar | `checkPremiumAccess.ts` | `checkLessonPremiumAccess()` | Verifica lección.isPremium |
| STUDENT_PRO → Todo: Permitir    | `checkPremiumAccess.ts` | Fast-path en middleware      | Sin consulta a BD          |
| TUTOR lectura total             | `checkPremiumAccess.ts` | Fast-path en middleware      | Acceso completo            |
| Logging de accesos denegados    | `audit-ctrl.ts`         | `logSecurityEvent()`         | PREMIUM_ACCESS_DENIED      |

### HU06 - Re-autenticación para Acciones Críticas (FIA_UAU.6)

| Requisito              | Archivo             | Función                     | Descripción              |
| ---------------------- | ------------------- | --------------------------- | ------------------------ |
| Password en /billing   | `reAuthenticate.ts` | `requireReAuthentication()` | Header X-Reauth-Password |
| Verificación bcrypt    | `reAuthenticate.ts` | `bcrypt.compare()`          | Comparación timing-safe  |
| Logging de éxito/fallo | `audit-ctrl.ts`     | `logSecurityEvent()`        | REAUTH_SUCCESS/FAILED    |

### HU07 - Protección de Datos de Pago

| Requisito              | Archivo                  | Función                   | Descripción             |
| ---------------------- | ------------------------ | ------------------------- | ----------------------- |
| Canal cifrado HTTPS    | `transactionSecurity.ts` | `verifySecureChannel()`   | Rechazo de HTTP         |
| Headers de seguridad   | `transactionSecurity.ts` | `addSecurityHeaders()`    | CSP, X-Frame, HSTS      |
| Integridad HMAC-SHA256 | `transactionSecurity.ts` | `verifyHmac()`            | Timing-safe             |
| Prevención replay      | `transactionSecurity.ts` | `verifyNonce()`           | Nonces únicos, 5min TTL |
| Logging transacciones  | `securityLogger.ts`      | `logPaymentTransaction()` | Auditoría completa      |
| Detección MITM         | `transactionSecurity.ts` | `logProtocolDowngrade()`  | Alerta de degradación   |

### HU08 - Cifrado de Datos en Reposo

| Requisito                | Archivo         | Función                   | Descripción            |
| ------------------------ | --------------- | ------------------------- | ---------------------- |
| AES-256-GCM              | `encryption.ts` | `encrypt()`               | Cifrado autenticado    |
| IV único por operación   | `encryption.ts` | `generateIV()`            | 128 bits aleatorios    |
| AuthTag integridad       | `encryption.ts` | `cipher.getAuthTag()`     | 128 bits verificación  |
| Cifrado de tarjetas      | `encryption.ts` | `encryptCardData()`       | PAN, CVV, expiry       |
| Hash de integridad       | `encryption.ts` | `generateIntegrityHash()` | SHA-256 adicional      |
| Verificación timing-safe | `encryption.ts` | `verifyIntegrityHash()`   | crypto.timingSafeEqual |

---

## Mapeo Common Criteria (ISO/IEC 15408)

### Clase FIA - Identificación y Autenticación

| Componente | Nombre                                | Implementación                                   |
| ---------- | ------------------------------------- | ------------------------------------------------ |
| FIA_AFL.1  | Authentication failure handling       | `loginLimiter`, `registrationLimiter`            |
| FIA_SOS.1  | Verification of secrets               | `validateStrongPassword()`, `isStrongPassword()` |
| FIA_SOS.2  | TSF Generation of secrets             | Política de complejidad de contraseñas           |
| FIA_UAU.2  | User authentication before any action | `authenticate()` middleware                      |
| FIA_UAU.6  | Re-authenticating                     | `requireReAuthentication()`                      |
| FIA_UID.2  | User identification before any action | Extracción de userId del JWT                     |

### Clase FDP - Protección de Datos de Usuario

| Componente | Nombre                                          | Implementación                            |
| ---------- | ----------------------------------------------- | ----------------------------------------- |
| FDP_ACC.1  | Subset access control                           | `checkPremiumAccess()`, role-based checks |
| FDP_ACF.1  | Security attribute based access control         | userRole property en JWT                  |
| FDP_DAU.2  | Data Authentication with Identity               | AuthTag en AES-256-GCM                    |
| FDP_ITC.1  | Import of user data without security attributes | `encryptCardData()`                       |
| FDP_UCT.1  | Basic data exchange confidentiality             | `verifySecureChannel()`                   |
| FDP_UIT.1  | Data exchange integrity                         | `verifyHmac()`, `verifyIntegrityHash()`   |

### Clase FCS - Soporte Criptográfico

| Componente | Nombre                        | Implementación                            |
| ---------- | ----------------------------- | ----------------------------------------- |
| FCS_COP.1  | Cryptographic Operation       | AES-256-GCM, HMAC-SHA256, bcrypt          |
| FCS_CKM.1  | Cryptographic key generation  | `generateEncryptionKey()`, `generateIV()` |
| FCS_CKM.4  | Cryptographic key destruction | (Manejado por GC de Node.js)              |

### Clase FAU - Auditoría de Seguridad

| Componente | Nombre                        | Implementación                            |
| ---------- | ----------------------------- | ----------------------------------------- |
| FAU_GEN.1  | Audit data generation         | `logSecurityEvent()`, `logUserActivity()` |
| FAU_GEN.2  | User identity association     | userId en logs de auditoría               |
| FAU_SAR.1  | Audit review                  | Consola + BD separada de auditoría        |
| FAU_STG.1  | Protected audit trail storage | Base de datos `audit` separada            |

### Clase FPT - Protección del TSF

| Componente | Nombre                             | Implementación                          |
| ---------- | ---------------------------------- | --------------------------------------- |
| FPT_ITT.1  | Basic TSF data transfer protection | HTTPS obligatorio, headers de seguridad |
| FPT_RPL.1  | Replay detection                   | `verifyNonce()`, nonces con expiración  |
| FPT_RVM.1  | Non-bypassability of the TSP       | Middleware obligatorio en rutas         |

---

## Arquitectura de Seguridad

### Diagrama de Capas de Seguridad

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Browser)                          │
├─────────────────────────────────────────────────────────────────────┤
│                          HTTPS / TLS 1.3                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    RATE LIMITING LAYER                       │   │
│  │  registrationLimiter │ loginLimiter │ passwordRecoveryLimiter│   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   AUTHENTICATION LAYER                       │   │
│  │           authenticate() → JWT Verification                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  AUTHORIZATION LAYER                         │   │
│  │  checkPremiumAccess │ authorize │ requireReAuthentication    │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              TRANSACTION SECURITY LAYER                      │   │
│  │  verifySecureChannel │ verifyNonce │ verifyIntegrity         │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   BUSINESS LOGIC                             │   │
│  │                 Controllers & Services                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                                │   │
│  │     encryptCardData() │ hashPassword() │ Prisma ORM          │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┬──────────────────────────────────┐    │
│  │     Main Database       │        Audit Database            │    │
│  │  (Datos encriptados)    │   (Logs de seguridad)           │    │
│  └─────────────────────────┴──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detalle de Módulos de Seguridad

### 1. Módulo de Cifrado (`encryption.ts`)

**Propósito**: Cifrado de datos sensibles en reposo usando AES-256-GCM.

**Funciones Exportadas**:

| Función                           | Descripción              | Parámetros               | Retorno                        |
| --------------------------------- | ------------------------ | ------------------------ | ------------------------------ |
| `generateIV()`                    | Genera IV de 128 bits    | -                        | `Buffer`                       |
| `encrypt(plaintext)`              | Cifra texto plano        | `string`                 | `{encryptedData, iv, authTag}` |
| `decrypt(data, iv, tag)`          | Descifra datos           | `string, string, string` | `string`                       |
| `generateIntegrityHash(data)`     | Hash SHA-256             | `string`                 | `string (hex)`                 |
| `verifyIntegrityHash(data, hash)` | Verificación timing-safe | `string, string`         | `boolean`                      |
| `encryptCardData(cardData)`       | Cifra datos de tarjeta   | `CardData`               | `EncryptedCardData`            |
| `decryptCardData(encrypted)`      | Descifra tarjeta         | `EncryptedCardData`      | `CardData`                     |
| `detectCardBrand(number)`         | Detecta marca (VISA, MC) | `string`                 | `string`                       |
| `validateCardNumber(number)`      | Algoritmo de Luhn        | `string`                 | `boolean`                      |
| `generateEncryptionKey()`         | Genera clave 256-bit     | -                        | `string (hex)`                 |
| `generateTransactionId()`         | ID único de transacción  | -                        | `string`                       |

### 2. Módulo de Seguridad Core (`security.ts`)

**Propósito**: Funciones de autenticación, hashing y validación de input.

**Funciones Exportadas**:

| Función                              | Descripción             | Parámetros                 | Retorno            |
| ------------------------------------ | ----------------------- | -------------------------- | ------------------ |
| `hashPassword(password)`             | Hash bcrypt 12 rounds   | `string`                   | `Promise<string>`  |
| `comparePassword(plain, hash)`       | Comparación timing-safe | `string, string`           | `Promise<boolean>` |
| `generateToken(userId, role)`        | JWT HS256               | `string, string`           | `string`           |
| `isValidEmail(email)`                | Regex anti-ReDoS        | `string`                   | `boolean`          |
| `isStrongPassword(pwd, user, email)` | Validación completa     | `string, string?, string?` | `boolean`          |
| `sanitizeInput(input)`               | Limpieza XSS básica     | `string`                   | `string`           |

### 3. Módulo de Logging de Seguridad (`securityLogger.ts`)

**Propósito**: Registro de eventos de seguridad para auditoría y análisis forense.

**Eventos Registrados**:

| Evento                      | Severidad | Descripción                    |
| --------------------------- | --------- | ------------------------------ |
| `WEAK_PASSWORD_ATTEMPT`     | WARN      | Contraseña no cumple criterios |
| `REGISTRATION_SUCCESS`      | INFO      | Registro exitoso               |
| `REGISTRATION_FAILED`       | WARN      | Registro fallido               |
| `RATE_LIMIT_EXCEEDED`       | ERROR     | IP excedió límite              |
| `INSECURE_CHANNEL_ACCESS`   | CRITICAL  | Intento por HTTP               |
| `REPLAY_ATTACK_DETECTED`    | CRITICAL  | Nonce reutilizado              |
| `INTEGRITY_CHECK_FAILED`    | CRITICAL  | Hash no coincide               |
| `WEBHOOK_SIGNATURE_INVALID` | CRITICAL  | Firma de Stripe inválida       |

### 4. Middleware de Autenticación (`auth.ts`)

**Propósito**: Verificación de tokens JWT en cada request protegida.

**Interface Extendida**:

```typescript
interface AuthRequest extends Request {
  userId?: string; // UUID del usuario
  userRole?: string; // STUDENT_FREE | STUDENT_PRO | TUTOR | ADMIN
  reAuthenticated?: boolean; // Flag de HU06
  requiresPremiumCheck?: boolean; // Flag de HU05
}
```

### 5. Middleware de Rate Limiting (`rateLimiter.ts`)

**Configuración**:

| Limitador                 | Max Requests | Ventana | Endpoint                   |
| ------------------------- | ------------ | ------- | -------------------------- |
| `registrationLimiter`     | 5            | 15 min  | POST /user/register        |
| `loginLimiter`            | 10           | 15 min  | POST /user/login           |
| `passwordRecoveryLimiter` | 3            | 1 hora  | POST /user/forgot-password |

### 6. Middleware de Seguridad de Transacciones (`transactionSecurity.ts`)

**Funciones de Protección**:

| Función                         | Propósito                             |
| ------------------------------- | ------------------------------------- |
| `verifySecureChannel()`         | Verificar HTTPS                       |
| `addSecurityHeaders()`          | Headers anti-XSS, CSP, HSTS           |
| `verifyNonce()`                 | Detectar replay attacks               |
| `verifyIntegrity()`             | Verificar HMAC de datos               |
| `transactionRateLimiter`        | Límite específico para pagos          |
| `generateSecureTransactionId()` | IDs únicos de transacción             |
| `createSecureResponse()`        | Respuestas con metadatos de seguridad |

---

## Vectores de Ataque Mitigados

### Autenticación

| Ataque                  | Mitigación                   | Módulo                         |
| ----------------------- | ---------------------------- | ------------------------------ |
| **Brute Force**         | Rate limiting 10/15min       | `rateLimiter.ts`               |
| **Dictionary Attack**   | Lista de contraseñas comunes | `passwordValidation.ts`        |
| **Credential Stuffing** | Rate limiting + validación   | Múltiples                      |
| **Rainbow Tables**      | bcrypt con salt único        | `security.ts`                  |
| **Timing Attack**       | Comparación timing-safe      | `security.ts`, `encryption.ts` |

### Datos de Pago

| Ataque                 | Mitigación                 | Módulo                                    |
| ---------------------- | -------------------------- | ----------------------------------------- |
| **MITM**               | HTTPS obligatorio          | `transactionSecurity.ts`                  |
| **Replay Attack**      | Nonces con expiración 5min | `transactionSecurity.ts`                  |
| **Data Tampering**     | HMAC-SHA256 + AuthTag      | `transactionSecurity.ts`, `encryption.ts` |
| **Protocol Downgrade** | Rechazo de HTTP            | `transactionSecurity.ts`                  |
| **Data Breach**        | AES-256-GCM en reposo      | `encryption.ts`                           |

### Sesiones

| Ataque                   | Mitigación                    | Módulo              |
| ------------------------ | ----------------------------- | ------------------- |
| **Session Hijacking**    | Re-autenticación en /billing  | `reAuthenticate.ts` |
| **Token Forgery**        | JWT firmado con HS256         | `security.ts`       |
| **Privilege Escalation** | Role verification por request | `auth.ts`           |

### Web

| Ataque               | Mitigación                         | Módulo                   |
| -------------------- | ---------------------------------- | ------------------------ |
| **XSS**              | Headers de seguridad, sanitización | `transactionSecurity.ts` |
| **Clickjacking**     | X-Frame-Options: DENY              | `transactionSecurity.ts` |
| **Content Sniffing** | X-Content-Type-Options: nosniff    | `transactionSecurity.ts` |
| **ReDoS**            | Regex optimizadas                  | `security.ts`            |

---

## Configuración de Variables de Entorno

### Variables Críticas de Seguridad

```env
# Clave de cifrado AES-256 (64 caracteres hex = 32 bytes)
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-character-hex-key-here

# Clave separada para HMAC de transacciones (opcional, usa ENCRYPTION_KEY si no existe)
TRANSACTION_HMAC_KEY=your-64-character-hex-key-here

# Secreto para firma de JWT
JWT_SECRET=your-jwt-secret-here

# Expiración de tokens JWT
JWT_EXPIRATION=7d

# Secreto de webhook de Stripe
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Generación Segura de Claves

```bash
# Generar ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Conclusión

La implementación de seguridad de EduSoft Language DSS cumple con:

1.  **Todas las Historias de Usuario de Seguridad** (HU01-HU08)
2.  **Mapeo completo a Common Criteria** (FIA, FDP, FCS, FAU, FPT)
3.  **Protección multicapa** contra vectores de ataque conocidos
4.  **Auditoría completa** de eventos de seguridad
5.  **Cifrado de datos sensibles** en tránsito y reposo

---

_Documento generado automáticamente como parte del entregable de seguridad._
Última actualización: 11/01/2026
