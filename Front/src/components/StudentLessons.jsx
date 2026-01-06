import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getStudentLessons } from "../services/lessonService";
import "../styles/StudentLessons.css";
import StudentLesson from "./StudentLesson";

export default function StudentLessons() {
  const { hasRole } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getStudentLessons();
      setLessons(data.lessons);
    } catch (err) {
      setError("Error loading lessons");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading your lessons...</div>;
  }

  if (selectedLesson) {
    return (
      <div className="student-lesson-page">
        <button className="btn-back" onClick={() => setSelectedLesson(null)}>
          ← Back to Lessons
        </button>
        <StudentLesson
          lessonId={selectedLesson.id}
          lesson={selectedLesson}
          onProgressUpdate={(progress) => {
            // Actualizar el progreso en la lista
            setLessons((prev) =>
              prev.map((l) =>
                l.id === selectedLesson.id
                  ? { ...l, progress: [{ ...progress }] }
                  : l
              )
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="student-lessons-container">
      <div className="lessons-header">
        <h1>My Lessons</h1>
        <p>Continue learning with your assigned lessons</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {lessons.length === 0 ? (
        <div className="no-lessons">
          <p>You haven't been assigned any lessons yet.</p>
          <p className="subtitle">
            Check back soon for new lessons from your tutor!
          </p>
        </div>
      ) : (
        <div className="lessons-grid">
          {lessons.map((lesson) => {
            const progress = lesson.progress?.[0];
            const isLocked = lesson.isPremium && hasRole(["STUDENT_FREE"]);
            return (
              <div
                key={lesson.id}
                className={`lesson-card ${isLocked ? "locked" : ""}`}
              >
                <div className="lesson-card-header">
                  <h3>{lesson.title}</h3>
                  <div className="lesson-badges">
                    <span
                      className={`badge ${lesson.isPremium ? "premium" : "free"
                        }`}
                    >
                      {lesson.isPremium ? "PRO" : "FREE"}
                    </span>
                    {isLocked && <span className="locked-badge">🔒</span>}
                  </div>
                </div>

                {isLocked && (
                  <div className="locked-overlay">
                    <div className="locked-message">
                      <span className="lock-icon">🔒</span>
                      <p>Premium Content</p>
                      <span className="upgrade-hint">
                        Upgrade to PRO to access this lesson
                      </span>
                    </div>
                  </div>
                )}

                <p className="lesson-description">{lesson.description}</p>

                <div className="lesson-tutor">
                  <span className="tutor-label">Tutor:</span>
                  <span className="tutor-name">{lesson.tutor?.username}</span>
                </div>

                {!isLocked && (
                  <div className="lesson-progress">
                    <div className="progress-info">
                      <span className="progress-label">Progress:</span>
                      <span className="progress-percent">
                        {progress?.percentage || 0}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress?.percentage || 0}%` }}
                      />
                    </div>
                    <div className="progress-details">
                      <span>
                        {progress?.modulosVistos || 0} of{" "}
                        {lesson.modules?.length || 0} modules
                      </span>
                      <span
                        className={`status ${progress?.status?.toLowerCase()}`}
                      >
                        {progress?.status === "COMPLETED"
                          ? "✓ Completed"
                          : "In Progress"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="lesson-meta">
                  <span className="level">{lesson.level}</span>
                  <span className="type">{lesson.type}</span>
                  {lesson.modules && (
                    <span className="modules">
                      {lesson.modules.length} modules
                    </span>
                  )}
                </div>

                {isLocked ? (
                  <button className="btn-locked" disabled>
                    🔒 Upgrade to Access
                  </button>
                ) : (
                  <button
                    className="btn-start"
                    onClick={() => setSelectedLesson(lesson)}
                  >
                    {progress?.percentage === 100
                      ? "Review Lesson"
                      : progress?.percentage > 0
                        ? "Continue Learning"
                        : "Start Lesson"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
