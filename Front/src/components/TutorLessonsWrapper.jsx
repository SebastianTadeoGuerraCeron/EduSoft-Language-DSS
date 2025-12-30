import { useAuth } from "../context/AuthContext";
import TutorLessons from "./TutorLessons";

export default function TutorLessonsWrapper() {
  const { user } = useAuth();
  return <TutorLessons userId={user?.id} />;
}
