/**
 * User Authentication & Credential Storage Service
 */
import { User } from '../types';

const STORAGE_KEY_USERS = 'daily_tasks_users_v1';
const STORAGE_KEY_CURRENT_USER = 'daily_tasks_current_user_v1';

// Hash password securely using Web Crypto API SHA-256
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'daily_tasks_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Get all registered users from storage
export function getUsers(): User[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USERS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to parse users:', e);
  }
  return [];
}

// Save users list
function saveUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

// Get current logged in user
export function getCurrentUser(): User | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to parse current user:', e);
  }
  return null;
}

// Set current logged in user session
export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  }
}

// Seed default demo user if no users exist
export async function seedDemoUser(): Promise<User> {
  const users = getUsers();
  let demoUser = users.find((u) => u.email === 'demo@example.com');
  if (!demoUser) {
    const passwordHash = await hashPassword('password123');
    demoUser = {
      id: 'usr-demo-1001',
      name: 'Alex Johnson',
      email: 'demo@example.com',
      passwordHash,
      avatarColor: 'bg-indigo-600',
      createdAt: new Date().toISOString(),
    };
    users.push(demoUser);
    saveUsers(users);
  }
  return demoUser;
}

// Sign up new user
export async function signUpUser(name: string, email: string, password: string): Promise<{ user?: User; error?: string }> {
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { error: 'An account with this email already exists.' };
  }

  const avatarColors = [
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-violet-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-sky-600',
  ];
  const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

  const passwordHash = await hashPassword(password);
  const newUser: User = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    avatarColor: randomColor,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  return { user: newUser };
}

// Log in user
export async function loginUser(email: string, password: string): Promise<{ user?: User; error?: string }> {
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const found = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!found) {
    return { error: 'No account found with this email address.' };
  }

  if (found.passwordHash !== passwordHash) {
    return { error: 'Incorrect password. Please try again.' };
  }

  setCurrentUser(found);
  return { user: found };
}

// Log out user
export function logoutUser() {
  setCurrentUser(null);
}
