import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import "../styles/LessonEdit.css";

/**
 * Componente para editar lecciones existentes
 * Permite:
 * - Editar contenido y título de módulos
 * - Eliminar módulos (mínimo 1 requerido)
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
    // Validación: debe haber al menos 1 módulo
    if (editingModules.length <= 1) {
      setError("❌ No puedes eliminar el único módulo. Debe haber al menos uno.");
      setTimeout(() => setError(""), 4000);
      return;
    }

    // Mostrar confirmación
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
      // Validación: al menos 1 módulo
      if (editingModules.length === 0) {
        setError("❌ Se requiere al menos un módulo");
        return;
      }

      // Validación: cada módulo debe tener título y contenido
      for (let i = 0; i < editingModules.length; i++) {
        const module = editingModules[i];
        if (!module.titulo.trim()) {
          setError(`❌ El módulo ${i + 1} debe tener un título`);
          return;
        }
        if (!module.contenido.trim()) {
          setError(`❌ El módulo ${i + 1} debe tener contenido`);
          return;
        }
      }

      setLoading(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("token");

      // Enviar actualización al backend
      const response = await axios.put(
        `http://localhost:3000/lessons/${lessonId}`,
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

      setSuccess("✅ ¡Cambios guardados exitosamente!");

      // Cerrar después de 2 segundos
      setTimeout(() => {
        if (onUpdate) {
          onUpdate();
        }
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error saving lesson:", err);
      setError(err.response?.data?.error || "Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lesson-edit-overlay">
      <div className="lesson-edit-modal">
        <button className="close-btn" onClick={onClose} disabled={loading}>
          ✕
        </button>

        <h2>📝 Editar Lección</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Editar módulos */}
        <div className="modules-edit-section">
          <h3>Módulos ({editingModules.length})</h3>
          {editingModules.length === 0 ? (
            <p className="no-modules">No hay módulos para editar</p>
          ) : (
            editingModules.map((module, idx) => (
              <div key={idx} className="module-edit-card">
                <div className="module-header">
                  <h4>Módulo {idx + 1}</h4>
                  <button
                    className="btn-remove-module"
                    onClick={() => handleRemoveModule(idx)}
                    disabled={editingModules.length <= 1}
                    title={
                      editingModules.length <= 1
                        ? "No puedes eliminar el único módulo"
                        : "Eliminar módulo"
                    }
                  >
                    ✕ Eliminar
                  </button>
                </div>

                {/* Editar título del módulo */}
                <div className="form-group">
                  <label>Título del módulo</label>
                  <input
                    type="text"
                    value={module.titulo}
                    onChange={(e) => handleEditModuleTitle(idx, e.target.value)}
                    placeholder="Título del módulo"
                    maxLength={CHAR_LIMITS.moduleTitle}
                  />
                  <span className="char-count">
                    {module.titulo.length}/{CHAR_LIMITS.moduleTitle}
                  </span>
                </div>

                {/* Editar contenido del módulo */}
                <div className="form-group">
                  <label>Contenido del módulo</label>
                  <textarea
                    value={module.contenido}
                    onChange={(e) => handleEditModuleContent(idx, e.target.value)}
                    placeholder="Contenido del módulo"
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

        {/* Botones de acción */}
        <div className="edit-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Guardando..." : "✓ Guardar Cambios"}
          </button>
        </div>
      </div>

      {/* Modal de confirmación para eliminar módulo */}
      {confirmDelete && (
        <div className="confirmation-overlay" onClick={() => setConfirmDelete(null)}>
          <div
            className="confirmation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>⚠️ Confirmar eliminación</h3>
            <p>
              ¿Estás seguro de que deseas eliminar el módulo{" "}
              <strong>"{confirmDelete.moduleTitle}"</strong>?
            </p>
            <p className="confirmation-hint">
              Esta acción no se puede deshacer.
            </p>
            <div className="confirmation-actions">
              <button
                className="btn-confirmation-cancel"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                className="btn-confirmation-delete"
                onClick={confirmRemoveModule}
              >
                ✕ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
