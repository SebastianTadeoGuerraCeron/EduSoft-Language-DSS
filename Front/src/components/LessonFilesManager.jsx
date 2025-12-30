import { useEffect, useState } from "react";
import api from "../API";
import "../styles/LessonFiles.css";

/**
 * Componente para gestionar archivos de lecciones de forma segura
 * - Upload: Solo tutores que crearon la lección
 * - Download: Tutores y estudiantes asignados
 * - Delete: Solo tutores que crearon la lección
 *
 * Usa backend como proxy para acceder a GitHub de forma segura
 */

export default function LessonFilesManager({
  lessonId,
  canUpload = false,
  canDelete = false,
  token,
}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Cargar lista de archivos al montar
  useEffect(() => {
    loadFiles();
  }, [lessonId, token]);

  // Limpiar mensajes después de 5 segundos
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  /**
   * Carga la lista de archivos de una lección desde el backend
   */
  const loadFiles = async () => {
    if (!token) {
      setError("No autorizado");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/lessons/${lessonId}/files`);
      setFiles(response.data.files || []);
    } catch (err) {
      console.error("Error loading files:", err);
      if (err.response?.status === 404) {
        // Sin archivos aún
        setFiles([]);
      } else {
        setError(err.response?.data?.error || "Error loading files");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sube un archivo de forma segura al backend
   * El backend lo sube a GitHub usando su token privado
   */
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post(
        `/lessons/${lessonId}/upload-file`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSuccess(`✅ ${file.name} subido exitosamente`);

      // Recargar lista de archivos
      await loadFiles();

      // Limpiar input
      if (e.target instanceof HTMLInputElement) {
        e.target.value = "";
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      setError(err.response?.data?.error || "Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  /**
   * Descarga un archivo de forma segura desde el backend
   * El backend valida permisos antes de servir desde GitHub
   */
  const handleDownload = async (fileName) => {
    try {
      const response = await api.get(
        `/lessons/${lessonId}/download-file/${encodeURIComponent(fileName)}`,
        {
          responseType: "blob",
        }
      );

      // Crear URL para descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      setError(err.response?.data?.error || "Error downloading file");
    }
  };

  /**
   * Abre un PDF en el navegador (inline)
   */
  const handleViewPDF = (fileName) => {
    const viewUrl = `/lessons/${lessonId}/view-file/${encodeURIComponent(fileName)}`;
    window.open(viewUrl, "_blank");
  };

  /**
   * Elimina un archivo (solo tutores)
   */
  const handleDelete = async (fileName) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar ${fileName}?`)) {
      return;
    }

    try {
      await api.delete(
        `/lessons/${lessonId}/files/${encodeURIComponent(fileName)}`
      );

      setSuccess(`✅ ${fileName} eliminado`);
      await loadFiles();
    } catch (err) {
      console.error("Error deleting file:", err);
      setError(err.response?.data?.error || "Error deleting file");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const iconMap = {
      pdf: "📄",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      webp: "🖼️",
      mp4: "🎥",
      webm: "🎥",
      mp3: "🎵",
      txt: "📝",
      doc: "📘",
      docx: "📘",
      xls: "📊",
      xlsx: "📊",
    };
    return iconMap[ext] || "📁";
  };

  return (
    <div className="lesson-files-manager">
      <div className="files-header">
        <h3>📁 Archivos de la Lección</h3>
      </div>

      {/* Alertas */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          <button
            className="alert-close"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      )}

      {/* Sección de Upload (solo tutores) */}
      {canUpload && (
        <div className="upload-section">
          <label htmlFor="file-input" className="upload-label">
            <input
              id="file-input"
              type="file"
              onChange={handleUpload}
              disabled={uploading || !token}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.txt,.doc,.docx,.xls,.xlsx"
              className="file-input"
            />
            <span className="upload-button">
              {uploading ? "Subiendo..." : "⬆️ Subir Archivo"}
            </span>
          </label>
          <p className="upload-help">
            Máximo 50MB. Formatos: PDF, imágenes, video, audio
          </p>
        </div>
      )}

      {/* Sección de Archivos */}
      <div className="files-section">
        {loading ? (
          <div className="loading">Cargando archivos...</div>
        ) : files.length === 0 ? (
          <div className="no-files">
            Sin archivos {canUpload && "- sube tu primer archivo"}
          </div>
        ) : (
          <div className="files-list">
            {files.map((file) => (
              <div key={file.sha} className="file-item">
                <div className="file-info">
                  <span className="file-icon">
                    {getFileIcon(file.name)}
                  </span>
                  <div className="file-details">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      {formatFileSize(file.size)} • {file.type}
                    </div>
                  </div>
                </div>

                <div className="file-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleDownload(file.name)}
                    title="Descargar archivo"
                  >
                    📥 Descargar
                  </button>

                  {canDelete && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(file.name)}
                      title="Eliminar archivo"
                    >
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


    </div>
  );
}
