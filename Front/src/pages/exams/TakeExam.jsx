import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  getExamById,
  recordAudit,
  startExam,
  submitExam,
} from "../../services/examService";
import "../../styles/Exams.css";

export default function TakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  // State
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [startTime, setStartTime] = useState(null);

  const timerRef = useRef(null);
  const attemptRef = useRef(null);

  // Load exam
  useEffect(() => {
    fetchExam();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [id]);

  const fetchExam = async () => {
    try {
      setLoading(true);
      const data = await getExamById(id);

      // Check premium access
      if (data.exam.isPremium && hasRole(["STUDENT_FREE"])) {
        setError("This exam requires a PRO subscription");
        setLoading(false);
        return;
      }

      setExam(data.exam);

      // Si ya hay un intento activo, resumir
      if (data.activeAttempt) {
        setAttempt(data.activeAttempt);
        setShowInstructions(false);
        const elapsed = Math.floor(
          (Date.now() - new Date(data.activeAttempt.startedAt).getTime()) / 1000
        );
        const remaining = data.exam.timeLimit * 60 - elapsed;
        if (remaining > 0) {
          setTimeLeft(remaining);
          setStartTime(new Date(data.activeAttempt.startedAt));
          startTimer(remaining);
        } else {
          // Time expired, submit automatically
          handleSubmit(true);
        }
      }
    } catch (err) {
      setError("Error loading exam");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Timer
  const startTimer = useCallback((seconds) => {
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start exam
  const handleStart = async () => {
    try {
      setLoading(true);
      const data = await startExam(id);
      setAttempt(data.attempt);
      attemptRef.current = data.attempt;
      setShowInstructions(false);
      setStartTime(new Date());
      startTimer(exam.timeLimit * 60);
    } catch (err) {
      setError(err.response?.data?.error || "Error starting exam");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Audit - detect tab switching
  useEffect(() => {
    if (!attempt || showInstructions) return;

    const handleVisibilityChange = () => {
      if (document.hidden && attemptRef.current) {
        recordAudit(attemptRef.current.id, "tab_switch", {
          timestamp: new Date().toISOString(),
        });
      }
    };

    const handleBlur = () => {
      if (attemptRef.current) {
        recordAudit(attemptRef.current.id, "window_blur", {
          timestamp: new Date().toISOString(),
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [attempt, showInstructions]);

  // Actualizar referencia del intento
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  // Handle answer
  const handleAnswer = (questionId, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // Submit exam
  const handleSubmit = async (autoSubmit = false) => {
    if (
      !autoSubmit &&
      !window.confirm("Are you sure you want to submit the exam?")
    ) {
      return;
    }

    try {
      setSubmitting(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      const timeTaken = startTime
        ? Math.floor((Date.now() - startTime.getTime()) / 1000)
        : 0;

      const data = await submitExam(id, attempt.id, answers, timeTaken);

      navigate(`/exams/${id}/results/${attempt.id}`, {
        state: { results: data.results },
      });
    } catch (err) {
      setError(err.response?.data?.error || "Error submitting exam");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Timer class based on remaining time
  const getTimerClass = () => {
    if (timeLeft <= 60) return "danger";
    if (timeLeft <= 300) return "warning";
    return "";
  };

  if (loading) {
    return (
      <div className="take-exam-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="take-exam-container">
        <div className="error-message">{error}</div>
        <button className="btn-secondary" onClick={() => navigate("/exams")}>
          Back to Exams
        </button>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="take-exam-container">
        <div className="empty-state">
          <h3>Exam not found</h3>
          <button className="btn-secondary" onClick={() => navigate("/exams")}>
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  // Instructions screen
  if (showInstructions) {
    return (
      <div className="take-exam-container">
        <div className="exam-instructions">
          <h2>📝 {exam.title}</h2>
          <p>{exam.description}</p>

          <div className="exam-info-box">
            <div className="exam-info-item">
              <div className="exam-info-label">Time Limit</div>
              <div className="exam-info-value">{exam.timeLimit} min</div>
            </div>
            <div className="exam-info-item">
              <div className="exam-info-label">Questions</div>
              <div className="exam-info-value">
                {exam.questions?.length || 0}
              </div>
            </div>
            <div className="exam-info-item">
              <div className="exam-info-label">To Pass</div>
              <div className="exam-info-value">{exam.passingPercentage}%</div>
            </div>
          </div>

          <h3>Instructions:</h3>
          <ul className="exam-instructions-list">
            <li>Once you start, the timer cannot be paused</li>
            <li>You can navigate between questions freely</li>
            <li>
              If you change tabs or minimize the window, it will be recorded
            </li>
            <li>Review your answers before submitting</li>
            <li>The exam will be submitted automatically when time runs out</li>
          </ul>

          <button
            className="btn-primary exam-start-btn"
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "Starting..." : "🚀 Start Exam"}
          </button>
        </div>
      </div>
    );
  }

  const questions = exam.questions || [];
  const currentQ = questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="take-exam-container">
      {/* Timer floating */}
      <div className={`exam-timer ${getTimerClass()}`}>
        <span className="timer-icon">⏱️</span>
        <span className="timer-value">{formatTime(timeLeft)}</span>
      </div>

      {/* Header */}
      <div className="exam-header">
        <h1>{exam.title}</h1>
        <div className="exam-progress">
          <div className="exam-progress-bar">
            <div
              className="exam-progress-fill"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
          <span className="exam-progress-text">
            {answeredCount}/{questions.length} answered
          </span>
        </div>
      </div>

      {/* Current question */}
      {currentQ && (
        <div className="question-container">
          <div className="question-header">
            <span className="question-label">
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <span className="question-points">{currentQ.points} point(s)</span>
          </div>

          <div className="question-text">{currentQ.text}</div>

          {/* Options by type */}
          {currentQ.type === "MULTIPLE_CHOICE" && (
            <div className="question-options">
              {(currentQ.options || []).map((option, idx) => (
                <label
                  key={idx}
                  className={`question-option ${
                    answers[currentQ.id] === option ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQ.id}`}
                    value={option}
                    checked={answers[currentQ.id] === option}
                    onChange={() => handleAnswer(currentQ.id, option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}

          {currentQ.type === "TRUE_FALSE" && (
            <div className="question-options">
              {["true", "false"].map((value) => (
                <label
                  key={value}
                  className={`question-option ${
                    answers[currentQ.id] === value ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQ.id}`}
                    value={value}
                    checked={answers[currentQ.id] === value}
                    onChange={() => handleAnswer(currentQ.id, value)}
                  />
                  <span>{value === "true" ? "True" : "False"}</span>
                </label>
              ))}
            </div>
          )}

          {(currentQ.type === "SHORT_ANSWER" ||
            currentQ.type === "FILL_BLANK") && (
            <input
              type="text"
              className="question-input"
              placeholder="Write your answer..."
              value={answers[currentQ.id] || ""}
              onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
            />
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="exam-navigation">
        <div className="question-dots">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              className={`question-dot ${
                idx === currentQuestion ? "active" : ""
              } ${answers[q.id] ? "answered" : ""}`}
              onClick={() => setCurrentQuestion(idx)}
              aria-label={`Go to question ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <div className="exam-card-actions">
          <button
            className="btn-secondary"
            onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            ← Previous
          </button>

          {currentQuestion < questions.length - 1 ? (
            <button
              className="btn-primary"
              onClick={() => setCurrentQuestion((prev) => prev + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "✅ Finish Exam"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
