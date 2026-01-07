import { useEffect, useState } from "react";
import "../styles/PasswordInput.css";
import {
  getPasswordStrength,
  validatePasswordStrength,
} from "../utils/validation";

/**
 * HU03 - Componente de Input de Contraseña con Validación Visual
 * Muestra indicador de fortaleza en tiempo real y requisitos
 */
const PasswordInput = ({
  value,
  onChange,
  username = "",
  name = "password",
  label = "Password",
  placeholder = "Enter a strong password",
  showStrengthMeter = true,
  showRequirements = true,
  error = "",
  tabIndex = 0,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState({ isValid: true, errors: [] });
  const [strength, setStrength] = useState({
    level: "none",
    label: "",
    color: "",
  });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (value) {
      const validationResult = validatePasswordStrength(value, username);
      const strengthResult = getPasswordStrength(value);
      setValidation(validationResult);
      setStrength(strengthResult);
    } else {
      setValidation({ isValid: true, errors: [] });
      setStrength({ level: "none", label: "", color: "" });
    }
  }, [value, username]);

  const handleBlur = () => {
    setTouched(true);
  };

  const handleChange = (e) => {
    onChange(e);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="password-input-container">
      <label
        htmlFor={name}
        className="leading-6 font-medium"
        tabIndex={tabIndex}
      >
        {label}{" "}
        <span className="text-red-600" aria-hidden="true">
          *
        </span>
        <span className="sr-only">(required)</span>
      </label>

      <div className="password-input-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${
            error || (touched && !validation.isValid)
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          } px-4 py-3 text-base focus:outline-none focus:ring-2`}
          aria-describedby={
            showRequirements ? `${name}-requirements` : undefined
          }
          aria-invalid={
            error || (touched && !validation.isValid) ? "true" : "false"
          }
        />
        <button
          type="button"
          className="toggle-password-btn"
          onClick={togglePasswordVisibility}
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {/* External Error Message */}
      {error && <p className="error-message mt-2">{error}</p>}

      {/* Strength Meter */}
      {showStrengthMeter && value && strength.level !== "none" && (
        <div className="password-strength">
          <div className="strength-bar-container">
            <div
              className={`strength-bar strength-${strength.level}`}
              style={{
                width:
                  strength.level === "weak"
                    ? "25%"
                    : strength.level === "fair"
                    ? "50%"
                    : strength.level === "good"
                    ? "75%"
                    : "100%",
                backgroundColor: strength.color,
              }}
            />
          </div>
          <span className="strength-label" style={{ color: strength.color }}>
            {strength.label}
          </span>
        </div>
      )}

      {/* Requirements List */}
      {showRequirements && (
        <div className="password-requirements" id={`${name}-requirements`}>
          <p className="requirements-title">Password must contain:</p>
          <ul>
            <li className={value.length >= 8 ? "valid" : ""}>
              <span className="requirement-icon">
                {value.length >= 8 ? "✓" : "○"}
              </span>
              At least 8 characters
            </li>
            <li className={/[A-Z]/.test(value) ? "valid" : ""}>
              <span className="requirement-icon">
                {/[A-Z]/.test(value) ? "✓" : "○"}
              </span>
              One uppercase letter (A-Z)
            </li>
            <li className={/\d/.test(value) ? "valid" : ""}>
              <span className="requirement-icon">
                {/\d/.test(value) ? "✓" : "○"}
              </span>
              One number (0-9)
            </li>
            <li
              className={
                /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)
                  ? "valid"
                  : ""
              }
            >
              <span className="requirement-icon">
                {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)
                  ? "✓"
                  : "○"}
              </span>
              One special character (!@#$%...)
            </li>
            {username && (
              <li
                className={
                  !value.toLowerCase().includes(username.toLowerCase())
                    ? "valid"
                    : ""
                }
              >
                <span className="requirement-icon">
                  {!value.toLowerCase().includes(username.toLowerCase())
                    ? "✓"
                    : "○"}
                </span>
                No username in password
              </li>
            )}
            <li
              className={
                !/012|123|234|345|456|567|678|789/.test(value) &&
                !/0000|1111|2222|3333/.test(value)
                  ? "valid"
                  : ""
              }
            >
              <span className="requirement-icon">
                {!/012|123|234|345|456|567|678|789/.test(value) &&
                !/0000|1111|2222|3333/.test(value)
                  ? "✓"
                  : "○"}
              </span>
              No sequential numbers
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
