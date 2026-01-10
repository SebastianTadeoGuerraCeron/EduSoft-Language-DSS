import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * Script para hashear contraseñas existentes que están en texto plano
 * USO: node scripts/hash-existing-passwords.js
 */
async function hashExistingPasswords() {
  console.log("[INICIO] Iniciando migración de contraseñas...\n");

  try {
    const users = await prisma.user.findMany();
    let updated = 0;
    let skipped = 0;

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

        console.log(`[OK] Usuario ${user.email} actualizado`);
        updated++;
      } else {
        console.log(
          `[SKIP] Usuario ${user.email} ya tiene contraseña hasheada`
        );
        skipped++;
      }
    }

    console.log(`\n[RESUMEN]:`);
    console.log(`   Usuarios actualizados: ${updated}`);
    console.log(`   Usuarios omitidos: ${skipped}`);
    console.log(`\n[OK] Migración completada exitosamente`);
  } catch (error) {
    console.error("[ERROR] Error durante la migración:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

hashExistingPasswords();
