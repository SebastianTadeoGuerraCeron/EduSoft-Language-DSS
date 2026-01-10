import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useAuth } from "../../context/AuthContext";
import { deleteExam, getAllExams } from "../../services/examService";
import "../../styles/Exams.css";

export default function ExamsList() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [lessonFilter, setLessonFilter] = useState("");
  const [premiumFilter, setPremiumFilter] = useState("all");

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await getAllExams();
      setExams(data.exams || []);
    } catch (err) {
      setError("Error loading exams");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (exam) => {
    // Check if premium and user is FREE
    if (exam.isPremium && hasRole(["STUDENT_FREE"])) {
      setSelectedExam(exam);
      setShowPremiumModal(true);
      return;
    }
    navigate(`/exams/${exam.id}`);
  };

  const handleDeleteClick = (exam) => {
    setExamToDelete(exam);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;

    try {
      setDeleting(true);
      await deleteExam(examToDelete.id);
      setExams((prev) => prev.filter((e) => e.id !== examToDelete.id));
      setShowDeleteModal(false);
      setExamToDelete(null);
    } catch (err) {
      setError("Error deleting exam");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // Check if the current user is the owner of the exam
  const isExamOwner = (exam) => {
    return hasRole(["TUTOR"]) && exam.tutor?.id === user?.id;
  };

  const filteredExams = exams.filter((exam) => {
    if (lessonFilter && exam.lessonId !== lessonFilter) return false;
    if (premiumFilter === "free" && exam.isPremium) return false;
    if (premiumFilter === "premium" && !exam.isPremium) return false;
    return true;
  });

  // Get unique lessons for the filter
  const uniqueLessons = [
    ...new Map(exams.map((e) => [e.lesson?.id, e.lesson])).values(),
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="exams-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="exams-container">
      <div className="exams-header">
        <h1>Available Exams</h1>
        <p>Test your knowledge with our interactive exams</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="exams-filters">
        <select
          value={lessonFilter}
          onChange={(e) => setLessonFilter(e.target.value)}
          aria-label="Filter by lesson"
        >
          <option value="">All lessons</option>
          {uniqueLessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>

        <select
          value={premiumFilter}
          onChange={(e) => setPremiumFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* Exams list */}
      {filteredExams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <h3>No exams available</h3>
          <p>Come back later to find new exams</p>
        </div>
      ) : (
        <div className="exams-grid">
          {filteredExams.map((exam) => {
            const isLocked = exam.isPremium && hasRole(["STUDENT_FREE"]);
            return (
              <div
                key={exam.id}
                className={`exam-card ${exam.isPremium ? "premium" : ""}`}
              >
                <div className="exam-card-header">
                  <h3 className="exam-card-title">{exam.title}</h3>
                  <div className="exam-card-badge">
                    {exam.isPremium && (
                      <span className="premium-badge">PRO</span>
                    )}
                    {isLocked && <span className="locked-badge">LOCKED</span>}
                  </div>
                </div>

                <p className="exam-card-description">
                  {exam.description?.slice(0, 100)}
                  {exam.description?.length > 100 ? "..." : ""}
                </p>

                {exam.lesson && (
                  <div className="exam-card-lesson">{exam.lesson.title}</div>
                )}

                <div className="exam-card-meta">
                  <span>{exam.timeLimit} min</span>
                  <span>{exam._count?.questions || 0} questions</span>
                  <span>{exam.passingPercentage}% to pass</span>
                </div>

                <div className="exam-card-actions">
                  {isExamOwner(exam) ? (
                    // Tutor actions for their own exams
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          navigate(`/tutor/exams/${exam.id}/preview`)
                        }
                        title="Preview Exam"
                      >
                        Preview
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => navigate(`/tutor/exams/${exam.id}/edit`)}
                        title="Edit Exam"
                      >
                        Edit
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleDeleteClick(exam)}
                        title="Delete Exam"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    // Student actions
                    <button
                      className="btn-primary"
                      onClick={() =>
                        isLocked
                          ? navigate("/billing/pricing")
                          : handleExamClick(exam)
                      }
                    >
                      {isLocked ? "Upgrade to Access" : "Start Exam"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Button for tutors */}
      {hasRole(["TUTOR"]) && (
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <Link to="/tutor/exams/create" className="btn-primary">
            Create New Exam
          </Link>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Exam"
        message={`Are you sure you want to delete "${examToDelete?.title}"? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setExamToDelete(null);
        }}
      />

      {/* Premium Modal */}
      {showPremiumModal && (
        <div
          className="premium-modal-overlay"
          onClick={() => setShowPremiumModal(false)}
        >
          <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
            <div className="premium-modal-icon"></div>
            <h2>Exclusive PRO Content</h2>
            <p>
              This exam "{selectedExam?.title}" requires a PRO subscription to
              access.
            </p>
            <div className="premium-modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowPremiumModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => navigate("/profile")}
              >
                View PRO Plans
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
