import { useEffect, useState } from "react";
import api from "../API";
import "../styles/LessonFiles.css";

/**
 * Component to manage lesson files securely
 * - Upload: Only tutors who created the lesson
 * - Download: Tutors and assigned students
 * - Delete: Only tutors who created the lesson
 *
 * Uses backend as proxy to access GitHub securely
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

  // Load file list when mounting
  useEffect(() => {
    loadFiles();
  }, [lessonId, token]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  /**
   * Loads the list of files for a lesson from the backend
   */
  const loadFiles = async () => {
    if (!token) {
      setError("Not authorized");
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
        // No files yet
        setFiles([]);
      } else {
        setError(err.response?.data?.error || "Error loading files");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Uploads a file securely to the backend
   * The backend uploads it to GitHub using its private token
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

      setSuccess(`${file.name} uploaded successfully`);

      // Reload file list
      await loadFiles();

      // Clear input
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
   * Downloads a file securely from the backend
   * The backend validates permissions before serving from GitHub
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
   * Opens a PDF in the browser (inline)
   */
  const handleViewPDF = (fileName) => {
    const viewUrl = `/lessons/${lessonId}/view-file/${encodeURIComponent(fileName)}`;
    window.open(viewUrl, "_blank");
  };

  /**
   * Deletes a file (tutors only)
   */
  const handleDelete = async (fileName) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
      return;
    }

    try {
      await api.delete(
        `/lessons/${lessonId}/files/${encodeURIComponent(fileName)}`
      );

      setSuccess(`${fileName} deleted`);
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
        <h3>📁 Lesson Files</h3>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          <button
            className="alert-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      )}

      {/* Upload Section (tutors only) */}
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
              {uploading ? "Uploading..." : "⬆️ Upload File"}
            </span>
          </label>
          <p className="upload-help">
            Maximum 50MB. Formats: PDF, images, video, audio
          </p>
        </div>
      )}

      {/* File Section */}
      <div className="files-section">
        {loading ? (
          <div className="loading">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="no-files">
            No files {canUpload && "- upload your first file"}
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
                    title="Download file"
                  >
                    📥 Download
                  </button>

                  {canDelete && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(file.name)}
                      title="Delete file"
                    >
                      🗑️ Delete
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
