# 🚀 Quick Start - Sistema de Roles y Seguridad

## ⚡ Inicio Rápido (5 minutos)

### 1. Migrar Base de Datos

```bash
cd Back
npx prisma migrate dev --name add-role-system
npx prisma generate
```

### 2. Crear Administrador

```bash
cd Back
node src/scripts/create-admin.js
```

Ingresa los datos cuando se solicite.

### 3. Iniciar Aplicación

**Backend:**

```bash
cd Back
bun run dev  # o npm run dev
```

**Frontend:**

```bash
cd Front
npm run dev
```

### 4. Probar el Sistema

1. Abre http://localhost:5173
2. Registra un nuevo usuario (será STUDENT_FREE)
3. Inicia sesión con el admin creado en paso 2
4. Accede a "🔐 Admin" en el navbar
5. Cambia el rol de usuarios

## ✅ Todo Completado

### Backend (100%)

- ✅ Sistema de roles (ADMIN, TUTOR, STUDENT_PRO, STUDENT_FREE)
- ✅ Hashing de contraseñas con bcrypt
- ✅ Autenticación JWT
- ✅ Middleware de autenticación y autorización
- ✅ Validación de entrada
- ✅ CORS configurado
- ✅ Variables de entorno
- ✅ Endpoints de administración
- ✅ Sanitización de inputs

### Frontend (100%)

- ✅ AuthContext con JWT y roles
- ✅ Interceptores HTTP automáticos
- ✅ Auto-logout por expiración
- ✅ ProtectedRoute por rol
- ✅ Validación de contraseñas con indicador visual
- ✅ Navbar dinámico por rol
- ✅ Panel de administración
- ✅ Badges de roles
- ✅ Manejo de sesiones expiradas

## 📚 Documentación

- **[SECURITY_DOCUMENTATION.md](SECURITY_DOCUMENTATION.md)** - Documentación técnica completa
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Guía paso a paso de deployment
- **[TECHNICAL_SUMMARY.md](TECHNICAL_SUMMARY.md)** - Resumen ejecutivo técnico

## 🔑 Credenciales de Prueba

Después de ejecutar el script de creación de admin, puedes crear usuarios con diferentes roles para pruebas:

- **Admin**: Creado con script `create-admin.js`
- **Tutor**: Cambiar rol desde panel admin
- **Student Pro**: Cambiar rol desde panel admin
- **Student Free**: Cualquier nuevo registro

## 🎯 Características Principales

### 🔐 Seguridad

- Contraseñas hasheadas (bcrypt)
- JWT con expiración (7 días)
- Auto-logout automático
- Validación robusta de entrada

### 👥 Sistema de Roles

- 4 niveles de acceso
- Control granular por ruta
- Panel de administración
- Cambio dinámico de roles

### 🎨 UI/UX

- Indicador de fortaleza de contraseña
- Badges visuales de roles
- Navegación adaptativa
- Mensajes claros de error

## 🛠️ Tecnologías

### Backend

- Node.js + TypeScript
- Express
- Prisma ORM
- PostgreSQL
- bcrypt + JWT

### Frontend

- React 19
- Vite
- Axios
- jwt-decode
- TailwindCSS

## 📊 API Endpoints

### Públicos

- `POST /user/create` - Registro
- `POST /user/login` - Login

### Protegidos

- `PUT /user/update-profile` - Actualizar perfil
- `GET /user/progress` - Ver progreso
- `GET /user/ranking` - Ver ranking

### Solo ADMIN

- `GET /user/admin/users` - Listar usuarios
- `PUT /user/admin/users/:id/role` - Cambiar rol
- `GET /user/admin/stats` - Estadísticas

## ⚠️ Importante

1. **Migrar DB**: Ejecuta las migraciones antes de usar
2. **Crear Admin**: Necesitas al menos un admin para gestionar roles
3. **JWT_SECRET**: Cambia en producción (genera con `openssl rand -hex 32`)
4. **CORS**: Actualiza `CORS_ORIGINS` para producción

## 🐛 Troubleshooting

**Error: "Property 'role' does not exist"**

```bash
cd Back
npx prisma generate
```

**No puedo acceder como ADMIN**

- Verifica el rol en Prisma Studio: `npx prisma studio`
- Debe ser exactamente "ADMIN" (mayúsculas)

**Token expirado constantemente**

- Ajusta `JWT_EXPIRATION` en `.env`
- Por defecto: "7d" (7 días)

## 📞 Scripts Útiles

```bash
# Hashear contraseñas existentes
node Back/src/scripts/hash-existing-passwords.js

# Crear admin interactivo
node Back/src/scripts/create-admin.js

# Ver base de datos
npx prisma studio

# Reset completo de DB (CUIDADO!)
npx prisma migrate reset
```

## 🎉 ¡Listo!

El sistema está completamente implementado y listo para usar. Consulta la documentación para más detalles técnicos.

---

**Desarrollado por**: Arquitecto Full-Stack Senior  
**Versión**: 1.0.0  
**Fecha**: Diciembre 2025
