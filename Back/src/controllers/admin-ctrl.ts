import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();

/**
 * Obtener todos los usuarios (solo ADMIN)
 * GET /admin/users
 */
export const getAllUsersCtrl = async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profilePicture: true,
        _count: {
          select: {
            gameHistory: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Cambiar el rol de un usuario (solo ADMIN)
 * PUT /admin/users/:id/role
 */
export const updateUserRoleCtrl = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validar que el rol sea válido
  const validRoles = ["ADMIN", "TUTOR", "STUDENT_PRO", "STUDENT_FREE"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({
      error: "Invalid role",
      validRoles,
    });
    return;
  }

  try {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Actualizar el rol
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        updatedAt: true,
      },
    });

    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Obtener estadísticas del sistema (solo ADMIN y TUTOR)
 * GET /admin/stats
 */
export const getSystemStatsCtrl = async (_req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalGames = await prisma.gameHistory.count();

    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    const recentUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    res.json({
      totalUsers,
      totalGames,
      usersByRole,
      recentUsers,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
