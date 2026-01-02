import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router";
import App from "./App";
import LessonCreation from "./components/LessonCreation";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentLessons from "./components/StudentLessons";
import TutorLessonsWrapper from "./components/TutorLessonsWrapper";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { GamesHome } from "./pages/games/GamesHome";
import { Grammar } from "./pages/games/grammar/Grammar";
import { Listen } from "./pages/games/listen/Listen";
import { Reading } from "./pages/games/reading/Reading";
import { Speak } from "./pages/games/speak/Speak";
import { Vocabulary } from "./pages/games/vocabulary/Vocabulary";
import { Write } from "./pages/games/write/Write";
import { HomeUser } from "./pages/HomeUser";
import { Profile } from "./pages/profile/Profile";
import { UpdateProfile } from "./pages/profile/UpdateProfile";
import { Progress } from "./pages/Progress";
import { About } from "./pages/public/About";
import Accessibility from "./pages/public/Accesibility";
import { Login } from "./pages/public/auth/Login";
import { RecoverPassword } from "./pages/public/auth/RecoverPassword";
import { Register } from "./pages/public/auth/Register";
import { Home } from "./pages/public/Home";
// Exams imports
import ExamCreate from "./pages/exams/ExamCreate";
import ExamEdit from "./pages/exams/ExamEdit";
import ExamPreview from "./pages/exams/ExamPreview";
import ExamResults from "./pages/exams/ExamResults";
import ExamsList from "./pages/exams/ExamsList";
import TakeExam from "./pages/exams/TakeExam";
// Billing imports
import Pricing from "./pages/billing/Pricing";
import Upgrade from "./pages/billing/Upgrade";
import BillingSuccess from "./pages/billing/Success";
import BillingCancel from "./pages/billing/Cancel";
import Subscription from "./pages/billing/Subscription";
import PaymentMethods from "./pages/billing/PaymentMethods";

const RouterProviders = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<App isAuthenticated={isAuthenticated} />}>
          {/* Rutas públicas */}
          <Route index element={<Home />} />
          <Route path="accessibility" element={<Accessibility />} />
          <Route path="about" element={<About />} />
          <Route path="register" element={<Register />} />
          <Route path="login" element={<Login />} />
          <Route path="recover-password" element={<RecoverPassword />} />

          {/* Rutas de Pricing (pública) */}
          <Route path="pricing" element={<Pricing />} />

          {/* Rutas protegidas (requieren autenticación) */}
          <Route
            path="home"
            element={
              <ProtectedRoute>
                <HomeUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="progress"
            element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            }
          />
          <Route path="profile">
            <Route
              index
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="update"
              element={
                <ProtectedRoute>
                  <UpdateProfile />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="games">
            <Route
              index
              element={
                <ProtectedRoute>
                  <GamesHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="grammar"
              element={
                <ProtectedRoute>
                  <Grammar />
                </ProtectedRoute>
              }
            />
            <Route
              path="vocabulary"
              element={
                <ProtectedRoute>
                  <Vocabulary />
                </ProtectedRoute>
              }
            />
            <Route
              path="write"
              element={
                <ProtectedRoute>
                  <Write />
                </ProtectedRoute>
              }
            />
            <Route
              path="read"
              element={
                <ProtectedRoute>
                  <Reading />
                </ProtectedRoute>
              }
            />
            <Route
              path="speak"
              element={
                <ProtectedRoute>
                  <Speak />
                </ProtectedRoute>
              }
            />
            <Route
              path="listen"
              element={
                <ProtectedRoute>
                  <Listen />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Rutas de administración (solo ADMIN y TUTOR) */}
          <Route
            path="admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "TUTOR"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Lecciones - TUTOR */}
          <Route
            path="tutor/create-lesson"
            element={
              <ProtectedRoute allowedRoles={["TUTOR"]}>
                <LessonCreation />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/lessons"
            element={
              <ProtectedRoute allowedRoles={["TUTOR"]}>
                <TutorLessonsWrapper />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Lecciones - STUDENT */}
          <Route
            path="student/lessons"
            element={
              <ProtectedRoute allowedRoles={["STUDENT_PRO", "STUDENT_FREE"]}>
                <StudentLessons />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Exámenes */}
          <Route
            path="exams"
            element={
              <ProtectedRoute>
                <ExamsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="exams/:id"
            element={
              <ProtectedRoute>
                <TakeExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="exams/:id/results/:attemptId"
            element={
              <ProtectedRoute>
                <ExamResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/exams/create"
            element={
              <ProtectedRoute allowedRoles={["TUTOR"]}>
                <ExamCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/exams/:id/edit"
            element={
              <ProtectedRoute allowedRoles={["TUTOR"]}>
                <ExamEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/exams/:id/preview"
            element={
              <ProtectedRoute allowedRoles={["TUTOR"]}>
                <ExamPreview />
              </ProtectedRoute>
            }
          />

          {/* Rutas de Billing */}
          <Route
            path="billing/pricing"
            element={
              <ProtectedRoute>
                <Pricing />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing/upgrade"
            element={
              <ProtectedRoute>
                <Upgrade />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing/success"
            element={
              <ProtectedRoute>
                <BillingSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing/cancel"
            element={
              <ProtectedRoute>
                <BillingCancel />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing/subscription"
            element={
              <ProtectedRoute>
                <Subscription />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing/payment-methods"
            element={
              <ProtectedRoute>
                <PaymentMethods />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default RouterProviders;
