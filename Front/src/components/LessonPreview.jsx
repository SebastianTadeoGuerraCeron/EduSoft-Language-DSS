import { useState } from "react";
import "../styles/LessonPreview.css";

export default function LessonPreview({ lesson, onClose }) {
  const [activeModule, setActiveModule] = useState(0);

  if (!lesson) return null;

  const currentModule = lesson.modules?.[activeModule];

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div className="preview-title-section">
            <h2>{lesson.title}</h2>
            <p className="preview-description">{lesson.description}</p>
          </div>
          <button className="preview-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="preview-content">
          {/* Módulos */}
          <div className="preview-modules">
            <h3>Modules ({lesson.modules?.length || 0})</h3>
            <div className="module-tabs">
              {lesson.modules?.map((mod, idx) => (
                <button
                  key={idx}
                  className={`module-tab ${activeModule === idx ? "active" : ""}`}
                  onClick={() => setActiveModule(idx)}
                >
                  Module {idx + 1}: {mod.titulo}
                </button>
              ))}
            </div>

            {currentModule && (
              <div className="module-detail">
                <h4>{currentModule.titulo}</h4>
                <div className="module-content">
                  {currentModule.contenido}
                </div>
              </div>
            )}
          </div>

          {/* Información de la lección */}
          <div className="preview-info">
            <div className="info-row">
              <span className="info-label">Level:</span>
              <span className="info-value">{lesson.level}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Type:</span>
              <span className="info-value">{lesson.type}</span>
            </div>
            {lesson.duration && (
              <div className="info-row">
                <span className="info-label">Duration:</span>
                <span className="info-value">{lesson.duration} min</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Status:</span>
              <span className="info-value">
                {lesson.isPremium ? "PRO" : "FREE"}
              </span>
            </div>
          </div>
        </div>

        <div className="preview-footer">
          <p className="preview-hint">
            This is a preview of what your students will see
          </p>
          <button className="btn-close-preview" onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
