import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { transporter } from "../nodemailer";
import {
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isStrongPassword,
  sanitizeInput,
} from "../utils/security";
import type { AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();

const createUserCtrl = async (req: Request, res: Response) => {
  const { email, username, password, answerSecret, role } = req.body;

  if (!email || !username || !password || !answerSecret) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  // Validar email
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  // Validar fortaleza de contraseña
  if (!isStrongPassword(password)) {
    res.status(400).json({
      error:
        "Password must be at least 8 characters long and contain uppercase, lowercase, and numbers",
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
    const userRole = role || "STUDENT_FREE";

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
      res.status(409).json({ error: "Email already exists" });
      return;
    }
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

    // Comparar contraseñas con bcrypt
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

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

export {
  addGameHistory,
  createUserCtrl,
  getUserProgress,
  getUserRanking,
  loginUserCtrl,
  recoverPasswordCtrl,
  sendEmailCtrl,
  updateProfileCtrl,
};
