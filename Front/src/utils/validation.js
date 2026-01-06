/**
 * Validar fortaleza de contraseña
 * Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número
 */
export const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Must have at least ${minLength} characters`);
  }
  if (!hasUpperCase) {
    errors.push("Must contain at least one uppercase letter");
  }
  if (!hasLowerCase) {
    errors.push("Must contain at least one lowercase letter");
  }
  if (!hasNumber) {
    errors.push("Must contain at least one number");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validar formato de email
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Obtener nivel de fortaleza de contraseña (débil, media, fuerte)
 */
export const getPasswordStrength = (password) => {
  if (!password) return { level: "none", label: "No password" };

  let score = 0;

  // Length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Complexity
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++; // Special characters

  if (score <= 2) return { level: "weak", label: "Weak", color: "red" };
  if (score <= 4) return { level: "medium", label: "Medium", color: "orange" };
  return { level: "strong", label: "Strong", color: "green" };
};

/**
 * Sanitizar input para prevenir XSS básico
 */
export const sanitizeInput = (input) => {
  if (typeof input !== "string") return "";
  return input.trim().replace(/[<>]/g, "").substring(0, 500);
};
