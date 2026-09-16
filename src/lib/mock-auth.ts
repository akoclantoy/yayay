/**
 * Mock Authentication for Development
 * This provides a fallback authentication system when database is not available
 */

type MockUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "COLLECTION_STAFF" | "RESIDENT";
  emailVerified: Date;
  isActive: boolean;
};

const MOCK_USERS: MockUser[] = [
  {
    id: "admin-001",
    email: "admin@example.com",
    password: "Admin123!",
    name: "System Admin",
    role: "ADMIN",
    emailVerified: new Date(),
    isActive: true,
  },
  {
    id: "staff-001",
    email: "staff@example.com",
    password: "Staff123!",
    name: "Collection Staff",
    role: "COLLECTION_STAFF",
    emailVerified: new Date(),
    isActive: true,
  },
  {
    id: "resident-001",
    email: "resident@example.com",
    password: "Resident123!",
    name: "Juan Dela Cruz",
    role: "RESIDENT",
    emailVerified: new Date(),
    isActive: true,
  },
];

/**
 * Authenticate user with mock credentials
 */
export async function mockAuthenticate(email: string, password: string) {
  const user = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return {
      success: false as const,
      error: "Invalid email or password",
    };
  }

  if (!user.isActive) {
    return {
      success: false as const,
      error: "Account is inactive",
    };
  }

  return {
    success: true as const,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  };
}

export function mockRegisterUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = MOCK_USERS.find((user) => user.email === email);

  if (existing) {
    return {
      success: false as const,
      error: "An account with this email already exists",
    };
  }

  const user: MockUser = {
    id: `mock-${Date.now()}`,
    email,
    password: input.password,
    name: input.name.trim(),
    role: "RESIDENT",
    emailVerified: new Date(),
    isActive: true,
  };

  MOCK_USERS.push(user);
  return { success: true as const, user };
}

/**
 * Check if mock authentication should be used
 */
export function shouldUseMockAuth(): boolean {
  if (process.env.MOCK_AUTH === "true") return true;
  if (process.env.NODE_ENV === "production") return false;

  // In local/dev environments, seeded demo users should still be usable even if
  // the database is not running, unreachable, or temporarily unavailable.
  return true;
}

/**
 * Get mock user by email
 */
export function getMockUser(email: string) {
  return MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}
