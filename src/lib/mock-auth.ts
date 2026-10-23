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
  phone: string;
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
    phone: "+639000000001",
    emailVerified: new Date(),
    isActive: true,
  },
  {
    id: "staff-001",
    email: "staff@example.com",
    password: "Staff123!",
    name: "Collection Staff",
    role: "COLLECTION_STAFF",
    phone: "+639000000002",
    emailVerified: new Date(),
    isActive: true,
  },
  {
    id: "resident-001",
    email: "resident@example.com",
    password: "Resident123!",
    name: "Juan Dela Cruz",
    role: "RESIDENT",
    phone: "+639000000003",
    emailVerified: new Date(),
    isActive: true,
  },
];

/**
 * Authenticate user with mock credentials
 */
export async function mockAuthenticate(phone: string, password: string) {
  const user = MOCK_USERS.find(
    (u) => u.phone === phone && u.password === password
  );

  if (!user) {
    return {
      success: false as const,
      error: "Invalid phone number or password",
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
  phone: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = MOCK_USERS.find((user) => user.email === email);
  const phoneInUse = MOCK_USERS.some((user) => user.phone === input.phone);

  if (existing || phoneInUse) {
    return {
      success: false as const,
      error: existing
        ? "An account with this email already exists"
        : "An account with this phone number already exists",
    };
  }

  const user: MockUser = {
    id: `mock-${Date.now()}`,
    email,
    password: input.password,
    name: input.name.trim(),
    phone: input.phone,
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
  return process.env.MOCK_AUTH === "true";
}

/**
 * Get mock user by email
 */
export function getMockUser(email: string) {
  return MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}
