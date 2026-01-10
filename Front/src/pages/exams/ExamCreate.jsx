import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { createExam, getTutorLessons } from "../../services/examService";
import "../../styles/Exams.css";

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "TRUE_FALSE", label: "True/False" },
  { value: "SHORT_ANSWER", label: "Short Answer" },
  { value: "FILL_BLANK", label: "Fill in the Blank" },
];

export default function ExamCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    lessonId: "",
    isPremium: false,
    timeLimit: 30,
    passingPercentage: 60,
  });

  const [questions, setQuestions] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load tutor lessons on mount
  useEffect(() => {
    fetchTutorLessons();
  }, []);

  const fetchTutorLessons = async () => {
    try {
      setLoadingLessons(true);
      const data = await getTutorLessons();
      setLessons(data.lessons || []);
    } catch (err) {
      setError("Error loading lessons");
      console.error(err);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Functions to handle questions
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: "",
        type: "MULTIPLE_CHOICE",
        options: ["", "", "", ""],
        correctAnswer: "",
        points: 1,
      },
    ]);
  };

  const removeQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id, field, value) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateQuestionOption = (questionId, optionIndex, value) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const addOption = (questionId) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.options.length < 6) {
          return { ...q, options: [...q.options, ""] };
        }
        return q;
      })
    );
  };

  const removeOption = (questionId, optionIndex) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.options.length > 2) {
          const newOptions = q.options.filter((_, i) => i !== optionIndex);
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validations
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.lessonId) {
      setError("You must select a lesson");
      return;
    }

    if (questions.length === 0) {
      setError("You must add at least one question");
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1} has no text`);
        return;
      }
      if (!q.correctAnswer.trim()) {
        setError(`Question ${i + 1} has no correct answer`);
        return;
      }
      if (q.type === "MULTIPLE_CHOICE") {
        const validOptions = q.options.filter((o) => o.trim());
        if (validOptions.length < 2) {
          setError(`Question ${i + 1} must have at least 2 options`);
          return;
        }
        if (!q.options.includes(q.correctAnswer)) {
          setError(
            `The correct answer for question ${i + 1
            } must be one of the options`
          );
          return;
        }
      }
    }

    try {
      setLoading(true);

      const examData = {
        ...formData,
        timeLimit: parseInt(formData.timeLimit, 10),
        passingPercentage: parseInt(formData.passingPercentage, 10),
        questions: questions.map((q) => ({
          text: q.text,
          type: q.type,
          options:
            q.type === "MULTIPLE_CHOICE"
              ? q.options.filter((o) => o.trim())
              : null,
          correctAnswer: q.correctAnswer,
          points: parseInt(q.points, 10) || 1,
        })),
      };

      await createExam(examData);
      setSuccess("Exam created successfully!");

      setTimeout(() => {
        navigate("/exams");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Error creating exam");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingLessons) {
    return (
      <div className="exam-create-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="exam-create-container">
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <h3>You have no created lessons</h3>
          <p>You must create a lesson before you can create an exam</p>
          <button
            className="btn-primary"
            onClick={() => navigate("/tutor/create-lesson")}
            style={{ marginTop: "1rem" }}
          >
            Create Lesson
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-create-container">
      <div className="exam-create-header">
        <h1> Create New Exam</h1>
        <p>Create an exam to evaluate your students</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form className="exam-form" onSubmit={handleSubmit}>
        {/* General Configuration */}
        <div className="form-section">
          <h2>General Information</h2>

          <div className="form-group">
            <label htmlFor="title">Exam Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="E.g: Grammar Exam - Basic Level"
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the content and objectives of the exam..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="form-group">
            <label htmlFor="lessonId">Associated Lesson *</label>
            <select
              id="lessonId"
              name="lessonId"
              value={formData.lessonId}
              onChange={handleInputChange}
              required
            >
              <option value="">Select a lesson</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title} {lesson.isPremium ? "(PRO)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="timeLimit">Time Limit (minutes) *</label>
              <input
                type="number"
                id="timeLimit"
                name="timeLimit"
                value={formData.timeLimit}
                onChange={handleInputChange}
                min={5}
                max={180}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="passingPercentage">% to Pass *</label>
              <input
                type="number"
                id="passingPercentage"
                name="passingPercentage"
                value={formData.passingPercentage}
                onChange={handleInputChange}
                min={1}
                max={100}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="isPremium"
                name="isPremium"
                checked={formData.isPremium}
                onChange={handleInputChange}
              />
              <label htmlFor="isPremium">
                Premium Exam (only for PRO subscribers)
              </label>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="form-section questions-section">
          <h2>Questions ({questions.length})</h2>

          <div className="questions-list">
            {questions.map((question, index) => (
              <div key={question.id} className="question-item">
                <div className="question-item-header">
                  <span className="question-number">Question {index + 1}</span>
                  <button
                    type="button"
                    className="question-remove"
                    onClick={() => removeQuestion(question.id)}
                    aria-label="Delete question"
                  >
                    ×
                  </button>
                </div>

                <div className="form-group">
                  <label>Question text *</label>
                  <textarea
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, "text", e.target.value)
                    }
                    placeholder="Write the question..."
                    rows={2}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Question type</label>
                    <select
                      value={question.type}
                      onChange={(e) =>
                        updateQuestion(question.id, "type", e.target.value)
                      }
                    >
                      {QUESTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Points</label>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) =>
                        updateQuestion(question.id, "points", e.target.value)
                      }
                      min={1}
                      max={10}
                    />
                  </div>
                </div>

                {/* Options for multiple choice */}
                {question.type === "MULTIPLE_CHOICE" && (
                  <div className="options-list">
                    <label>Options (select the correct one)</label>
                    {question.options.map((option, optIdx) => (
                      <div key={optIdx} className="option-item">
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={
                            question.correctAnswer === option &&
                            option.trim() !== ""
                          }
                          onChange={() =>
                            updateQuestion(question.id, "correctAnswer", option)
                          }
                          disabled={!option.trim()}
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) =>
                            updateQuestionOption(
                              question.id,
                              optIdx,
                              e.target.value
                            )
                          }
                          placeholder={`Option ${optIdx + 1}`}
                        />
                        {question.options.length > 2 && (
                          <button
                            type="button"
                            className="option-remove"
                            onClick={() => removeOption(question.id, optIdx)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {question.options.length < 6 && (
                      <button
                        type="button"
                        className="add-option-btn"
                        onClick={() => addOption(question.id)}
                      >
                        + Add option
                      </button>
                    )}
                  </div>
                )}

                {/* Answer for true/false */}
                {question.type === "TRUE_FALSE" && (
                  <div className="form-group">
                    <label>Correct answer</label>
                    <select
                      value={question.correctAnswer}
                      onChange={(e) =>
                        updateQuestion(
                          question.id,
                          "correctAnswer",
                          e.target.value
                        )
                      }
                    >
                      <option value="">Select...</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                )}

                {/* Answer for short answer or fill blank */}
                {(question.type === "SHORT_ANSWER" ||
                  question.type === "FILL_BLANK") && (
                    <div className="form-group">
                      <label>Correct answer *</label>
                      <input
                        type="text"
                        value={question.correctAnswer}
                        onChange={(e) =>
                          updateQuestion(
                            question.id,
                            "correctAnswer",
                            e.target.value
                          )
                        }
                        placeholder="Write the correct answer..."
                      />
                    </div>
                  )}
              </div>
            ))}

            <button
              type="button"
              className="add-question-btn"
              onClick={addQuestion}
            >
              ➕ Add Question
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className="exam-card-actions"
          style={{ marginTop: "2rem", justifyContent: "flex-end" }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || questions.length === 0}
          >
            {loading ? "Creating..." : "Publish Exam"}
          </button>
        </div>
      </form>
    </div>
  );
}
