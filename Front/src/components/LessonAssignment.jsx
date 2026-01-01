import { useEffect, useState } from "react";
import {
  assignLesson,
  getLessonById,
  getLessonCandidates,
} from "../services/lessonService";
import "../styles/LessonAssignment.css";

export default function LessonAssignment({ lessonId, onAssignmentComplete }) {
  const [lesson, setLesson] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // Obtener datos de la lección
        const lessonData = await getLessonById(lessonId);
        setLesson(lessonData.lesson);

        // Obtener todos los estudiantes candidatos
        const candidatesData = await getLessonCandidates();
        setCandidates(candidatesData.candidates);
      } catch (err) {
        setError(err.response?.data?.error || "Error loading assignment data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lessonId]);

  const handleStudentToggle = (userId) => {
    setSelectedStudents((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === candidates.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(candidates.map((c) => c.id));
    }
  };

  const handleAssign = async () => {
    if (selectedStudents.length === 0) {
      setError("Please select at least one student");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      await assignLesson(lessonId, selectedStudents);
      setSuccess(
        `Lesson assigned successfully to ${selectedStudents.length} student(s)`
      );
      setSelectedStudents([]);

      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error assigning lesson");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading assignment data...</div>;
  }

  if (!lesson) {
    return <div className="error">Lesson not found</div>;
  }

  return (
    <div className="lesson-assignment-container">
      <div className="assignment-header">
        <h2>Assign Lesson: {lesson.title}</h2>
        <div className="lesson-info">
          <span className={`badge ${lesson.isPremium ? "premium" : "free"}`}>
            {lesson.isPremium ? "PRO" : "FREE"}
          </span>
          <span className="level-badge">{lesson.level}</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="assignment-content">
        <div className="candidates-section">
          <div className="candidates-header">
            <h3>Available Students ({candidates.length})</h3>
            {candidates.length > 0 && (
              <button className="btn-select-all" onClick={handleSelectAll}>
                {selectedStudents.length === candidates.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="no-candidates">
              <p>No students available for this lesson type</p>
              {lesson.isPremium && (
                <small>No students with PRO subscription found</small>
              )}
            </div>
          ) : (
            <div className="candidates-list">
              {candidates.map((student) => (
                <div
                  key={student.id}
                  className={`candidate-item ${
                    selectedStudents.includes(student.id) ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    id={`student-${student.id}`}
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => handleStudentToggle(student.id)}
                  />
                  <label htmlFor={`student-${student.id}`}>
                    <span className="student-name">{student.username}</span>
                    <span className="student-email">{student.email}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="assignment-stats">
          <div className="stat">
            <span className="stat-label">Total Available:</span>
            <span className="stat-value">{candidates.length}</span>
          </div>
          <div className="stat selected">
            <span className="stat-label">Selected:</span>
            <span className="stat-value">{selectedStudents.length}</span>
          </div>
        </div>
      </div>

      <div className="assignment-actions">
        <button
          className="btn-assign"
          onClick={handleAssign}
          disabled={selectedStudents.length === 0 || assigning}
        >
          {assigning
            ? "Assigning..."
            : `Assign to ${selectedStudents.length} Student${
                selectedStudents.length !== 1 ? "s" : ""
              }`}
        </button>
      </div>
    </div>
  );
}
