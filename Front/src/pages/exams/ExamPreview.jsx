import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { getExamById } from "../../services/examService";
import "../../styles/Exams.css";

const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: "Multiple Choice",
  TRUE_FALSE: "True/False",
  SHORT_ANSWER: "Short Answer",
  FILL_BLANK: "Fill in the Blank",
};

export default function ExamPreview() {
  const navigate = useNavigate();
  const { id: examId } = useParams();
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const data = await getExamById(examId);
        const examData = data.exam;

        // Verify ownership
        if (examData.tutor?.id !== user?.id) {
          setError("You don't have permission to preview this exam");
          setTimeout(() => navigate("/exams"), 2000);
          return;
        }

        setExam(examData);
      } catch (err) {
        console.error("Error loading exam:", err);
        setError("Could not load exam data");
      } finally {
        setLoading(false);
      }
    };

    if (examId) {
      fetchExam();
    }
  }, [examId, user?.id, navigate]);

  if (loading) {
    return (
      <div className="exam-preview-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading exam preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-preview-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="exam-preview-container">
        <div className="error-message">Exam not found</div>
      </div>
    );
  }

  const totalPoints = exam.questions?.reduce(
    (sum, q) => sum + (q.points || 1),
    0
  );

  return (
    <div className="exam-preview-container">
      {/* Header */}
      <div className="exam-preview-header">
        <div className="preview-badge">👁️ Preview Mode</div>
        <h1>{exam.title}</h1>
        {exam.description && (
          <p className="exam-description">{exam.description}</p>
        )}

        <div className="exam-preview-meta">
          <div className="meta-item">
            <span className="meta-label">📚 Lesson:</span>
            <span className="meta-value">{exam.lesson?.title || "N/A"}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">⏱️ Time Limit:</span>
            <span className="meta-value">{exam.timeLimit} minutes</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">✅ Passing:</span>
            <span className="meta-value">{exam.passingPercentage}%</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">❓ Questions:</span>
            <span className="meta-value">{exam.questions?.length || 0}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">🏆 Total Points:</span>
            <span className="meta-value">{totalPoints}</span>
          </div>
          {exam.isPremium && (
            <div className="meta-item">
              <span className="premium-badge">⭐ Premium</span>
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="exam-preview-questions">
        <h2>📝 Questions</h2>

        {exam.questions?.map((question, index) => (
          <div key={question.id} className="preview-question-card">
            <div className="preview-question-header">
              <span className="question-number">Question {index + 1}</span>
              <span className="question-type-badge">
                {QUESTION_TYPE_LABELS[question.type] || question.type}
              </span>
              <span className="question-points">{question.points} pts</span>
            </div>

            <div className="preview-question-text">{question.text}</div>

            {/* Multiple Choice Options */}
            {question.type === "MULTIPLE_CHOICE" && question.options && (
              <div className="preview-options">
                {question.options.map((option, optIdx) => (
                  <div
                    key={optIdx}
                    className={`preview-option ${
                      option === question.correctAnswer ? "correct-answer" : ""
                    }`}
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + optIdx)}.
                    </span>
                    <span className="option-text">{option}</span>
                    {option === question.correctAnswer && (
                      <span className="correct-indicator">✓ Correct</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* True/False */}
            {question.type === "TRUE_FALSE" && (
              <div className="preview-options">
                <div
                  className={`preview-option ${
                    question.correctAnswer === "true" ? "correct-answer" : ""
                  }`}
                >
                  <span className="option-text">True</span>
                  {question.correctAnswer === "true" && (
                    <span className="correct-indicator">✓ Correct</span>
                  )}
                </div>
                <div
                  className={`preview-option ${
                    question.correctAnswer === "false" ? "correct-answer" : ""
                  }`}
                >
                  <span className="option-text">False</span>
                  {question.correctAnswer === "false" && (
                    <span className="correct-indicator">✓ Correct</span>
                  )}
                </div>
              </div>
            )}

            {/* Short Answer / Fill Blank */}
            {(question.type === "SHORT_ANSWER" ||
              question.type === "FILL_BLANK") && (
              <div className="preview-correct-answer">
                <span className="answer-label">Correct Answer:</span>
                <span className="answer-value">{question.correctAnswer}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="exam-preview-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate("/exams")}
        >
          ← Back to Exams
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/tutor/exams/${examId}/edit`)}
        >
          ✏️ Edit Exam
        </button>
      </div>
    </div>
  );
}
