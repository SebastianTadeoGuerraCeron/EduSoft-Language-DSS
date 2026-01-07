import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getStudentLessonProgress, updateLessonProgress } from "../services/lessonService";
import { ContentProtection } from "./ContentProtection";
import LessonFilesManager from "./LessonFilesManager";
import "../styles/StudentLesson.css";

export default function StudentLesson({ lessonId, lesson, onProgressUpdate }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getStudentLessonProgress(lessonId);
        setProgress(data.progress);
      } catch (err) {
        setError("Error loading lesson progress");
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [lessonId]);

  const handleNextModule = async () => {
    // Si la lección está completada, no permitir navegar
    if (progress?.status === "COMPLETED") {
      return;
    }

    if (currentModuleIndex >= lesson.modules.length - 1) {
      return;
    }

    try {
      setUpdating(true);
      setError("");
      const newProgress = await updateLessonProgress(lessonId, currentModuleIndex + 1);
      setProgress(newProgress.progress);
      setCurrentModuleIndex(currentModuleIndex + 1);

      if (onProgressUpdate) {
        onProgressUpdate(newProgress.progress);
      }
    } catch (err) {
      setError("Error updating progress");
    } finally {
      setUpdating(false);
    }
  };

  const handlePreviousModule = () => {
    // Si la lección está completada, no permitir navegar
    if (progress?.status === "COMPLETED") {
      return;
    }
    if (currentModuleIndex > 0) {
      setCurrentModuleIndex(currentModuleIndex - 1);
    }
  };

  const handleCompleteLesson = async () => {
    try {
      setUpdating(true);
      setError("");
      // Marcar como completado
      const newProgress = await updateLessonProgress(lessonId, lesson.modules.length);
      setProgress(newProgress.progress);

      if (onProgressUpdate) {
        onProgressUpdate(newProgress.progress);
      }
    } catch (err) {
      setError("Error completing lesson");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading lesson...</div>;
  }

  if (!lesson || lesson.modules.length === 0) {
    return <div className="error">Lesson content not available</div>;
  }

  const currentModule = lesson.modules[currentModuleIndex];
  const isLastModule = currentModuleIndex === lesson.modules.length - 1;
  const isFirstModule = currentModuleIndex === 0;

  const requiresProtection = lesson.isPremium === true;

  return (
    <ContentProtection
      enabled={requiresProtection}
      contentType="lesson"
      userName={user?.username || ''}
      userEmail={user?.email || ''}
    >
      <div className="student-lesson-container">
        {/* Header */}
        <div className="lesson-header">
          <h1>{lesson.title}</h1>
          <p className="lesson-description">{lesson.description}</p>
          <div className="lesson-meta">
            <span className={`level-badge ${lesson.level.toLowerCase()}`}>
              {lesson.level}
            </span>
            <span className={`type-badge ${lesson.type.toLowerCase()}`}>
              {lesson.type === "VIDEO" ? "Video" : "Text"}
            </span>
            {lesson.duration && <span className="duration">{lesson.duration} min</span>}
          </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-info">
          <span>Progress: {progress?.percentage || 0}%</span>
          <span className="modules-info">
            Module {currentModuleIndex + 1} of {lesson.modules.length}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress?.percentage || 0}%` }}
          />
        </div>
      </div>

      {/* Module Navigation */}
      <div className="modules-nav">
        {lesson.modules.map((mod, idx) => (
          <div
            key={idx}
            className={`module-nav-item ${idx === currentModuleIndex ? "active" : ""
              } ${idx < currentModuleIndex ? "completed" : ""}`}
            onClick={() => setCurrentModuleIndex(idx)}
          >
            <span className="module-number">{idx + 1}</span>
            <span className="module-title">{mod.titulo}</span>
            {idx < currentModuleIndex && (
              <span className="checkmark">✓</span>
            )}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Module Content */}
      <div className="module-content">
        <h2>{currentModule.titulo}</h2>
        <div className="module-body">
          {lesson.type === "VIDEO" ? (
            <div className="video-container">
              <p className="placeholder-text">
                Video content would be displayed here
              </p>
              <pre className="content-preview">{currentModule.contenido}</pre>
            </div>
          ) : (
            <div className="text-content">
              <p>{currentModule.contenido}</p>
            </div>
          )}
        </div>

        {/* Files for this Lesson */}
        <div className="lesson-files-section">
          <h3>Materials & Resources</h3>
          <LessonFilesManager
            lessonId={lessonId}
            token={localStorage.getItem("token")}
            canUpload={false}
            canDelete={false}
          />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="module-controls">
        <button
          className="btn-prev"
          onClick={handlePreviousModule}
          disabled={isFirstModule || progress?.status === "COMPLETED"}
        >
          ← Previous Module
        </button>

        {!isLastModule ? (
          <button
            className="btn-next"
            onClick={handleNextModule}
            disabled={updating}
          >
            {updating ? "Updating..." : "Next Module →"}
          </button>
        ) : (
          <button
            className="btn-complete"
            onClick={handleCompleteLesson}
            disabled={updating || progress?.status === "COMPLETED"}
          >
            {updating ? "Marking Complete..." : "✓ Mark Lesson as Complete"}
          </button>
        )}
      </div>

      {/* Completion Status */}
      {progress?.status === "COMPLETED" && (
        <div className="completion-banner">
          <h3>Congratulations!</h3>
          <p>You have completed this lesson successfully.</p>
          <p className="completion-date">
            Completed on: {new Date(progress.completedAt).toLocaleDateString()}
          </p>
        </div>
      )}
      </div>
    </ContentProtection>
  );
}
