import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { createLesson } from "../services/lessonService";
import axios from "axios";
import "../styles/LessonCreation.css";

export default function LessonCreation() {
  const { user, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "TEXT",
    level: "BEGINNER",
    isPremium: false,
    content: "",
    miniatura: null,
    duration: null,
    modules: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [uploadingModuleId, setUploadingModuleId] = useState(null);
  
  // State para archivos a subir
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Character limits
  const CHAR_LIMITS = {
    title: 100,
    description: 500,
    moduleTitle: 100,
    moduleContent: 2000,
  };

  // File upload limits
  const FILE_LIMITS = {
    maxFileSize: 10 * 1024 * 1024, // 10MB por archivo
    maxTotalSize: 50 * 1024 * 1024, // 50MB total
    maxFiles: 10, // Máximo 10 archivos
  };

  // Auto-hide success toast
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
        setSuccess("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleBasicInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === "checkbox" ? checked : value;
    
    // Validar límites de caracteres
    if (name === "title" && value.length > CHAR_LIMITS.title) {
      return;
    }
    if (name === "description" && value.length > CHAR_LIMITS.description) {
      return;
    }
    
    // Convertir duration a número
    if (name === "duration" && value !== "") {
      finalValue = parseInt(value, 10) || null;
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleAddModule = () => {
    if (formData.modules.length >= 5) {
      setError("Maximum 5 modules per lesson");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      modules: [...prev.modules, { titulo: "", contenido: "" }],
    }));
  };

  const handleRemoveModule = (idx) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== idx),
    }));
  };

  const handleModuleChange = (idx, field, value) => {
    // Validar límites de caracteres
    if (field === "titulo" && value.length > CHAR_LIMITS.moduleTitle) {
      return;
    }
    if (field === "contenido" && value.length > CHAR_LIMITS.moduleContent) {
      return;
    }
    
    setFormData((prev) => {
      const newModules = [...prev.modules];
      newModules[idx] = { ...newModules[idx], [field]: value };
      return { ...prev, modules: newModules };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Debug: Verificar token en localStorage
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      console.log("=== DEBUG SUBMIT ===");
      console.log("Token en localStorage:", token ? "✓ Existe" : "✗ NO existe");
      console.log("User en localStorage:", storedUser ? "✓ Existe" : "✗ NO existe");
      console.log("isAuthenticated:", isAuthenticated);
      console.log("user object:", user);
      console.log("formData being sent:", JSON.stringify(formData, null, 2));
      
      // Verificar autenticación
      if (!isAuthenticated || !user) {
        setError("You must be logged in to create a lesson");
        setLoading(false);
        return;
      }

      // Verificar rol TUTOR
      if (user.role !== "TUTOR") {
        setError("Only tutors can create lessons");
        setLoading(false);
        return;
      }

      // Validar título (obligatorio)
      if (!formData.title.trim()) {
        setError("El título de la lección es obligatorio");
        setLoading(false);
        return;
      }

      // Validar descripción (obligatoria)
      if (!formData.description.trim()) {
        setError("La descripción es obligatoria");
        setLoading(false);
        return;
      }

      // Validar mínimo 1 módulo
      if (formData.modules.length === 0) {
        setError("Se requiere al menos un módulo");
        setLoading(false);
        return;
      }

      // Validar que cada módulo tenga título y contenido
      for (let i = 0; i < formData.modules.length; i++) {
        const module = formData.modules[i];
        if (!module.titulo.trim()) {
          setError(`El módulo ${i + 1} debe tener un título`);
          setLoading(false);
          return;
        }
        if (!module.contenido.trim()) {
          setError(`El módulo ${i + 1} debe tener contenido`);
          setLoading(false);
          return;
        }
      }

      // Crear la lección
      const response = await createLesson(formData);
      const lessonId = response.lesson.id;

      // Subir archivos si existen
      if (pendingFiles.length > 0) {
        setUploading(true);
        for (const file of pendingFiles) {
          try {
            const formDataFile = new FormData();
            formDataFile.append("file", file);
            
            await axios.post(
              `http://localhost:3000/lessons/${lessonId}/upload-file`,
              formDataFile,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                  Authorization: `Bearer ${token}`,
                },
              }
            );
          } catch (fileErr) {
            console.error(`Error uploading file ${file.name}:`, fileErr);
          }
        }
        setUploading(false);
      }

      setSuccess("✅ ¡Lección creada exitosamente!");
      setShowToast(true);
      setFormData({
        title: "",
        description: "",
        type: "TEXT",
        level: "BEGINNER",
        isPremium: false,
        content: "",
        miniatura: null,
        duration: null,
        modules: [],
      });
      setPendingFiles([]);
    } catch (err) {
      setError(err.response?.data?.error || "Error creating lesson");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFile = (e) => {
    const files = Array.from(e.target.files);
    
    // Validar cantidad de archivos
    if (pendingFiles.length + files.length > FILE_LIMITS.maxFiles) {
      setError(`❌ Máximo ${FILE_LIMITS.maxFiles} archivos permitidos. Ya tienes ${pendingFiles.length}`);
      return;
    }

    let totalNewSize = 0;
    const currentTotalSize = pendingFiles.reduce((sum, f) => sum + f.size, 0);

    for (const file of files) {
      // Validar tamaño individual
      if (file.size > FILE_LIMITS.maxFileSize) {
        setError(
          `❌ Archivo "${file.name}" es muy grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo permitido: 10MB`
        );
        return;
      }
      totalNewSize += file.size;
    }

    // Validar tamaño total
    if (currentTotalSize + totalNewSize > FILE_LIMITS.maxTotalSize) {
      setError(
        `❌ El tamaño total de archivos excede 50MB. Tienes ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB + intenta agregar ${(totalNewSize / 1024 / 1024).toFixed(2)}MB`
      );
      return;
    }

    // Validar que sean PDFs
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError(`❌ Solo se permiten archivos PDF. "${file.name}" no es un PDF`);
        return;
      }
    }

    setError(""); // Limpiar errores si todo es válido
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="lesson-creation-container">
      {/* Toast Notification */}
      {showToast && (
        <div className="toast toast-success">
          <div className="toast-content">
            <span>{success}</span>
            <button
              className="toast-close"
              onClick={() => setShowToast(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="lesson-creation-header">
        <h1>Create New Lesson</h1>
        <p>Create an engaging lesson with multiple modules for your students</p>
      </div>

      {!isAuthenticated && (
        <div className="alert alert-error">
          You must be logged in to create a lesson. Please log in first.
        </div>
      )}

      {isAuthenticated && user?.role !== "TUTOR" && (
        <div className="alert alert-error">
          Only tutors can create lessons. Your current role is: {user?.role}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="lesson-form">
        {/* Basic Information Section */}
        <section className="form-section">
          <h2>Basic Information</h2>
          <div className="form-group">
            <label htmlFor="title">
              Lesson Title * 
              <span className="char-count">{formData.title.length}/{CHAR_LIMITS.title}</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleBasicInputChange}
              placeholder="Enter lesson title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">
              Description * 
              <span className="char-count">{formData.description.length}/{CHAR_LIMITS.description}</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleBasicInputChange}
              placeholder="Enter lesson description"
              rows="4"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="level">Level</label>
              <select
                id="level"
                name="level"
                value={formData.level}
                onChange={handleBasicInputChange}
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="duration">Duration (minutes)</label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration || ""}
                onChange={handleBasicInputChange}
                placeholder="e.g., 45"
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  name="isPremium"
                  checked={formData.isPremium}
                  onChange={handleBasicInputChange}
                />
                <span>This is a Premium Lesson</span>
              </label>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="form-section">
          <h2>Content</h2>
          <div className="form-group">
            <label htmlFor="content">Main Content</label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleBasicInputChange}
              placeholder="Enter main lesson content"
              rows="4"
            />
          </div>
        </section>

        {/* Modules Section */}
        <section className="form-section">
          <div className="modules-header">
            <h2>Lesson Modules (Max 5)</h2>
            <button
              type="button"
              className="btn-add-module"
              onClick={handleAddModule}
              disabled={formData.modules.length >= 5}
            >
              + Add Module
            </button>
          </div>

          {formData.modules.length === 0 && (
            <p className="info-text">Add at least one module to your lesson</p>
          )}

          {formData.modules.map((module, idx) => (
            <div key={idx} className="module-card">
              <div className="form-group">
                <label htmlFor={`module-title-${idx}`}>
                  Module Title * 
                  <span className="char-count">{module.titulo.length}/{CHAR_LIMITS.moduleTitle}</span>
                </label>
                <input
                  type="text"
                  id={`module-title-${idx}`}
                  value={module.titulo}
                  onChange={(e) => handleModuleChange(idx, "titulo", e.target.value)}
                  placeholder="e.g., Introduction to Grammar"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor={`module-content-${idx}`}>
                  Module Content * 
                  <span className="char-count">{module.contenido.length}/{CHAR_LIMITS.moduleContent}</span>
                </label>
                <textarea
                  id={`module-content-${idx}`}
                  value={module.contenido}
                  onChange={(e) => handleModuleChange(idx, "contenido", e.target.value)}
                  placeholder="Enter module content"
                  rows="4"
                  required
                />
              </div>

              <button
                type="button"
                className="btn-remove-module"
                onClick={() => handleRemoveModule(idx)}
              >
                Remove Module
              </button>
            </div>
          ))}
        </section>

        {/* Files Section (Optional) */}
        <section className="form-section">
          <h2>📁 Archivos para la Lección (Opcional)</h2>
          <p className="info-text">Sube archivos PDF para tu lección.</p>
          
          <div className="file-upload-area">
            <input
              type="file"
              id="lesson-files"
              multiple
              onChange={handleAddFile}
              accept=".pdf"
            />
            <label htmlFor="lesson-files" className="file-upload-label">
              <span>📎 Selecciona archivos PDF</span>
              <small>Solo archivos PDF</small>
            </label>
          </div>

          {pendingFiles.length > 0 && (
            <div className="pending-files-list">
              <h4>Archivos a subir ({pendingFiles.length}):</h4>
              <ul>
                {pendingFiles.map((file, idx) => (
                  <li key={idx}>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024).toFixed(2)} KB)</span>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={() => handleRemoveFile(idx)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={loading || uploading}
          >
            {loading ? "Creating Lesson..." : uploading ? "Uploading Files..." : "Create Lesson"}
          </button>
        </div>
      </form>
    </div>
  );
}
