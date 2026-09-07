/**
 * Extracts a clear, user-friendly error message from an API error response.
 * Handles NestJS error objects, arrays, ValidationPipe errors, and Laravel error structures.
 */
export const getErrorMessage = (err: any, defaultMsg: string = "An unexpected error occurred"): string => {
  if (!err) return defaultMsg;

  const data = err.response?.data || err.data || err;

  // Handle message field (string or array of validation errors)
  if (data?.message) {
    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }
    if (typeof data.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }
  }

  // Handle error field
  if (data?.error && typeof data.error === "string" && data.error.trim().length > 0) {
    return data.error;
  }

  // Handle Laravel validation errors object { errors: { field: ["msg1", "msg2"] } }
  if (data?.errors && typeof data.errors === "object") {
    const messages: string[] = [];
    for (const key of Object.keys(data.errors)) {
      const fieldErrors = data.errors[key];
      if (Array.isArray(fieldErrors)) {
        messages.push(...fieldErrors);
      } else if (typeof fieldErrors === "string") {
        messages.push(fieldErrors);
      }
    }
    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  // Fallback to JS Error message
  if (err.message && typeof err.message === "string" && err.message.trim().length > 0) {
    return err.message;
  }

  return defaultMsg;
};
