import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { getExamResults } from "../../services/examService";
import "../../styles/Exams.css";

export default function ExamResults() {
  const { id, attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // If we come from submit, use the results from state
  const passedResults = location.state?.results;

  useEffect(() => {
    if (passedResults) {
      // Build attempt from passed results
      setAttempt({
        score: passedResults.score,
        totalPoints: passedResults.earnedPoints,
        maxPoints: passedResults.totalPoints,
        answers: passedResults.gradedAnswers,
        exam: {
          passingPercentage: passedResults.passingPercentage,
        },
      });
      setLoading(false);
    } else {
      fetchResults();
    }
  }, [id, attemptId, passedResults]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const data = await getExamResults(id, attemptId);
      setAttempt(data.attempt);
    } catch (err) {
      setError("Error loading results");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="results-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-container">
        <div className="error-message">{error}</div>
        <button className="btn-secondary" onClick={() => navigate("/exams")}>
          Back to Exams
        </button>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="results-container">
        <div className="empty-state">
          <h3>Results not found</h3>
          <button className="btn-secondary" onClick={() => navigate("/exams")}>
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  const passed =
    (attempt.score || 0) >= (attempt.exam?.passingPercentage || 60);
  const answers = attempt.answers || {};
  const questions = attempt.exam?.questions || [];

  return (
    <div className="results-container">
      <div className="results-header">
        <h1>Exam Results</h1>
        {attempt.exam?.title && <p>{attempt.exam.title}</p>}
      </div>

      {/* Score card */}
      <div className={`results-score-card ${passed ? "passed" : "failed"}`}>
        <div className="results-icon">{passed ? "PASSED" : "FAILED"}</div>
        <div className={`results-score ${passed ? "passed" : "failed"}`}>
          {Math.round(attempt.score || 0)}%
        </div>
        <div className="results-status">
          {passed ? "Passed!" : "Not Passed"}
        </div>
        <p>
          {passed
            ? "Congratulations! You have completed the exam successfully."
            : `You need ${attempt.exam?.passingPercentage || 60
            }% to pass. Keep practicing!`}
        </p>
        <div className="results-details">
          <span>
            <strong>Points:</strong> {attempt.totalPoints || 0}/
            {attempt.maxPoints || 0}
          </span>
          <span>
            <strong>Time:</strong> {formatTime(attempt.timeTaken)}
          </span>
          <span>
            <strong>Required minimum:</strong>{" "}
            {attempt.exam?.passingPercentage || 60}%
          </span>
        </div>
      </div>

      {/* Answer review */}
      {Object.keys(answers).length > 0 && (
        <div className="results-questions">
          <h2>Answer Review</h2>

          {questions.length > 0
            ? // If we have the exam questions
            questions.map((question, idx) => {
              const answer = answers[question.id];
              const isCorrect = answer?.isCorrect;

              return (
                <div
                  key={question.id}
                  className={`result-question ${isCorrect ? "correct" : "incorrect"
                    }`}
                >
                  <div className="result-question-header">
                    <span>Question {idx + 1}</span>
                    <span
                      className={`result-question-status ${isCorrect ? "correct" : "incorrect"
                        }`}
                    >
                      {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>
                  <div className="result-question-text">{question.text}</div>
                  <div className="result-answer your-answer">
                    <strong>Your answer:</strong>{" "}
                    {answer?.userAnswer || "(no answer)"}
                  </div>
                  {!isCorrect && (
                    <div className="result-answer correct-answer">
                      <strong>Correct answer:</strong> {answer?.correctAnswer}
                    </div>
                  )}
                </div>
              );
            })
            : // If we only have graded answers
            Object.entries(answers).map(([questionId, answer], idx) => {
              const isCorrect = answer?.isCorrect;

              return (
                <div
                  key={questionId}
                  className={`result-question ${isCorrect ? "correct" : "incorrect"
                    }`}
                >
                  <div className="result-question-header">
                    <span>Question {idx + 1}</span>
                    <span
                      className={`result-question-status ${isCorrect ? "correct" : "incorrect"
                        }`}
                    >
                      {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                      {" - "}
                      {answer?.pointsEarned || 0} pts
                    </span>
                  </div>
                  <div className="result-answer your-answer">
                    <strong>Your answer:</strong>{" "}
                    {answer?.userAnswer || "(no answer)"}
                  </div>
                  {!isCorrect && (
                    <div className="result-answer correct-answer">
                      <strong>Correct answer:</strong> {answer?.correctAnswer}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Actions */}
      <div
        className="exam-card-actions"
        style={{ marginTop: "2rem", justifyContent: "center" }}
      >
        <Link to="/exams" className="btn-secondary">
          View more exams
        </Link>
        <Link to="/progress" className="btn-primary">
          View my progress
        </Link>
      </div>
    </div>
  );
}
