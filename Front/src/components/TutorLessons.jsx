import { useState, useEffect } from "react";
import { getAllLessons, deleteLesson } from "../services/lessonService";
import { useAuth } from "../context/AuthContext";
import LessonAssignment from "./LessonAssignment";
import LessonEdit from "./LessonEdit";
import LessonPreview from "./LessonPreview";
import "../styles/TutorLessons.css";

export default function TutorLessons({ userId }) {
  const { user } = useAuth();
  const currentUserId = userId || user?.id;
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLesson, setPreviewLesson] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      setError("");
      // Usar el endpoint específico del tutor con cookies
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/lessons/tutor/my-lessons`, {
        credentials: 'include', // Enviar cookies automáticamente
      });
      const data = await response.json();
      setLessons(data.lessons || []);
    } catch (err) {
      setError("Error loading lessons");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (lesson) => {
    setConfirmDelete({ id: lesson.id, title: lesson.title });
  };

  const confirmDeleteLesson = async () => {
    if (confirmDelete) {
      try {
        await deleteLesson(confirmDelete.id);
        setLessons(lessons.filter((l) => l.id !== confirmDelete.id));
        setConfirmDelete(null);
      } catch (err) {
        setError("Error deleting lesson");
        setConfirmDelete(null);
      }
    }
  };

  const handleAssignClick = (lessonId) => {
    setSelectedLessonId(lessonId);
    setShowAssignModal(true);
  };

  const handleEditClick = (lessonId) => {
    setSelectedLessonId(lessonId);
    setShowEditModal(true);
  };

  const handlePreviewClick = (lesson) => {
    setPreviewLesson(lesson);
    setShowPreviewModal(true);
  };

  const handleEditComplete = () => {
    setShowEditModal(false);
    setSelectedLessonId(null);
    fetchLessons();
  };

  const handleAssignmentComplete = () => {
    setShowAssignModal(false);
    setSelectedLessonId(null);
    // Opcionalmente, recargar datos
    fetchLessons();
  };

  if (loading) {
    return <div className="loading">Loading lessons...</div>;
  }

  return (
    <div className="tutor-lessons-container">
      <div className="lessons-header">
        <h1>My Lessons</h1>
        <p>Manage and assign your lessons to students</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showAssignModal && selectedLessonId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              className="modal-close"
              onClick={() => setShowAssignModal(false)}
            >
              ×
            </button>
            <LessonAssignment
              lessonId={selectedLessonId}
              onAssignmentComplete={handleAssignmentComplete}
            />
          </div>
        </div>
      )}

      {showEditModal && selectedLessonId && (
        <LessonEdit
          lessonId={selectedLessonId}
          lesson={lessons.find((l) => l.id === selectedLessonId)}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleEditComplete}
        />
      )}

      {showPreviewModal && previewLesson && (
        <LessonPreview
          lesson={previewLesson}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewLesson(null);
          }}
        />
      )}

      {lessons.length === 0 ? (
        <div className="no-lessons">
          <p>You haven't created any lessons yet.</p>
          <a href="#/tutor/create-lesson" className="btn-create">
            Create Your First Lesson
          </a>
        </div>
      ) : (
        <div className="lessons-grid">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="lesson-card">
              <div className="lesson-card-header">
                <h3>{lesson.title}</h3>
                <span className={`badge ${lesson.isPremium ? "premium" : "free"}`}>
                  {lesson.isPremium ? "PRO" : "FREE"}
                </span>
              </div>

              <p className="lesson-description">{lesson.description}</p>

              <div className="lesson-stats">
                <div className="stat">
                  <span className="stat-label">Modules:</span>
                  <span className="stat-value">{lesson.modules?.length || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Assigned:</span>
                  <span className="stat-value">{lesson._count?.assignments || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Students:</span>
                  <span className="stat-value">{lesson._count?.progress || 0}</span>
                </div>
              </div>

              <div className="lesson-meta">
                <span className="level">{lesson.level}</span>
                <span className="type">{lesson.type}</span>
                {lesson.duration && <span className="duration">{lesson.duration} min</span>}
              </div>

              <div className="lesson-actions">
                <button
                  className="btn-edit"
                  onClick={() => handleEditClick(lesson.id)}
                >
                  Edit
                </button>
                <button
                  className="btn-preview"
                  onClick={() => handlePreviewClick(lesson)}
                >
                  Preview
                </button>
                <button
                  className="btn-assign"
                  onClick={() => handleAssignClick(lesson.id)}
                >
                  Assign
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(lesson)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal to delete lesson */}
      {confirmDelete && (
        <div className="confirmation-overlay" onClick={() => setConfirmDelete(null)}>
          <div
            className="confirmation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>⚠️ Confirm Deletion</h3>
            <p>
              Are you sure you want to delete the lesson{" "}
              <strong>"{confirmDelete.title}"</strong>?
            </p>
            <p className="confirmation-hint">
              This action cannot be undone and will also delete all related assignments.
            </p>
            <div className="confirmation-actions">
              <button
                className="btn-confirmation-cancel"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn-confirmation-delete"
                onClick={confirmDeleteLesson}
              >
                Delete Lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
