// EXAMPLE ROUTES FOR LESSONS INTEGRATION
// Copy these routes to your RouterProviders.jsx or main routing file

import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Import Components
import LessonCreation from "./components/LessonCreation";
import TutorLessons from "./components/TutorLessons";
import StudentLessons from "./components/StudentLessons";

// Example Route Configuration (for HashRouter):
export const lessonRoutes = [
  // TUTOR ROUTES
  {
    path: "/tutor/create-lesson",
    element: (
      <ProtectedRoute allowedRoles={["TUTOR"]}>
        <LessonCreation />
      </ProtectedRoute>
    ),
  },
  {
    path: "/tutor/lessons",
    element: (
      <ProtectedRoute allowedRoles={["TUTOR"]}>
        <TutorLessons userId={user?.id} />
      </ProtectedRoute>
    ),
  },

  // STUDENT ROUTES
  {
    path: "/student/lessons",
    element: (
      <ProtectedRoute allowedRoles={["STUDENT_PRO", "STUDENT_FREE"]}>
        <StudentLessons />
      </ProtectedRoute>
    ),
  },
];

// EXAMPLE NAVBAR UPDATES
// Add these links to your navigation component:

export const lessonNavbarItems = {
  tutor: [
    {
      label: "Create Lesson",
      path: "#/tutor/create-lesson",
      icon: "",
    },
    {
      label: "My Lessons",
      path: "#/tutor/lessons",
      icon: "",
    },
  ],
  student: [
    {
      label: "My Learning",
      path: "#/student/lessons",
      icon: "",
    },
  ],
};

// EXAMPLE CONTEXT HOOK FOR USER INFO
export const useUserLessons = () => {
  const { user } = useContext(AuthContext);
  const isTutor = user?.role === "TUTOR";
  const isStudent = ["STUDENT_PRO", "STUDENT_FREE"].includes(user?.role);
  const isPremium = user?.role === "STUDENT_PRO";

  return {
    isTutor,
    isStudent,
    isPremium,
    userId: user?.id,
  };
};

// EXAMPLE USAGE IN A COMPONENT
/*
import { useUserLessons } from "../hooks/useUserLessons";

export default function Dashboard() {
  const { isTutor, isStudent, userId } = useUserLessons();

  return (
    <div>
      {isTutor && (
        <>
          <h2>Tutor Dashboard</h2>
          <a href="#/tutor/create-lesson">Create New Lesson</a>
          <a href="#/tutor/lessons">Manage My Lessons</a>
        </>
      )}

      {isStudent && (
        <>
          <h2>Student Dashboard</h2>
          <a href="#/student/lessons">My Lessons</a>
        </>
      )}
    </div>
  );
}
*/

// API IMPORT EXAMPLE
/*
import {
  createLesson,
  getAllLessons,
  assignLesson,
  updateLessonProgress,
  getStudentLessons,
} from "./services/lessonService";

// Usage:
const createNewLesson = async (lessonData) => {
  try {
    const response = await createLesson(lessonData);
    console.log("Lesson created:", response.lesson);
  } catch (error) {
    console.error("Error:", error.response?.data?.error);
  }
};
*/
