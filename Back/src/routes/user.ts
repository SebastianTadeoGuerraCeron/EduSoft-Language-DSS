import crypto from "crypto";
import express from "express";
import multer from "multer";
import {
    getAllUsersCtrl,
    getSystemStatsCtrl,
    updateUserRoleCtrl,
} from "../controllers/admin-ctrl";
import {
    addGameHistory,
    createUserCtrl,
    deleteUserAccountCtrl,
    getMeCtrl,
    getUserProgress,
    getUserRanking,
    loginUserCtrl,
    logoutUserCtrl,
    recoverPasswordCtrl,
    sendEmailCtrl,
    updateProfileCtrl,
} from "../controllers/user-ctrl";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
    loginLimiter,
    passwordRecoveryLimiter,
    registrationLimiter,
} from "../middleware/rateLimiter";

const routerUser = express.Router();

// Límites de seguridad para imágenes de perfil
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB (suficiente para imágenes de perfil de alta calidad)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "public/profile-pictures");
  },
  filename: (_req, file, cb) => {
    // Usar crypto.randomBytes() para generación criptográficamente segura de nombres únicos
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(6).toString('hex');
    const ext = file.originalname.split(".").pop();
    cb(null, `${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE,
    files: 1, // Solo 1 imagen de perfil a la vez
  },
  fileFilter: (_req, file, cb) => {
    // Validar tipo MIME de imagen
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`));
    }
  },
});

// ===== Rutas públicas (sin autenticación) =====
// HU03: Rate limiters para prevenir ataques de fuerza bruta
// @ts-ignore - Conflicto de tipos entre express v5 y express-rate-limit
routerUser.post("/create", registrationLimiter, createUserCtrl as express.RequestHandler);
// @ts-ignore - Conflicto de tipos entre express v5 y express-rate-limit
routerUser.post("/login", loginLimiter, loginUserCtrl as express.RequestHandler);

// Logout - Limpiar cookie httpOnly
routerUser.post("/logout", logoutUserCtrl as express.RequestHandler);

// @ts-ignore - Conflicto de tipos entre express v5 y express-rate-limit
routerUser.post(
  "/recover-password",
  passwordRecoveryLimiter,
  recoverPasswordCtrl as express.RequestHandler
);

// ===== Rutas protegidas (requieren autenticación) =====

// Obtener información del usuario autenticado
routerUser.get(
  "/me",
  authenticate as express.RequestHandler,
  getMeCtrl as express.RequestHandler
);

routerUser.post(
  "/upload-profile-picture",
  authenticate as express.RequestHandler,
  upload.single("profilePicture"),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    res.json({ filename: `profile-pictures/${req.file.filename}` });
  }
);

routerUser.put(
  "/update-profile",
  authenticate as express.RequestHandler,
  updateProfileCtrl as express.RequestHandler
);

routerUser.post(
  "/game-history",
  authenticate as express.RequestHandler,
  addGameHistory as express.RequestHandler
);

routerUser.get(
  "/progress",
  authenticate as express.RequestHandler,
  getUserProgress as express.RequestHandler
);

routerUser.get(
  "/ranking",
  authenticate as express.RequestHandler,
  getUserRanking as express.RequestHandler
);

routerUser.post("/send-email", (req, res, next) => {
  sendEmailCtrl(req, res).catch(next);
});

// ===== Rutas de administración (solo ADMIN) =====
routerUser.get(
  "/admin/users",
  authenticate as express.RequestHandler,
  authorize("ADMIN") as express.RequestHandler,
  getAllUsersCtrl as express.RequestHandler
);

routerUser.put(
  "/admin/users/:id/role",
  authenticate as express.RequestHandler,
  authorize("ADMIN") as express.RequestHandler,
  updateUserRoleCtrl as express.RequestHandler
);

routerUser.get(
  "/admin/stats",
  authenticate as express.RequestHandler,
  authorize("ADMIN", "TUTOR") as express.RequestHandler,
  getSystemStatsCtrl as express.RequestHandler
);

// ===== Eliminación segura de cuenta (HU10) =====
/**
 * DELETE /user/delete-account
 * Eliminar cuenta de usuario de forma segura
 * Requiere autenticación + contraseña en body
 * Aplica a: TUTOR, STUDENT_PRO, STUDENT_FREE (no ADMIN)
 */
routerUser.delete(
  "/delete-account",
  authenticate as express.RequestHandler,
  deleteUserAccountCtrl as express.RequestHandler
);

export { routerUser };
