import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  getExamById,
  getTutorLessons,
  updateExam,
} from "../../services/examService";
import "../../styles/Exams.css";

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "TRUE_FALSE", label: "True/False" },
  { value: "SHORT_ANSWER", label: "Short Answer" },
  { value: "FILL_BLANK", label: "Fill in the Blank" },
];

export default function ExamEdit() {
  const navigate = useNavigate();
  const { id: examId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingExam, setLoadingExam] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lessons, setLessons] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    lessonId: "",
    timeLimit: 30,
    passingPercentage: 60,
    isPremium: false,
  });

  const [questions, setQuestions] = useState([]);

  // Fetch tutor lessons
  useEffect(() => {
    const fetchTutorLessons = async () => {
      try {
        const data = await getTutorLessons();
        setLessons(data.lessons || []);
      } catch (err) {
        console.error("Error loading lessons:", err);
        setError("Could not load lessons");
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchTutorLessons();
  }, []);

  // Fetch exam data
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const data = await getExamById(examId);
        const exam = data.exam;

        // Verify ownership
        if (exam.tutor?.id !== user?.id) {
          setError("You don't have permission to edit this exam");
          setTimeout(() => navigate("/exams"), 2000);
          return;
        }

        // Set form data
        setFormData({
          title: exam.title || "",
          description: exam.description || "",
          lessonId: exam.lessonId || "",
          timeLimit: exam.timeLimit || 30,
          passingPercentage: exam.passingPercentage || 60,
          isPremium: exam.isPremium || false,
        });

        // Set questions with local IDs
        const mappedQuestions = exam.questions.map((q, index) => ({
          id: `existing-${index}`,
          originalId: q.id,
          text: q.text || "",
          type: q.type || "MULTIPLE_CHOICE",
          points: q.points || 1,
          options: q.options || ["", "", "", ""],
          correctAnswer: q.correctAnswer || "",
        }));
        setQuestions(mappedQuestions);
      } catch (err) {
        console.error("Error loading exam:", err);
        setError("Could not load exam data");
      } finally {
        setLoadingExam(false);
      }
    };

    if (examId) {
      fetchExam();
    }
  }, [examId, user?.id, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addQuestion = () => {
    const newQuestion = {
      id: `new-${Date.now()}`,
      text: "",
      type: "MULTIPLE_CHOICE",
      points: 1,
      options: ["", "", "", ""],
      correctAnswer: "",
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (questionId) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestions(
      questions.map((q) => (q.id === questionId ? { ...q, [field]: value } : q))
    );
  };

  const updateQuestionOption = (questionId, optionIndex, value) => {
    setQuestions(
      questions.map((q) => {
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
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options.length < 6) {
          return { ...q, options: [...q.options, ""] };
        }
        return q;
      })
    );
  };

  const removeOption = (questionId, optionIndex) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId && q.options.length > 2) {
          const newOptions = q.options.filter((_, idx) => idx !== optionIndex);
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
    setLoading(true);

    // Validate questions
    if (questions.length === 0) {
      setError("You must add at least one question");
      setLoading(false);
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1}: Text is required`);
        setLoading(false);
        return;
      }
      if (!q.correctAnswer || !q.correctAnswer.toString().trim()) {
        setError(`Question ${i + 1}: A correct answer is required`);
        setLoading(false);
        return;
      }
      if (q.type === "MULTIPLE_CHOICE") {
        const validOptions = q.options.filter((opt) => opt.trim());
        if (validOptions.length < 2) {
          setError(`Question ${i + 1}: At least 2 valid options are required`);
          setLoading(false);
          return;
        }
        if (!validOptions.includes(q.correctAnswer)) {
          setError(
            `Question ${i + 1}: The correct answer must be one of the options`
          );
          setLoading(false);
          return;
        }
      }
    }

    try {
      const examData = {
        ...formData,
        lessonId: parseInt(formData.lessonId),
        timeLimit: parseInt(formData.timeLimit),
        passingPercentage: parseInt(formData.passingPercentage),
        questions: questions.map((q) => ({
          text: q.text,
          type: q.type,
          points: parseInt(q.points),
          options:
            q.type === "MULTIPLE_CHOICE"
              ? q.options.filter((opt) => opt.trim())
              : [],
          correctAnswer: q.correctAnswer,
        })),
      };

      await updateExam(examId, examData);
      setSuccess("Exam updated successfully!");
      setTimeout(() => navigate("/exams"), 1500);
    } catch (err) {
      console.error("Error updating exam:", err);
      setError(err.response?.data?.error || "Error updating exam");
    } finally {
      setLoading(false);
    }
  };

  if (loadingExam || loadingLessons) {
    return (
      <div className="exam-create-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading exam data...</p>
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
        <h1> Edit Exam</h1>
        <p>Modify your exam questions and settings</p>
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
            {loading ? "Saving..." : "💾 Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
