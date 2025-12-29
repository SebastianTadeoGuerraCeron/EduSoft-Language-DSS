import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import readline from "readline";

const prisma = new PrismaClient();

/**
 * Script interactivo para crear un usuario ADMIN
 * USO: node scripts/create-admin.js
 */
async function createAdmin() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  try {
    console.log("🔐 Creación de Usuario Administrador\n");

    const email = await question("Email del administrador: ");
    const username = await question("Nombre de usuario: ");
    const password = await question("Contraseña (mínimo 8 caracteres): ");
    const answerSecret = await question("Respuesta secreta: ");

    // Validar contraseña
    if (password.length < 8) {
      console.error("❌ La contraseña debe tener al menos 8 caracteres");
      process.exit(1);
    }

    // Verificar si el email ya existe
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.error(`❌ Ya existe un usuario con el email ${email}`);
      process.exit(1);
    }

    // Crear usuario
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

    console.log("\n✅ Usuario ADMIN creado exitosamente:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
  } catch (error) {
    console.error("❌ Error al crear administrador:", error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdmin();
