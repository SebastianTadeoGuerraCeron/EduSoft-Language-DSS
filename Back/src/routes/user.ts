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
    getMeCtrl,
    getUserProgress,
    getUserRanking,
    loginUserCtrl,
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "public/profile-pictures");
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, `${uniqueSuffix}.${ext}`);
  },
});
const upload = multer({ storage });

// ===== Rutas públicas (sin autenticación) =====
// HU03: Rate limiters para prevenir ataques de fuerza bruta
routerUser.post("/create", registrationLimiter, createUserCtrl as express.RequestHandler);
routerUser.post("/login", loginLimiter, loginUserCtrl as express.RequestHandler);
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

export { routerUser };
