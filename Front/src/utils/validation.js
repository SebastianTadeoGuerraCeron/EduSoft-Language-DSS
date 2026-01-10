/**
 * HU03 - Calidad de Contraseñas
 * Validación robusta según FIA_SOS.1 (Verification of secrets)
 * Criterios: 8+ caracteres, mayúscula, número, carácter especial, sin username, sin secuencias
 */
export const validatePasswordStrength = (password, username = '') => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const errors = [];

  // 1. Longitud mínima
  if (password.length < minLength) {
    errors.push(`Must have at least ${minLength} characters`);
  }

  // 2. Mayúscula
  if (!hasUpperCase) {
    errors.push("Must contain at least one uppercase letter");
  }

  // 3. Minúscula
  if (!hasLowerCase) {
    errors.push("Must contain at least one lowercase letter");
  }

  // 4. Número
  if (!hasNumber) {
    errors.push("Must contain at least one number");
  }

  // 5. Carácter especial (REQUERIDO POR HU03)
  if (!hasSpecialChar) {
    errors.push("Must contain at least one special character (!@#$%^&*...)");
  }

  // 6. No debe contener el nombre de usuario
  if (username && username.length >= 3) {
    const usernameLower = username.toLowerCase();
    const passwordLower = password.toLowerCase();
    
    if (passwordLower.includes(usernameLower)) {
      errors.push('Password must not contain your username');
    }
  }

  // 7. No debe contener secuencias numéricas (REQUERIDO POR HU03)
  const numericSequences = [
    '012', '123', '234', '345', '456', '567', '678', '789',
    '987', '876', '765', '654', '543', '432', '321', '210',
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'
  ];

  for (const sequence of numericSequences) {
    if (password.includes(sequence)) {
      errors.push('Password must not contain sequential or repetitive numbers');
      break;
    }
  }

  // 8. No debe contener patrones de teclado comunes
  const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', '1qaz', '2wsx', 'qwertyuiop'];
  for (const pattern of keyboardPatterns) {
    if (password.toLowerCase().includes(pattern)) {
      errors.push('Password must not contain common keyboard patterns');
      break;
    }
  }

  // 9. Diccionario de contraseñas comunes (prevenir ataques de diccionario)
  const commonPasswords = [
    'password', 'password1', 'password123', '12345678', 'qwerty123',
    'welcome', 'welcome1', 'admin123', 'letmein', 'monkey',
    'dragon', 'master', 'sunshine', 'princess', 'iloveyou'
  ];
  
  for (const common of commonPasswords) {
    if (password.toLowerCase().includes(common)) {
      errors.push('Password is too common and easily guessable');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validar formato de email
 * Regex optimizada para prevenir ReDoS (Regular expression Denial of Service)
 */
export const validateEmail = (email) => {
  // Regex segura con longitud máxima implícita y sin cuantificadores anidados
  const emailRegex = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Obtener nivel de fortaleza de contraseña (débil, media, fuerte)
 * Calcula score basado en longitud y complejidad
 */
export const getPasswordStrength = (password) => {
  if (!password) return { level: "none", label: "", color: "" };

  let score = 0;

  // Length (max 30 puntos)
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Complexity (70 puntos)
  if (/[a-z]/.test(password)) score += 10; // minúsculas
  if (/[A-Z]/.test(password)) score += 15; // mayúsculas
  if (/\d/.test(password)) score += 15; // números
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 20; // especiales

  // Penalizar secuencias
  if (/012|123|234|345|456|567|678|789|987|876|765|654|543|432|321/.test(password)) {
    score -= 20;
  }

  // Ajustar score entre 0-100
  score = Math.max(0, Math.min(100, score));

  if (score <= 40) return { level: "weak", label: "Weak", color: "#e74c3c" };
  if (score <= 60) return { level: "fair", label: "Fair", color: "#e67e22" };
  if (score <= 80) return { level: "good", label: "Good", color: "#f39c12" };
  return { level: "strong", label: "Strong", color: "#27ae60" };
};

/**
 * Sanitizar input para prevenir XSS básico
 */
export const sanitizeInput = (input) => {
  if (typeof input !== "string") return "";
  return input.trim().replace(/[<>]/g, "").substring(0, 500);
};
