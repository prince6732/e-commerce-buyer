"use client";

import { useState, useEffect, useRef } from "react";
import { X, Eye, EyeOff, Star, ShieldCheck, Sparkles, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { useAuth, AuthModalMode } from "@/context/AuthContext";
import { useLoader } from "@/context/LoaderContext";
import { login, registerUser, forgotPassword, resetPassword } from "../../../utils/auth";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import axios from "../../../utils/axios";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import * as Yup from "yup";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const indianPhoneRegex = /^[6-9]\d{9}$/;

const emailValidation = Yup.string()
  .trim()
  .required("Email Address is required")
  .matches(emailRegex, "Please enter a valid email address");

const phoneValidation = Yup.string().test(
  "valid-indian-phone",
  "Please enter a valid 10-digit mobile number",
  (val) => !val || indianPhoneRegex.test(val)
);

// Yup Validation Schemas
const loginSchema = Yup.object().shape({
  email: emailValidation,
  password: Yup.string().required("Password is required"),
});

const registerSchema = Yup.object().shape({
  name: Yup.string()
    .trim()
    .required("Full Name is required")
    .matches(/^[a-zA-Z\s]+$/, "Full Name can only contain letters and spaces"),
  email: emailValidation,
  phone: phoneValidation,
  password: Yup.string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters"),
});

const forgotPasswordSchema = Yup.object().shape({
  email: emailValidation,
});

const resetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters"),
  passwordConfirmation: Yup.string()
    .required("Please confirm your password")
    .oneOf([Yup.ref("password")], "Passwords do not match"),
});

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    authModalEmail,
    closeAuthModal,
    setAuthModalMode,
    setUserDirectly,
    user,
  } = useAuth();

  const { showLoader, hideLoader } = useLoader();

  const [mode, setMode] = useState<AuthModalMode>(authModalMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notifyUpdates, setNotifyUpdates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const currentMode = authModalMode || mode;

  // Reset form when modal opens or closes or mode changes
  const resetFormFields = () => {
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");
    setName("");
    setPhone("");
    setOtp(["", "", "", "", "", ""]);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
  };

  useEffect(() => {
    if (isAuthModalOpen) {
      setFieldErrors({});
      if (authModalEmail) {
        setEmail(authModalEmail);
      } else {
        const savedEmail = localStorage.getItem("verifyEmail") || localStorage.getItem("resetPasswordEmail") || "";
        if (savedEmail && (currentMode === "email-verify" || currentMode === "reset-password")) {
          setEmail(savedEmail);
        }
      }
    } else {
      resetFormFields();
    }
  }, [isAuthModalOpen]);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  if (!isAuthModalOpen) return null;

  const handleModeSwitch = (newMode: AuthModalMode) => {
    setAuthModalMode(newMode);
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
  };

  const handleLoginSuccess = (loggedUser: any, token: string) => {
    localStorage.setItem("user", JSON.stringify(loggedUser));
    localStorage.setItem("token", token);
    setUserDirectly(loggedUser);
    resetFormFields();
    closeAuthModal();
  };

  // Real-time Single Field Validation Helper
  const validateSingleField = async (fieldName: string, value: any, currentValues: any) => {
    try {
      let schemaToUse: any;
      if (currentMode === "login") schemaToUse = loginSchema;
      else if (currentMode === "register") schemaToUse = registerSchema;
      else if (currentMode === "forgot-password") schemaToUse = forgotPasswordSchema;
      else if (currentMode === "reset-password") schemaToUse = resetPasswordSchema;

      if (schemaToUse) {
        await schemaToUse.validateAt(fieldName, { ...currentValues, [fieldName]: value });
        setFieldErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[fieldName];
          return newErrors;
        });
      }
    } catch (err: any) {
      if (err instanceof Yup.ValidationError) {
        setFieldErrors((prev) => ({ ...prev, [fieldName]: err.message }));
      }
    }
  };

  // Input Field Change Handlers with Auto-hiding validation
  const handleNameChange = (val: string) => {
    // Restrict input to letters and spaces ONLY
    const cleanName = val.replace(/[^a-zA-Z\s]/g, "");
    setName(cleanName);
    validateSingleField("name", cleanName, { name: cleanName, email, phone, password });
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    validateSingleField("email", val, { name, email: val, phone, password });
  };

  const handlePhoneChange = (val: string) => {
    // Restrict input to digits ONLY and 10 digits MAX
    const cleanPhone = val.replace(/\D/g, "").slice(0, 10);
    setPhone(cleanPhone);
    validateSingleField("phone", cleanPhone, { name, email, phone: cleanPhone, password });
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    validateSingleField("password", val, { name, email, phone, password: val, passwordConfirmation });
  };

  const handleConfirmPasswordChange = (val: string) => {
    setPasswordConfirmation(val);
    validateSingleField("passwordConfirmation", val, { password, passwordConfirmation: val });
  };

  // Full Form Validation on Submit
  const validateForm = async (): Promise<boolean> => {
    setFieldErrors({});
    try {
      if (currentMode === "login") {
        await loginSchema.validate({ email, password }, { abortEarly: false });
      } else if (currentMode === "register") {
        await registerSchema.validate({ name, email, phone, password }, { abortEarly: false });
      } else if (currentMode === "forgot-password") {
        await forgotPasswordSchema.validate({ email }, { abortEarly: false });
      } else if (currentMode === "reset-password") {
        await resetPasswordSchema.validate({ password, passwordConfirmation }, { abortEarly: false });
      }
      return true;
    } catch (err: any) {
      if (err instanceof Yup.ValidationError) {
        const errors: Record<string, string> = {};
        err.inner.forEach((error) => {
          if (error.path && !errors[error.path]) {
            errors[error.path] = error.message;
          }
        });
        setFieldErrors(errors);
      }
      return false;
    }
  };

  // Handle OTP Inputs
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);
    const nextEmptyIndex = newOtp.findIndex((val) => !val);
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    otpInputRefs.current[focusIndex]?.focus();
  };

  // Submit Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate using Yup schemas
    const isValid = await validateForm();
    if (!isValid && currentMode !== "email-verify") return;

    // 1. Sign In
    if (currentMode === "login") {
      setIsSubmitting(true);
      showLoader();
      try {
        const res = await login(email, password);
        handleLoginSuccess(res.user, res.token);
      } catch (err: any) {
        if (err.response?.data?.email_not_verified) {
          const unverifiedEmail = err.response.data.email || email;
          localStorage.setItem("verifyEmail", unverifiedEmail);
          setEmail(unverifiedEmail);
          try {
            await axios.post("/api/resend-otp", { email: unverifiedEmail });
          } catch {
            // Ignore if backend already dispatched OTP email
          }
          setSuccess("Your email is not verified. We have sent a verification code to your email, please check and verify your email.");
          setAuthModalMode("email-verify");
          setMode("email-verify");
          setOtp(["", "", "", "", "", ""]);
          setResendCountdown(60);
          return;
        }
        const msg = err.response?.data?.message || err.message || "An error occurred. Please try again.";
        setError(msg);
      } finally {
        hideLoader();
        setIsSubmitting(false);
      }
    }

    // 2. Register Account (Opens Email Verification Modal)
    else if (currentMode === "register") {
      setIsSubmitting(true);
      showLoader();
      try {
        await registerUser({
          name,
          email,
          password,
          password_confirmation: password,
          phone_number: phone,
        });

        localStorage.setItem("verifyEmail", email);
        setSuccess("Registration successful! Please enter the 6-digit OTP sent to your email.");
        setAuthModalMode("email-verify");
        setMode("email-verify");
        setOtp(["", "", "", "", "", ""]);
        setResendCountdown(60);
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || "Registration failed. Please try again.";
        setError(msg);
      } finally {
        hideLoader();
        setIsSubmitting(false);
      }
    }

    // 3. Email Verification OTP Submit
    else if (currentMode === "email-verify") {
      const targetEmail = email || localStorage.getItem("verifyEmail");
      if (!targetEmail) {
        setError("No email address found for verification.");
        return;
      }
      const otpCode = otp.join("");
      if (otpCode.length !== 6) {
        setError("Please enter all 6 digits of the OTP.");
        return;
      }
      setIsSubmitting(true);
      showLoader();
      try {
        const response = await axios.post("/api/verify-otp", {
          email: targetEmail,
          otp: otpCode,
        });
        localStorage.removeItem("verifyEmail");
        if (response.data.token && response.data.user) {
          handleLoginSuccess(response.data.user, response.data.token);
        } else {
          setSuccess("Email verified successfully! Please sign in.");
          handleModeSwitch("login");
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || "Verification failed. Please try again.";
        setError(msg);
        if (err.response?.data?.expired) setOtp(["", "", "", "", "", ""]);
      } finally {
        hideLoader();
        setIsSubmitting(false);
      }
    }

    // 4. Forgot Password Submit
    else if (currentMode === "forgot-password") {
      setIsSubmitting(true);
      showLoader();
      try {
        const res = await forgotPassword(email);
        localStorage.setItem("resetPasswordEmail", email);
        setSuccess(res.message || "Reset code sent successfully! Please check your email.");
        setAuthModalMode("reset-password");
        setMode("reset-password");
        setOtp(["", "", "", "", "", ""]);
      } catch (err: any) {
        const msg = err.response?.data?.message || "Failed to send reset code. Please try again.";
        setError(msg);
      } finally {
        hideLoader();
        setIsSubmitting(false);
      }
    }

    // 5. Reset Password Submit
    else if (currentMode === "reset-password") {
      const targetEmail = email || localStorage.getItem("resetPasswordEmail");
      if (!targetEmail) {
        setError("Email not found. Please request a password reset first.");
        return;
      }
      const codeString = otp.join("");
      if (codeString.length !== 6) {
        setError("Please enter all 6 digits of the reset code.");
        return;
      }

      setIsSubmitting(true);
      showLoader();
      try {
        await resetPassword({
          email: targetEmail,
          code: codeString,
          password,
          password_confirmation: passwordConfirmation,
        });
        localStorage.removeItem("resetPasswordEmail");
        if (user) {
          closeAuthModal();
        } else {
          setSuccess("Password reset successfully! Please sign in with your new password.");
          handleModeSwitch("login");
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || "Failed to reset password. Please try again.";
        setError(msg);
      } finally {
        hideLoader();
        setIsSubmitting(false);
      }
    }
  };

  // Resend OTP for email verification
  const handleResendOTP = async () => {
    const targetEmail = email || localStorage.getItem("verifyEmail");
    if (!targetEmail) {
      setError("Email address not found.");
      return;
    }
    setIsResending(true);
    setError(null);
    try {
      const res = await axios.post("/api/resend-otp", { email: targetEmail });
      setSuccess(res.data?.message || "Verification code resent successfully!");
      setResendCountdown(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to resend code.";
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  // Google OAuth Login
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError(null);
    closeAuthModal();
    showLoader();
    try {
      const response = await axios.post("/api/auth/google", {
        token: credentialResponse.credential,
      });
      if (response.data.token && response.data.user) {
        handleLoginSuccess(response.data.user, response.data.token);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Google login failed.";
      setError(msg);
    } finally {
      hideLoader();
    }
  };

  // Dynamic Left Panel Headlines
  const getBrandHeadline = () => {
    switch (currentMode) {
      case "register":
        return "Create an account for exclusive deals!";
      case "forgot-password":
        return "Forgot Password? We've got you covered!";
      case "reset-password":
        return "Reset your password securely!";
      case "email-verify":
        return "Verify your email to get started!";
      default:
        return "Login now to avail best offers!";
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {success && <SuccessMessage message={success} onClose={() => setSuccess(null)} />}

      <div className="relative w-full max-w-[360px] sm:max-w-md md:max-w-4xl bg-red-600 md:bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/20 my-auto max-h-[96vh] animate-in zoom-in-95 duration-200">

        {/* Close Button */}
        <button
          onClick={() => {
            resetFormFields();
            closeAuthModal();
          }}
          className="absolute top-3.5 right-3.5 z-30 w-7.5 h-7.5 rounded-full bg-black/25 md:bg-gray-100 text-white md:text-gray-700 flex items-center justify-center transition-all shadow-sm hover:scale-105"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Side: Brand Section (Desktop 2-Column & Mobile Red Card Top) */}
        <div className="w-full md:w-1/2 bg-red-600 p-4 sm:p-6 md:p-8 text-white flex flex-col justify-between relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 rounded-full bg-black/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 text-center md:text-left pr-6 md:pr-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-white/15 backdrop-blur-md rounded-full text-[11px] md:text-xs font-semibold mb-2 md:mb-6 border border-white/20">
              <span className="font-extrabold tracking-wide uppercase">Zelton</span>
              <span className="bg-yellow-400 text-black text-[9px] md:text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">Store</span>
            </div>

            <h2 className="text-base sm:text-xl md:text-3xl font-extrabold tracking-tight mb-1.5 md:mb-3 leading-tight">
              {getBrandHeadline()}
            </h2>

            <p className="hidden md:block text-white/80 text-sm leading-relaxed">
              Join thousands of happy shoppers enjoying premium quality products and transparent services.
            </p>
          </div>

          {/* Feature Badge Pill (Image 1 Mobile Reference & Desktop Grid) */}
          <div className="relative z-10 mt-2 md:mt-0">
            {/* Mobile Feature Pill with Dot Indicator */}
            <div className="block md:hidden border border-white/30 rounded-full py-1.5 px-4 text-center text-xs font-bold text-white bg-white/10 shadow-inner">
              <div className="flex items-center justify-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span>Customer-first</span>
              </div>
              <div className="flex justify-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              </div>
            </div>

            {/* Desktop 3-Card Grid */}
            <div className="hidden md:grid grid-cols-3 gap-3 pt-6 border-t border-white/20">
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center">
                <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1 fill-yellow-400" />
                <div className="text-[11px] font-bold">Customer-first</div>
                <div className="text-[9px] text-white/70">Putting you in center</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center">
                <ShieldCheck className="w-5 h-5 text-green-300 mx-auto mb-1" />
                <div className="text-[11px] font-bold">Transparent</div>
                <div className="text-[9px] text-white/70">Honest inside out</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center">
                <Sparkles className="w-5 h-5 text-yellow-300 mx-auto mb-1" />
                <div className="text-[11px] font-bold">Innovative</div>
                <div className="text-[9px] text-white/70">Best for you</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form Section (Inner White Card on Mobile) */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 bg-white rounded-t-3xl md:rounded-none flex flex-col justify-center overflow-y-auto max-h-[72vh] md:max-h-none">

          {/* Header Tabs (Sign In / Register) */}
          {(currentMode === "login" || currentMode === "register") && (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 text-center mb-1">
                Unlock Exclusive Discounts Now!
              </h3>
              <p className="text-xs text-gray-500 text-center mb-4">
                {currentMode === "login" ? "Enter your account details to sign in" : "Fill in your information to get started"}
              </p>

              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("login")}
                  className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-xl transition-all ${currentMode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch("register")}
                  className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-xl transition-all ${currentMode === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}
                >
                  Register
                </button>
              </div>
            </div>
          )}

          {/* Mode Header for Forgot, Reset & Verify */}
          {currentMode === "forgot-password" && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => (user ? closeAuthModal() : handleModeSwitch("login"))}
                className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {user ? "Back to Profile" : "Back to Sign In"}
              </button>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Forgot Password?</h3>
              <p className="text-xs text-gray-500">We'll send a 6-digit reset code to your email address.</p>
            </div>
          )}

          {currentMode === "reset-password" && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => (user ? closeAuthModal() : handleModeSwitch("login"))}
                className="text-xs font-semibold text-gray-500 hover:text-black flex items-center gap-1 mb-3 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {user ? "Back to Profile" : "Back to Sign In"}
              </button>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Reset Password</h3>
              <p className="text-xs text-gray-500">Enter the 6-digit code sent to <span className="font-semibold text-black">{email}</span></p>
            </div>
          )}

          {currentMode === "email-verify" && (
            <div className="mb-6 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Verify Your Email</h3>
              <p className="text-xs text-gray-500">
                Enter the 6-digit verification code sent to <br />
                <span className="font-semibold text-black">{email}</span>
              </p>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* 1. Login & Register Fields */}
            {(currentMode === "login" || currentMode === "register") && (
              <>
                {currentMode === "register" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Enter Your Full Name"
                      className={`w-full px-4 py-2.5 text-xs md:text-sm bg-gray-50 border ${fieldErrors.name ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                        } rounded-xl focus:outline-none transition-colors`}
                    />
                    {fieldErrors.name && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="Enter Your Email Address"
                    className={`w-full px-4 py-2.5 text-xs md:text-sm bg-gray-50 border ${fieldErrors.email ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                      } rounded-xl focus:outline-none transition-colors`}
                  />
                  {fieldErrors.email && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {currentMode === "register" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number (Optional)</label>
                    <div className="flex gap-2">
                      <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 flex items-center justify-center min-w-[60px]">
                        IN +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="Enter Your Mobile Number"
                        className={`flex-1 px-4 py-2.5 text-xs md:text-sm bg-gray-50 border ${fieldErrors.phone ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                          } rounded-xl focus:outline-none transition-colors`}
                      />
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700">Password</label>
                    {currentMode === "login" && (
                      <button
                        type="button"
                        onClick={() => handleModeSwitch("forgot-password")}
                        className="text-xs font-semibold text-[#F40000] hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-4 py-2.5 pr-10 text-xs md:text-sm bg-gray-50 border ${fieldErrors.password ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                        } rounded-xl focus:outline-none transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="notify"
                    checked={notifyUpdates}
                    onChange={(e) => setNotifyUpdates(e.target.checked)}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <label htmlFor="notify" className="text-xs text-gray-600 cursor-pointer">
                    Notify me with offers & updates
                  </label>
                </div>
              </>
            )}

            {/* 2. Forgot Password Fields */}
            {currentMode === "forgot-password" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="Enter your registered email"
                  className={`w-full px-4 py-2.5 text-xs md:text-sm bg-gray-50 border ${fieldErrors.email ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                    } rounded-xl focus:outline-none transition-colors`}
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            )}

            {/* 3. Reset Password & Email Verify OTP Boxes */}
            {(currentMode === "email-verify" || currentMode === "reset-password") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 text-center">
                  6-Digit Verification Code
                </label>
                <div className="flex justify-center gap-2 mb-4" onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputRefs.current[index] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-10 h-12 text-center text-lg font-bold bg-gray-50 border border-gray-300 rounded-xl focus:border-black focus:ring-1 focus:ring-black focus:outline-none transition-all"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reset Password New Password Fields */}
            {currentMode === "reset-password" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className={`w-full px-4 py-2.5 pr-10 text-xs md:text-sm bg-gray-50 border ${fieldErrors.password ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                        } rounded-xl focus:outline-none transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordConfirmation}
                      onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`w-full px-4 py-2.5 pr-10 text-xs md:text-sm bg-gray-50 border ${fieldErrors.passwordConfirmation ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"
                        } rounded-xl focus:outline-none transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.passwordConfirmation && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1 transition-all">
                      {fieldErrors.passwordConfirmation}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Resend OTP button for email verify */}
            {currentMode === "email-verify" && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={resendCountdown > 0 || isResending}
                  onClick={handleResendOTP}
                  className="text-xs font-semibold text-gray-600 hover:text-black disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                  {resendCountdown > 0 ? `Resend Code in ${resendCountdown}s` : "Resend Code"}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#007FFF] hover:bg-[#0066CC] text-[#FFFAFB] font-bold rounded-xl text-xs md:text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {isSubmitting
                ? "Processing..."
                : currentMode === "login"
                  ? "Sign In"
                  : currentMode === "register"
                    ? "Create Account"
                    : currentMode === "forgot-password"
                      ? "Send Reset Code"
                      : currentMode === "reset-password"
                        ? "Reset Password"
                        : "Verify & Continue"}
            </button>
          </form>

          {/* Social Auth (Login & Register Mode) */}
          {(currentMode === "login" || currentMode === "register") && (
            <div className="mt-5">
              <div className="relative flex items-center justify-center mb-4">
                <div className="border-t border-gray-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider absolute">
                  OR
                </span>
              </div>

              <div className="flex justify-center">
                <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-in was unsuccessful.")}
                    shape="pill"
                    text={currentMode === "login" ? "signin_with" : "signup_with"}
                  />
                </GoogleOAuthProvider>
              </div>
            </div>
          )}

          {/* Switch link */}
          <div className="mt-6 text-center text-xs text-gray-500">
            {currentMode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("register")}
                  className="font-bold text-red-600 hover:underline"
                >
                  Register Now
                </button>
              </p>
            ) : currentMode === "register" ? (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("login")}
                  className="font-bold text-red-600 hover:underline"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => handleModeSwitch("login")}
                className="font-bold text-red-600 hover:underline"
              >
                Return to Sign In
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
