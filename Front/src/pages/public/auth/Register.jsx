import { useState } from "react";
import { Link } from "react-router";
import { API_URL } from "../../../API";
import PasswordInput from "../../../components/PasswordInput";
import {
  getPasswordStrength,
  validateEmail,
  validatePasswordStrength,
} from "../../../utils/validation";

export const Register = () => {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    answerSecret: "",
    role: "STUDENT_FREE",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    level: "none",
    label: "",
    color: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    if (e.target.name === "email") {
      setForm({ ...form, [e.target.name]: e.target.value.toLowerCase() });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }

    // Actualizar fortaleza de la contraseña en tiempo real (con validación de username)
    if (e.target.name === "password") {
      setPasswordStrength(getPasswordStrength(e.target.value));
    }

    setFieldErrors({ ...fieldErrors, [e.target.name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const newFieldErrors = {};

    if (!form.email.trim()) {
      newFieldErrors.email = "Email is required";
    } else if (!validateEmail(form.email)) {
      newFieldErrors.email = "Invalid email format";
    }

    if (!form.username.trim()) newFieldErrors.username = "Username is required";

    if (!form.password) {
      newFieldErrors.password = "Password is required";
    } else {
      // HU03: Validación con username para prevenir contraseñas que lo contengan
      const passwordValidation = validatePasswordStrength(
        form.password,
        form.username
      );
      if (!passwordValidation.isValid) {
        newFieldErrors.password = passwordValidation.errors.join(". ");
      }
    }

    if (!form.confirmPassword) {
      newFieldErrors.confirmPassword = "Please confirm your password";
    } else if (
      form.password &&
      form.confirmPassword &&
      form.password !== form.confirmPassword
    ) {
      newFieldErrors.confirmPassword = "Passwords do not match";
    }

    if (!form.answerSecret.trim())
      newFieldErrors.answerSecret = "Secret answer is required";

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setError("Please enter a valid password.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          password: form.password,
          answerSecret: form.answerSecret,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("User registered successfully!");
        setForm({
          email: "",
          username: "",
          password: "",
          confirmPassword: "",
          answerSecret: "",
          role: "STUDENT_FREE",
        });
        setPasswordStrength({ level: "none", label: "", color: "" });
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Server error");
    }
  };

  return (
    <main className="w-full relative bg-[#fff] flex flex-col items-center justify-start text-center text-sm text-[#0f141a] font-lexend min-h-screen">
      <section className="w-full max-w-[1280px] bg-[#fafafa] flex flex-col items-center justify-start min-h-[600px] md:min-h-[700px] lg:min-h-[800px]">
        <section className="w-full flex flex-row items-center justify-center py-5 px-4 md:px-16 lg:px-40 box-border text-left text-base">
          <div className="w-full max-w-[960px] overflow-hidden shrink-0 flex flex-col items-center justify-start py-5 px-0 box-border">
            <header className="self-stretch flex flex-col items-center justify-start pt-5 px-2 md:px-4 pb-3 text-center text-2xl md:text-[28px]">
              <h1
                className="self-stretch leading-[35px] font-bold"
                tabIndex={0}
              >
                Sign up for Edusoft
              </h1>
            </header>
            <form
              className="w-full max-w-[480px] mx-auto flex flex-col gap-4"
              onSubmit={handleSubmit}
              noValidate
            >
              {success && (
                <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-2">
                  <img
                    src="/check-circle.png"
                    alt="Success"
                    className="w-6 h-6"
                  />
                  <span>{success}</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-2">
                  <img src="/x-circle.png" alt="Error" className="w-6 h-6" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex flex-col items-start">
                <label
                  htmlFor="email"
                  className="leading-6 font-medium"
                  tabIndex={0}
                >
                  Email{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`self-stretch rounded-xl bg-[#fafafa] border-solid border-[1px] box-border h-12 md:h-14 p-3 md:p-[15px] text-[#4C7490] text-base md:text-lg ${
                    fieldErrors.email ? "border-red-500" : "border-[#d4dee3]"
                  }`}
                  placeholder="student@example.com"
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <span className="text-red-600 text-xs mt-1">
                    {fieldErrors.email}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start">
                <label
                  htmlFor="username"
                  className="leading-6 font-medium"
                  tabIndex={0}
                >
                  Username{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  className={`self-stretch rounded-xl bg-[#fafafa] border-solid border-[1px] box-border h-12 md:h-14 p-3 md:p-[15px] text-[#4C7490] text-base md:text-lg ${
                    fieldErrors.username ? "border-red-500" : "border-[#d4dee3]"
                  }`}
                  placeholder="john_student"
                  aria-invalid={!!fieldErrors.username}
                />
                {fieldErrors.username && (
                  <span className="text-red-600 text-xs mt-1">
                    {fieldErrors.username}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start">
                <label
                  htmlFor="role"
                  className="leading-6 font-medium"
                  tabIndex={0}
                >
                  Account Type{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">(required)</span>
                </label>
                <div className="self-stretch flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: "STUDENT_FREE" })}
                    className={`flex-1 rounded-xl border-2 border-solid box-border h-12 md:h-14 p-3 md:p-[15px] text-base md:text-lg font-semibold transition-all duration-150 ${
                      form.role === "STUDENT_FREE"
                        ? "bg-[#add1eb] border-[#5fa3d1] text-[#0f141a]"
                        : "bg-[#fafafa] border-[#d4dee3] text-[#4C7490] hover:bg-[#f0f3f5]"
                    }`}
                    aria-pressed={form.role === "STUDENT_FREE"}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: "TUTOR" })}
                    className={`flex-1 rounded-xl border-2 border-solid box-border h-12 md:h-14 p-3 md:p-[15px] text-base md:text-lg font-semibold transition-all duration-150 ${
                      form.role === "TUTOR"
                        ? "bg-[#add1eb] border-[#5fa3d1] text-[#0f141a]"
                        : "bg-[#fafafa] border-[#d4dee3] text-[#4C7490] hover:bg-[#f0f3f5]"
                    }`}
                    aria-pressed={form.role === "TUTOR"}
                  >
                    Tutor
                  </button>
                </div>
              </div>
              {/* HU03: Componente de contraseña con validación robusta */}
              <PasswordInput
                value={form.password}
                onChange={handleChange}
                username={form.username}
                name="password"
                label="Password"
                placeholder="Enter a strong password"
                showStrengthMeter={true}
                showRequirements={true}
                error={fieldErrors.password}
                tabIndex={0}
              />
              <div className="flex flex-col items-start relative">
                <label
                  htmlFor="confirmPassword"
                  className="leading-6 font-medium"
                  tabIndex={0}
                >
                  Confirm Password{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className={`self-stretch rounded-xl bg-[#fafafa] border-solid border-[1px] box-border h-12 md:h-14 p-3 md:p-[15px] text-[#4C7490] text-base md:text-lg pr-12 ${
                    fieldErrors.confirmPassword
                      ? "border-red-500"
                      : "border-[#d4dee3]"
                  }`}
                  placeholder="123Password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-[30px] md:top-[36px] p-1 bg-transparent border-none outline-none focus:outline-2 focus:outline-blue-500 focus:ring-2 focus:ring-blue-300 rounded hover:bg-gray-100 transition-all duration-150"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  title={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  <img
                    src={showConfirmPassword ? "/eye-slash.png" : "/eye.png"}
                    alt={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    className="w-6 h-6"
                  />
                </button>
                {fieldErrors.confirmPassword && (
                  <span className="text-red-600 text-xs mt-1">
                    {fieldErrors.confirmPassword}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start">
                <label
                  htmlFor="answerSecret"
                  className="leading-6 font-medium"
                  tabIndex={0}
                >
                  Secret Answer (for password recovery){" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="answerSecret"
                  name="answerSecret"
                  type="text"
                  value={form.answerSecret}
                  onChange={handleChange}
                  className={`self-stretch rounded-xl bg-[#fafafa] border-solid border-[1px] box-border h-12 md:h-14 p-3 md:p-[15px] text-[#4C7490] text-base md:text-lg ${
                    fieldErrors.answerSecret
                      ? "border-red-500"
                      : "border-[#d4dee3]"
                  }`}
                  placeholder="Your mother maiden name"
                  aria-invalid={!!fieldErrors.answerSecret}
                />
                {fieldErrors.answerSecret && (
                  <span className="text-red-600 text-xs mt-1">
                    {fieldErrors.answerSecret}
                  </span>
                )}
              </div>
              <button
                type="submit"
                className="w-full rounded-[20px] bg-[#add1eb] h-10 md:h-12 flex items-center justify-center py-0 px-4 min-w-[84px] max-w-[480px] cursor-pointer text-[#0f141a] font-bold leading-[21px] text-base md:text-lg transition-colors duration-150 hover:bg-[#7bbbe3] focus:outline-2 focus:outline-[#0d171c]"
              >
                Sign Up
              </button>
              <div className="self-stretch text-center text-[#4C7490]">
                <span tabIndex={0}>Already have an account? </span>
                <Link to="/login" className="font-medium underline">
                  Log in
                </Link>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
};
