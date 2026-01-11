// Helper para obtener Octokit (paquete ESM) desde runtime CommonJS.

let octokitPromise: Promise<any> | null = null;
const getOctokit = async () => {
  if (!octokitPromise) {
    const importModule = new Function(
      "modulePath",
      "return import(modulePath)"
    ) as (modulePath: string) => Promise<any>;

    octokitPromise = importModule("@octokit/rest").then(({ Octokit }) =>
      new Octokit({
        auth: process.env.GITHUB_TOKEN,
      })
    );
  }

  return octokitPromise;
};

interface UploadOptions {
  lessonId: string;
  fileName: string;
  fileContent: Buffer;
  filePath?: string; // Ruta relativa dentro de la carpeta de la lección
}

interface FileMetadata {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  sha: string;
}

/**
 * Sube un archivo a GitHub de forma segura
 * @param options - Opciones de carga
 * @returns Información del archivo subido
 */
export const uploadFileToGitHub = async (options: UploadOptions) => {
  const {
    lessonId,
    fileName,
    fileContent,
    filePath = "files",
  } = options;

  try {
    const fullPath = `lessons/${lessonId}/${filePath}/${fileName}`;
    const sha = await getFileSha(fullPath);
    const octokit = await getOctokit();

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: fullPath,
      message: `Add lesson file: ${fileName} (lesson: ${lessonId})`,
      content: fileContent.toString("base64"),
      sha: sha, // Solo se incluye si el archivo ya existe
      branch: process.env.GITHUB_BRANCH || "main",
    });

    return {
      success: true,
      fileName,
      path: fullPath,
      url: response.data.content?.html_url || "",
      sha: response.data.commit.sha,
      message: `Archivo ${fileName} subido exitosamente a GitHub`,
    };
  } catch (error) {
    
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);
    }
    
    // Si es un error de Octokit, mostrar más detalles
    if (error && typeof error === 'object' && 'status' in error) {
      const octoError = error as any;
      console.error("Status:", octoError.status);
      console.error("Response:", octoError.response);
    }
    
    throw new Error(
      `Error al subir archivo a GitHub: ${error instanceof Error ? error.message : "Error desconocido"}`
    );
  }
};

/**
 * Descarga un archivo de GitHub de forma segura
 * Este método está diseñado para ser llamado desde el backend
 * El frontend no accede directamente al repositorio privado
 * @param lessonId - ID de la lección
 * @param fileName - Nombre del archivo
 * @param filePath - Ruta relativa dentro de la carpeta de la lección
 * @returns Buffer con el contenido del archivo
 */
export const downloadFileFromGitHub = async (
  lessonId: string,
  fileName: string,
  filePath: string = "files"
): Promise<Buffer> => {
  try {
    const fullPath = `lessons/${lessonId}/${filePath}/${fileName}`;
    const octokit = await getOctokit();

    const response = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: fullPath,
      branch: process.env.GITHUB_BRANCH || "main",
    });

    // Si es un directorio, lanzar error
    if (Array.isArray(response.data)) {
      throw new Error("La ruta especificada es un directorio");
    }

    // GitHub devuelve el contenido en base64
    if ("content" in response.data) {
      return Buffer.from(response.data.content, "base64");
    }

    throw new Error("No se pudo obtener el contenido del archivo");
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(`Archivo no encontrado: ${fileName}`);
    }
    console.error("Error downloading from GitHub:", error);
    throw new Error(
      `Error al descargar archivo de GitHub: ${error.message}`
    );
  }
};

/**
 * Obtiene la lista de archivos en una lección
 * @param lessonId - ID de la lección
 * @param filePath - Ruta relativa dentro de la carpeta de la lección
 * @returns Array de archivos con metadatos
 */
export const listFilesFromGitHub = async (
  lessonId: string,
  filePath: string = "files"
): Promise<FileMetadata[]> => {
  try {
    const dirPath = `lessons/${lessonId}/${filePath}`;
    const octokit = await getOctokit();

    const response = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: dirPath,
      branch: process.env.GITHUB_BRANCH || "main",
    });

    // Si no es un array, es un archivo único
    if (!Array.isArray(response.data)) {
      throw new Error("La ruta especificada no es un directorio");
    }

    return response.data
      .filter((item: any) => item.type === "file") // Solo archivos, no directorios
      .map((item: any) => ({
        name: item.name,
        size: item.size || 0,
        type: getFileType(item.name),
        uploadedAt: new Date().toISOString(), // GitHub no proporciona fecha exacta por API
        sha: item.sha,
      }));
  } catch (error: any) {
    if (error.status === 404) {
      // Si el directorio no existe, devolver array vacío
      return [];
    }
    console.error("Error listing files from GitHub:", error);
    throw new Error(
      `Error al listar archivos de GitHub: ${error.message}`
    );
  }
};

/**
 * Elimina un archivo de GitHub
 * @param lessonId - ID de la lección
 * @param fileName - Nombre del archivo
 * @param filePath - Ruta relativa dentro de la carpeta de la lección
 * @returns Confirmación de eliminación
 */
export const deleteFileFromGitHub = async (
  lessonId: string,
  fileName: string,
  filePath: string = "files"
): Promise<{ success: boolean; message: string }> => {
  try {
    const fullPath = `lessons/${lessonId}/${filePath}/${fileName}`;
    const octokit = await getOctokit();

    // Primero obtener el SHA del archivo
    const response = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: fullPath,
      branch: process.env.GITHUB_BRANCH || "main",
    });

    if (Array.isArray(response.data)) {
      throw new Error("La ruta especificada es un directorio");
    }

    // Eliminar el archivo
    await octokit.rest.repos.deleteFile({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: fullPath,
      message: `Delete lesson file: ${fileName} (lesson: ${lessonId})`,
      sha: response.data.sha,
      branch: process.env.GITHUB_BRANCH || "main",
    });

    return {
      success: true,
      message: `Archivo ${fileName} eliminado exitosamente`,
    };
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(`Archivo no encontrado: ${fileName}`);
    }
    console.error("Error deleting from GitHub:", error);
    throw new Error(
      `Error al eliminar archivo de GitHub: ${error.message}`
    );
  }
};

/**
 * Obtiene el SHA de un archivo (para actualizar archivos existentes)
 * @param filePath - Ruta completa del archivo
 * @returns SHA del archivo o undefined si no existe
 */
const getFileSha = async (filePath: string): Promise<string | undefined> => {
  try {    const octokit = await getOctokit();    const response = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: filePath,
      branch: process.env.GITHUB_BRANCH || "main",
    });

    if (Array.isArray(response.data)) {
      return undefined;
    }

    return response.data.sha;
  } catch (error: any) {
    if (error.status === 404) {
      return undefined;
    }
    throw error;
  }
};

/**
 * Determina el tipo de archivo basado en la extensión
 * @param fileName - Nombre del archivo
 * @returns Tipo MIME
 */
const getFileType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
    txt: "text/plain",
    doc: "application/msword",
    docx:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
  };

  return mimeTypes[ext] || "application/octet-stream";
};

/**
 * Verifica la conexión con GitHub
 * @returns true si la conexión es exitosa
 */
export const testGitHubConnection = async (): Promise<boolean> => {
  try {    const octokit = await getOctokit();    await octokit.rest.repos.get({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    });
    return true;
  } catch (error) {
    console.error("GitHub connection test failed:", error);
    return false;
  }
};
