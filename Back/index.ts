import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import { startSubscriptionCheckJob } from "./src/jobs/subscriptionCheck";
import routerAudit from "./src/routes/audit";
import { routerBilling } from "./src/routes/billing";
import { routerExam } from "./src/routes/exam";
import { routerLesson } from "./src/routes/lesson";
import { routerUser } from "./src/routes/user";

// Cargar variables de entorno
dotenv.config();

// ============================================================================
// Validar variables de entorno críticas al inicio
// ============================================================================
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set');
  console.error('Please configure JWT_SECRET in your .env file');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Deshabilitar X-Powered-By header para no exponer información del framework
app.disable('x-powered-by');

// Confiar en proxies para obtener IP real (X-Forwarded-For)
// Usar 1 en lugar de true para evitar el error ERR_ERL_PERMISSIVE_TRUST_PROXY
app.set("trust proxy", 1);

// ============================================================================
// HU07 - Headers de seguridad globales
// Aplica headers de seguridad básicos a todas las respuestas
// ============================================================================
app.use((_req: Request, res: Response, next: NextFunction) => {
  // HSTS - Forzar HTTPS por 1 año
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // Prevenir sniffing de tipo de contenido
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Prevenir clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // XSS Protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Prevenir referrer leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Remover header que expone información del servidor
  res.removeHeader("X-Powered-By");
  
  next();
});

// Configurar CORS
const corsOrigins = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:4173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origen (como Postman) en desarrollo
      if (!origin && process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "X-Reauth-Password",
      // HU07: Headers de seguridad de transacciones
      "X-Transaction-Timestamp",
      "X-Transaction-Nonce",
      "X-Transaction-Signature",
      "X-Request-Id",
    ],
    // HU07: Exponer headers de seguridad al frontend
    exposedHeaders: [
      "X-Transaction-Id",
      "X-Transaction-Timestamp",
      "X-Transaction-Nonce",
      "X-Transaction-Signature",
      "X-Signature-Algorithm",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],
  })
);

// Webhook de Stripe necesita raw body - DEBE ir ANTES de express.json()
app.use("/billing/webhook", express.raw({ type: "application/json" }));

// Parsear JSON para todas las demás rutas
app.use(express.json());

// Parsear cookies
app.use(cookieParser());

app.get("/", (_req: Request, res: Response) => {
  res.send("EduSoft API - Secure Backend");
});

app.use("/user", routerUser);
app.use("/lessons", routerLesson);
app.use("/exams", routerExam);
app.use("/billing", routerBilling);
app.use("/audit", routerAudit);

app.use("/profile-pictures", express.static("public/profile-pictures"));

// Iniciar job de verificación de suscripciones (cada 60 minutos)
const subscriptionCheckInterval = startSubscriptionCheckJob(60);

// Cleanup al cerrar el servidor
process.on("SIGTERM", () => {
  clearInterval(subscriptionCheckInterval);
  console.log("Server shutting down gracefully...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`CORS enabled for: ${corsOrigins.join(", ")}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Billing system active`);
  console.log(`HU07: Payment transit security enabled`);
});
