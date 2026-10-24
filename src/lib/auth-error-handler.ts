/**
 * Authentication Error Handler
 * Provides comprehensive error handling for authentication operations
 */

export type AuthErrorType =
  | "CredentialsSignin"
  | "EmailNotVerified"
  | "AccountInactive"
  | "AccountDeleted"
  | "NetworkError"
  | "ServerError"
  | "RateLimitError"
  | "EmailAlreadyExists"
  | "InvalidInput"
  | "DatabaseError"
  | "UnknownError";

export interface AuthError {
  type: AuthErrorType;
  message: string;
  userFriendlyMessage: string;
  originalError?: unknown;
}

function getErrorDetails(error: unknown): Record<string, unknown> {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : {};
}

function messageIncludes(message: unknown, search: string) {
  return typeof message === "string" && message.toLowerCase().includes(search);
}

/**
 * Handle authentication errors and convert them to user-friendly messages
 */
export function handleAuthError(error: unknown): AuthError {
  const details = getErrorDetails(error);
  const errorCode =
    typeof error === "string"
      ? error
      : typeof details.error === "string"
        ? details.error
        : details.code;

  if (errorCode === "CredentialsSignin") {
    return {
      type: "CredentialsSignin",
      message: "Invalid credentials",
      userFriendlyMessage: "Invalid email or password. Please check your credentials and try again.",
      originalError: error,
    };
  }

  if (errorCode === "email_not_verified") {
    return {
      type: "EmailNotVerified",
      message: "Email not verified",
      userFriendlyMessage: "Please verify your email address before signing in. Check your inbox for the verification link.",
      originalError: error,
    };
  }

  if (errorCode === "database_unavailable") {
    return {
      type: "DatabaseError",
      message: "Database connection error",
      userFriendlyMessage: "Unable to connect to the database. Please try again later.",
      originalError: error,
    };
  }

  // Handle specific NextAuth error codes
  if (details.type) {
    switch (details.type) {
      case "CredentialsSignin":
        return {
          type: "CredentialsSignin",
          message: "Invalid credentials",
          userFriendlyMessage: "Invalid email or password. Please check your credentials and try again.",
          originalError: error,
        };

      case "EmailNotVerified":
        return {
          type: "EmailNotVerified",
          message: "Email not verified",
          userFriendlyMessage: "Please verify your email address before signing in. Check your inbox for the verification link.",
          originalError: error,
        };

      case "AccountInactive":
        return {
          type: "AccountInactive",
          message: "Account inactive",
          userFriendlyMessage: "Your account has been deactivated. Please contact support for assistance.",
          originalError: error,
        };

      case "AccountDeleted":
        return {
          type: "AccountDeleted",
          message: "Account deleted",
          userFriendlyMessage: "This account has been deleted. Please contact support if you believe this is an error.",
          originalError: error,
        };

      case "EmailAlreadyExists":
        return {
          type: "EmailAlreadyExists",
          message: "Email already exists",
          userFriendlyMessage: "An account with this email already exists. Please sign in or use a different email.",
          originalError: error,
        };

      case "InvalidInput":
        return {
          type: "InvalidInput",
          message: "Invalid input",
          userFriendlyMessage: "Please check your input and try again. Make sure all fields are filled correctly.",
          originalError: error,
        };
    }
  }

  // Handle specific error codes
  if (details.code) {
    switch (details.code) {
      case "email_not_verified":
        return {
          type: "EmailNotVerified",
          message: "Email not verified",
          userFriendlyMessage: "Please verify your email address before signing in. Check your inbox for the verification link.",
          originalError: error,
        };

      case "RATE_LIMIT_EXCEEDED":
        return {
          type: "RateLimitError",
          message: "Rate limit exceeded",
          userFriendlyMessage: "Too many login attempts. Please wait a few minutes before trying again.",
          originalError: error,
        };

      case "EMAIL_ALREADY_EXISTS":
        return {
          type: "EmailAlreadyExists",
          message: "Email already exists",
          userFriendlyMessage: "An account with this email already exists. Please sign in or use a different email.",
          originalError: error,
        };
    }
  }

  // Handle error messages
  if (typeof details.message === "string") {
    const message = details.message.toLowerCase();
    if (message.includes("email already exists") || message.includes("duplicate key")) {
      return {
        type: "EmailAlreadyExists",
        message: "Email already exists",
        userFriendlyMessage: "An account with this email already exists. Please sign in or use a different email.",
        originalError: error,
      };
    }
    if (message.includes("validation") || message.includes("invalid")) {
      return {
        type: "InvalidInput",
        message: "Invalid input",
        userFriendlyMessage: "Please check your input and try again. Make sure all fields are filled correctly.",
        originalError: error,
      };
    }
  }

  // Handle network errors
  if (details.name === "NetworkError" || messageIncludes(details.message, "fetch") || messageIncludes(details.message, "network")) {
    return {
      type: "NetworkError",
      message: "Network error",
      userFriendlyMessage: "Network connection error. Please check your internet connection and try again.",
      originalError: error,
    };
  }

  // Handle database errors
  if (details.code === "ECONNREFUSED" || messageIncludes(details.message, "database") || messageIncludes(details.message, "ECONNREFUSED")) {
    return {
      type: "DatabaseError",
      message: "Database connection error",
      userFriendlyMessage: "Unable to connect to the database. Please ensure the database is running and try again.",
      originalError: error,
    };
  }

  // Handle server errors (5xx)
  if ((typeof details.status === "number" && details.status >= 500) || messageIncludes(details.message, "server") || messageIncludes(details.message, "500")) {
    return {
      type: "ServerError",
      message: "Server error",
      userFriendlyMessage: "Server error occurred. Please try again later or contact support if the problem persists.",
      originalError: error,
    };
  }

  // Default unknown error
  return {
    type: "UnknownError",
    message: "Unknown error",
    userFriendlyMessage: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    originalError: error,
  };
}

/**
 * Show error toast based on authentication error
 */
export function showAuthErrorToast(error: unknown) {
  const authError = handleAuthError(error);
  
  // Use different toast styles based on error type
  switch (authError.type) {
    case "EmailNotVerified":
      return {
        title: "Email Verification Required",
        message: authError.userFriendlyMessage,
        variant: "warning" as const,
      };

    case "AccountInactive":
    case "AccountDeleted":
      return {
        title: "Account Issue",
        message: authError.userFriendlyMessage,
        variant: "error" as const,
      };

    case "NetworkError":
      return {
        title: "Connection Error",
        message: authError.userFriendlyMessage,
        variant: "warning" as const,
      };

    case "RateLimitError":
      return {
        title: "Too Many Attempts",
        message: authError.userFriendlyMessage,
        variant: "warning" as const,
      };

    case "EmailAlreadyExists":
      return {
        title: "Email Already Registered",
        message: authError.userFriendlyMessage,
        variant: "warning" as const,
      };

    case "InvalidInput":
      return {
        title: "Invalid Information",
        message: authError.userFriendlyMessage,
        variant: "warning" as const,
      };

    case "DatabaseError":
      return {
        title: "Database Connection Error",
        message: authError.userFriendlyMessage,
        variant: "error" as const,
      };

    case "ServerError":
      return {
        title: "Server Error",
        message: authError.userFriendlyMessage,
        variant: "error" as const,
      };

    default:
      return {
        title: "Authentication Failed",
        message: authError.userFriendlyMessage,
        variant: "error" as const,
      };
  }
}

/**
 * Handle login error specifically
 */
export function handleLoginError(error: unknown): string {
  const authError = handleAuthError(error);

  // Return concise message for inline display
  switch (authError.type) {
    case "CredentialsSignin":
      return "Invalid email or password";
    case "EmailNotVerified":
      return "Please verify your email";
    case "AccountInactive":
      return "Account is inactive";
    case "AccountDeleted":
      return "Account has been deleted";
    case "NetworkError":
      return "Connection error";
    case "RateLimitError":
      return "Too many attempts";
    case "ServerError":
      return "Server error";
    case "EmailAlreadyExists":
      return "Email already exists";
    case "InvalidInput":
      return "Invalid information";
    case "DatabaseError":
      return "Database connection error";
    default:
      return "Login failed";
  }
}
