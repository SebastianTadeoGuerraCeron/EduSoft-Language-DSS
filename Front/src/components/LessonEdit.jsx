import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { API_URL } from "../API";
import "../styles/LessonEdit.css";

/**
 * Component to edit existing lessons
 * Allows:
 * - Edit module content and title
 * - Delete modules (minimum 1 required)
 */
export default function LessonEdit({ lessonId, lesson, onClose, onUpdate }) {
  const { user } = useAuth();
  const [editingModules, setEditingModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { moduleIndex, moduleTitle }

  const CHAR_LIMITS = {
    moduleTitle: 100,
    moduleContent: 2000,
  };

  useEffect(() => {
    if (lesson && lesson.modules) {
      setEditingModules(lesson.modules);
    }
  }, [lesson]);

  const handleEditModuleTitle = (idx, newTitle) => {
    if (newTitle.length > CHAR_LIMITS.moduleTitle) {
      return;
    }

    setEditingModules((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], titulo: newTitle };
      return updated;
    });
  };

  const handleEditModuleContent = (idx, newContent) => {
    if (newContent.length > CHAR_LIMITS.moduleContent) {
      return;
    }

    setEditingModules((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], contenido: newContent };
      return updated;
    });
  };

  const handleRemoveModule = (idx) => {
    // Validation: must have at least 1 module
    if (editingModules.length <= 1) {
      setError("You cannot delete the only module. There must be at least one.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    // Show confirmation
    setConfirmDelete({
      moduleIndex: idx,
      moduleTitle: editingModules[idx].titulo,
    });
  };

  const confirmRemoveModule = () => {
    if (confirmDelete) {
      setEditingModules((prev) =>
        prev.filter((_, i) => i !== confirmDelete.moduleIndex)
      );
      setConfirmDelete(null);
    }
  };

  const handleSave = async () => {
    try {
      // Validation: at least 1 module
      if (editingModules.length === 0) {
        setError("At least one module is required");
        return;
      }

      // Validation: each module must have title and content
      for (let i = 0; i < editingModules.length; i++) {
        const module = editingModules[i];
        if (!module.titulo.trim()) {
          setError(`Module ${i + 1} must have a title`);
          return;
        }
        if (!module.contenido.trim()) {
          setError(`Module ${i + 1} must have content`);
          return;
        }
      }

      setLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("token");

      // Enviar actualización al backend
      const response = await axios.put(
        `${API_URL}/lessons/${lessonId}`,
        {
          modules: editingModules,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setSuccess("Changes saved successfully!");

      // Cerrar después de 2 segundos
      setTimeout(() => {
        if (onUpdate) {
          onUpdate();
        }
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error saving lesson:", err);
      setError(err.response?.data?.error || "Error saving changes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lesson-edit-overlay">
      <div className="lesson-edit-modal">
        <button className="close-btn" onClick={onClose} disabled={loading}>
          ×
        </button>

        <h2>📝 Edit Lesson</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Edit modules */}
        <div className="modules-edit-section">
          <h3>Modules ({editingModules.length})</h3>
          {editingModules.length === 0 ? (
            <p className="no-modules">No modules to edit</p>
          ) : (
            editingModules.map((module, idx) => (
              <div key={idx} className="module-edit-card">
                <div className="module-header">
                  <h4>Module {idx + 1}</h4>
                  <button
                    className="btn-remove-module"
                    onClick={() => handleRemoveModule(idx)}
                    disabled={editingModules.length <= 1}
                    title={
                      editingModules.length <= 1
                        ? "You cannot delete the only module"
                        : "Delete module"
                    }
                  >
                    Delete
                  </button>
                </div>

                {/* Edit module title */}
                <div className="form-group">
                  <label>Module Title</label>
                  <input
                    type="text"
                    value={module.titulo}
                    onChange={(e) => handleEditModuleTitle(idx, e.target.value)}
                    placeholder="Module Title"
                    maxLength={CHAR_LIMITS.moduleTitle}
                  />
                  <span className="char-count">
                    {module.titulo.length}/{CHAR_LIMITS.moduleTitle}
                  </span>
                </div>

                {/* Edit module content */}
                <div className="form-group">
                  <label>Module Content</label>
                  <textarea
                    value={module.contenido}
                    onChange={(e) => handleEditModuleContent(idx, e.target.value)}
                    placeholder="Module Content"
                    rows="6"
                  />
                  <span className="char-count">
                    {module.contenido.length}/{CHAR_LIMITS.moduleContent}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action buttons */}
        <div className="edit-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "✓ Save Changes"}
          </button>
        </div>
      </div>

      {/* Confirmation modal to delete module */}
      {confirmDelete && (
        <div className="confirmation-overlay" onClick={() => setConfirmDelete(null)}>
          <div
            className="confirmation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>⚠️ Confirm Deletion</h3>
            <p>
              Are you sure you want to delete the module{" "}
              <strong>"{confirmDelete.moduleTitle}"</strong>?
            </p>
            <p className="confirmation-hint">
              This action cannot be undone.
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
                onClick={confirmRemoveModule}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
