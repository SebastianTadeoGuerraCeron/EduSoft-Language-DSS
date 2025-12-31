import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { routerExam } from "./src/routes/exam";
import { routerLesson } from "./src/routes/lesson";
import { routerUser } from "./src/routes/user";

// Cargar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("EduSoft API - Secure Backend 🔒");
});

app.use("/user", routerUser);
app.use("/lessons", routerLesson);
app.use("/exams", routerExam);

app.use("/profile-pictures", express.static("public/profile-pictures"));

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔒 CORS enabled for: ${corsOrigins.join(", ")}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
