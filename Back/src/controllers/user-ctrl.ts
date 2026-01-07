import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { validateStrongPassword } from "../middleware/passwordValidation";
import { transporter } from "../nodemailer";
import {
    comparePassword,
    generateToken,
    hashPassword,
    isStrongPassword,
    isValidEmail,
    sanitizeInput,
} from "../utils/security";
import {
    logRegistrationFailed,
    logRegistrationSuccess,
    logWeakPasswordAttempt,
} from "../utils/securityLogger";

const prisma = new PrismaClient();

const createUserCtrl = async (req: Request, res: Response) => {
  const { email, username, password, answerSecret, role } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

  if (!email || !username || !password || !answerSecret) {
    await logRegistrationFailed(email || "unknown", ipAddress, "Missing fields");
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  // Validar email
  if (!isValidEmail(email)) {
    await logRegistrationFailed(email, ipAddress, "Invalid email format");
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  // HU03: Validar fortaleza de contraseña con criterios robustos
  const passwordValidation = validateStrongPassword(password, username, email);
  if (!passwordValidation.isValid) {
    // Log del intento de contraseña débil
    await logWeakPasswordAttempt(
      username,
      email,
      ipAddress,
      passwordValidation.errors
    );

    res.status(400).json({
      error: "Password does not meet security requirements",
      details: passwordValidation.errors,
    });
    return;
  }

  try {
    // Sanitizar inputs
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedAnswerSecret = sanitizeInput(answerSecret);

    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);
    const hashedAnswerSecret = await hashPassword(sanitizedAnswerSecret);

    // Determinar rol (por defecto STUDENT_FREE)
    // Validar que el rol sea válido (TUTOR o STUDENT_FREE)
    const validRoles = ["TUTOR", "STUDENT_FREE"];
    const userRole = validRoles.includes(role) ? role : "STUDENT_FREE";

    const user = await prisma.user.create({
      data: {
        email,
        username: sanitizedUsername,
        password: hashedPassword,
        answerSecret: hashedAnswerSecret,
        role: userRole,
        profilePicture: "default-profile-picture.jpg",
      },
    });

    // HU03: Log de registro exitoso
    await logRegistrationSuccess(
      sanitizedUsername,
      email,
      ipAddress,
      userRole
    );

    console.log("User created successfully");
    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    
    if (error.code === "P2002") {
      await logRegistrationFailed(email, ipAddress, "Email already exists");
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    
    await logRegistrationFailed(email, ipAddress, "Internal server error");
    res.status(500).json({ error: "Internal server error" });
  }
};

const loginUserCtrl = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  // Validar formato de email
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

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

    // Comparar contraseñas con bcrypt
    const isPasswordValid = await comparePassword(password, user.password);

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

        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        // Respuesta de bloqueo después del 3er intento
        res.status(403).json({
          error: "Account locked. Too many failed attempts. Try again in 5 minutes",
        });
        return;
      }

      // Si no ha alcanzado 3 intentos, mostrar intentos restantes
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      const attemptsRemaining = 3 - newFailedAttempts;
      res.status(401).json({
        error: `Invalid credentials. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? "s" : ""} remaining before account lockout`,
      });
      return;
    }

    // Login exitoso: resetear contador de intentos fallidos (HU02)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Generar token JWT
    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const recoverPasswordCtrl = async (req: Request, res: Response) => {
  const { email, answerSecret, newPassword } = req.body;

  if (!email || !answerSecret || !newPassword) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  // Validar formato de email
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  // Validar fortaleza de la nueva contraseña
  if (!isStrongPassword(newPassword)) {
    res.status(400).json({
      error:
        "Password must be at least 8 characters long and contain uppercase, lowercase, and numbers",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Comparar respuesta secreta con bcrypt
    const isAnswerValid = await comparePassword(
      answerSecret,
      user.answerSecret
    );

    if (!isAnswerValid) {
      res.status(401).json({ error: "Secret answer is incorrect" });
      return;
    }

    // Hash de la nueva contraseña
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error recovering password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateProfileCtrl = async (req: Request, res: Response) => {
  const { email, username, newPassword, profilePicture } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const data: any = {};

    if (username) {
      data.username = sanitizeInput(username);
    }

    if (profilePicture) {
      data.profilePicture = profilePicture;
    }

    if (newPassword) {
      // Validar fortaleza de la nueva contraseña
      if (!isStrongPassword(newPassword)) {
        res.status(400).json({
          error:
            "Password must be at least 8 characters long and contain uppercase, lowercase, and numbers",
        });
        return;
      }
      data.password = await hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { email },
      data,
    });

    res.json({
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        role: updated.role,
        profilePicture: updated.profilePicture,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating profile" });
  }
};

const addGameHistory = async (req: Request, res: Response) => {
  const { userId, game, score } = req.body;
  try {
    const record = await prisma.gameHistory.create({
      data: { userId, game, score },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: "Error saving game history" });
  }
};

const getUserProgress = async (req: Request, res: Response) => {
  const { userId } = req.query;

  try {
    const history = await prisma.gameHistory.findMany({
      where: { userId: String(userId) },
      orderBy: { playedAt: "desc" },
    });

    const gamesPlayed = history.length;
    const averageScore = gamesPlayed
      ? Math.round(history.reduce((acc, h) => acc + h.score, 0) / gamesPlayed)
      : 0;

    res.json({ gamesPlayed, averageScore, history });
  } catch (err) {
    res.status(500).json({ error: "Error fetching progress" });
  }
};

const getUserRanking = async (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    // Suma total de score por usuario
    const users = await prisma.user.findMany({
      include: {
        gameHistory: true,
      },
    });

    // Array de { userId, totalScore }
    const scores = users.map((u) => ({
      userId: u.id,
      totalScore: u.gameHistory.reduce((acc, h) => acc + h.score, 0),
    }));

    // Ordena de mayor a menor score
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // Busca el ranking (posición + 1)
    const ranking = scores.findIndex((u) => u.userId === userId) + 1;

    res.json({ ranking });
  } catch (err) {
    res.status(500).json({ error: "Error calculating ranking" });
  }
};

const sendEmailCtrl = async (req: Request, res: Response) => {
  const { email, message } = req.body;

  try {
    const mailOptions = {
      from: email,
      // to: 'c99652451@gmail.com',
      to: "soporte.edusoft@gmail.com",
      subject: `Message of ${email}`,
      text: message,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error al enviar el correo electrónico:", error);
      } else {
        console.log("Correo electrónico enviado:", info.response);
      }
    });

    return res.json({ ok: true, msg: "Mensaje enviado" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ ok: false, msg: "Error al enviar el correo" });
  }
};

/**
 * Obtener información del usuario autenticado
 * GET /auth/me
 */
import type { AuthRequest } from "../middleware/auth";

const getMeCtrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export {
    addGameHistory,
    createUserCtrl,
    getMeCtrl,
    getUserProgress,
    getUserRanking,
    loginUserCtrl,
    recoverPasswordCtrl,
    sendEmailCtrl,
    updateProfileCtrl
};

