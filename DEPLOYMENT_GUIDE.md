# 🚀 Guía de Deployment - Sistema de Roles y Seguridad

## ⚠️ IMPORTANTE: Pasos Obligatorios Antes de Usar el Sistema

### 1. Migrar la Base de Datos

El esquema de Prisma ha sido actualizado para incluir el sistema de roles. **Debes ejecutar las migraciones**:

```bash
cd Back
npx prisma migrate dev --name add-role-system
npx prisma generate
```

Esto hará lo siguiente:

- ✅ Crear el enum `Role` con los valores: ADMIN, TUTOR, STUDENT_PRO, STUDENT_FREE
- ✅ Agregar el campo `role` a la tabla `User` con valor por defecto `STUDENT_FREE`
- ✅ Regenerar el cliente de Prisma

### 2. Actualizar Contraseñas Existentes

⚠️ **CRÍTICO**: Los usuarios existentes tienen contraseñas en texto plano. Necesitas:

**Opción A: Recrear la base de datos (DESARROLLO)**

```bash
cd Back
npx prisma migrate reset
npx prisma migrate dev
npx prisma generate
```

**Opción B: Script de migración de contraseñas (PRODUCCIÓN)**

```bash
cd Back
node scripts/hash-existing-passwords.js
```

**Crear el script** en `Back/scripts/hash-existing-passwords.js`:

```javascript
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function hashExistingPasswords() {
  console.log("Iniciando migración de contraseñas...");

  const users = await prisma.user.findMany();

  for (const user of users) {
    // Solo hashear si no está hasheada (bcrypt hashes empiezan con $2)
    if (!user.password.startsWith("$2")) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const hashedAnswer = await bcrypt.hash(user.answerSecret, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          answerSecret: hashedAnswer,
        },
      });

      console.log(`✅ Usuario ${user.email} actualizado`);
    } else {
      console.log(`⏭️  Usuario ${user.email} ya tiene contraseña hasheada`);
    }
  }

  console.log("✅ Migración completada");
  await prisma.$disconnect();
}

hashExistingPasswords().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### 3. Crear Usuario Administrador

El primer usuario ADMIN debe ser creado manualmente:

**Opción A: Usando Prisma Studio**

```bash
cd Back
npx prisma studio
```

1. Abre la tabla `User`
2. Encuentra tu usuario
3. Cambia el campo `role` a `ADMIN`

**Opción B: Script SQL directo**

```bash
cd Back
npx prisma db execute --stdin
```

Luego ejecuta:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'tu-email@example.com';
```

**Opción C: Crear desde código**

```bash
cd Back
node scripts/create-admin.js
```

**Crear el script** en `Back/scripts/create-admin.js`:

```javascript
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function createAdmin() {
  const email = "admin@edusoft.com";
  const username = "Administrator";
  const password = "Admin123456"; // Cambiar
  const answerSecret = "my-secret-answer"; // Cambiar

  const hashedPassword = await bcrypt.hash(password, 10);
  const hashedAnswer = await bcrypt.hash(answerSecret, 10);

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      answerSecret: hashedAnswer,
      role: "ADMIN",
      profilePicture: "default-profile-picture.jpg",
    },
  });

  console.log("✅ Usuario ADMIN creado:", admin.email);
  await prisma.$disconnect();
}

createAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### 4. Configurar Variables de Entorno

Asegúrate de que tu archivo `.env` tenga estos valores configurados:

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# JWT Security (¡CAMBIAR EN PRODUCCIÓN!)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRATION="7d"

# Server
PORT=3000

# CORS
CORS_ORIGINS="http://localhost:5173,http://localhost:4173"

# Environment
NODE_ENV="development"
```

⚠️ **NUNCA** uses el JWT_SECRET de desarrollo en producción. Genera uno aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Actualizar Frontend - Cambios en Login

El método `login` en AuthContext ahora requiere dos parámetros:

```javascript
// Antes
login(userData);

// Ahora
login(userData, token);
```

Verifica que todos los lugares donde se llama `login` estén actualizados.

## 📋 Checklist de Deployment

Marca cada paso al completarlo:

### Backend

- [ ] Ejecutar `npx prisma migrate dev`
- [ ] Ejecutar `npx prisma generate`
- [ ] Hashear contraseñas existentes
- [ ] Crear usuario ADMIN
- [ ] Configurar `.env` con JWT_SECRET seguro
- [ ] Verificar CORS_ORIGINS para producción
- [ ] Instalar dependencias: `bun install` o `npm install`

### Frontend

- [ ] Instalar dependencias: `npm install`
- [ ] Verificar que API_URL apunte al backend correcto
- [ ] Actualizar llamadas a `login()` con token
- [ ] Probar flujo completo de autenticación

### Testing

- [ ] Registro de nuevo usuario
- [ ] Login con usuario nuevo
- [ ] Verificar que el token se guarda en localStorage
- [ ] Acceder a rutas protegidas
- [ ] Probar auto-logout por expiración (cambiar JWT_EXPIRATION a 1m para prueba)
- [ ] Login como ADMIN y acceder a `/admin/dashboard`
- [ ] Cambiar rol de un usuario
- [ ] Verificar badges de roles en navbar

## 🔍 Verificación del Sistema

### Test 1: Verificar Hashing de Contraseñas

```bash
cd Back
npx prisma studio
```

Las contraseñas deben verse así: `$2b$10$...` (60 caracteres)

### Test 2: Verificar JWT

Después de hacer login, copia el token de localStorage y decodifícalo en [jwt.io](https://jwt.io)

Debe contener:

```json
{
  "userId": "cuid...",
  "role": "STUDENT_FREE",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Test 3: Verificar Protección de Rutas

1. Sin login, intenta acceder a `/#/home` → Debe redirigir a `/#/login`
2. Como STUDENT_FREE, intenta acceder a `/#/admin/dashboard` → Debe redirigir a `/#/home`
3. Como ADMIN, accede a `/#/admin/dashboard` → Debe mostrar el panel

## 🐛 Troubleshooting

### Error: "Invalid token"

- Verifica que JWT_SECRET sea el mismo en backend
- Limpia localStorage y vuelve a hacer login

### Error: "Token expired"

- Normal si JWT_EXPIRATION es corto
- El sistema debe redirigir automáticamente al login

### Error: "Prisma Client validation error"

- Ejecuta `npx prisma generate` de nuevo
- Verifica que la migración se aplicó: `npx prisma migrate status`

### No puedo acceder como ADMIN

- Verifica en Prisma Studio que el role sea exactamente "ADMIN" (mayúsculas)
- Asegúrate de hacer logout y login de nuevo después de cambiar el rol

### Contraseña no coincide después de migración

- Las contraseñas antiguas en texto plano ya no funcionarán
- Usa "Recuperar contraseña" o crea nuevo usuario

## 📞 Soporte

Si encuentras problemas:

1. Verifica la consola del navegador (F12)
2. Verifica la consola del servidor backend
3. Revisa `SECURITY_DOCUMENTATION.md` para más detalles

## ✅ Sistema Listo

Una vez completados todos los pasos:

- ✨ Sistema de roles funcionando
- 🔒 Contraseñas hasheadas con bcrypt
- 🎫 Autenticación JWT implementada
- 🛡️ Rutas protegidas por rol
- 📊 Panel de administración accesible

¡El sistema está listo para usarse!
