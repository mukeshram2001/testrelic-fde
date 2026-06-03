/**
 * Test Data & Helpers
 * Shared fixtures and utilities for the test suite
 */

export const VALID_USER = {
  email: 'user@example.com',
  password: 'password123',
};

export const INVALID_USER = {
  email: 'wrong@example.com',
  password: 'wrongpassword',
};

export const TEST_TASKS = [
  { title: 'Set up CI/CD pipeline', priority: 'High' },
  { title: 'Write unit tests for auth', priority: 'Medium' },
  { title: 'Update documentation', priority: 'Low' },
  { title: 'Review pull request #42', priority: 'High' },
  { title: 'Fix navigation bug on mobile', priority: 'High' },
];

export const NEW_TASK = {
  title: 'Integrate TestRelic analytics SDK',
  priority: 'High',
};

// Selectors organized by page
export const LOGIN_SELECTORS = {
  emailInput: '[data-testid="email-input"]',
  passwordInput: '[data-testid="password-input"]',
  loginButton: '[data-testid="login-button"]',
  errorMessage: '[data-testid="login-error"]',
};

export const DASHBOARD_SELECTORS = {
  navDashboard: '[data-testid="nav-dashboard"]',
  navTasks: '[data-testid="nav-tasks"]',
  userEmail: '[data-testid="user-email"]',
  logoutButton: '[data-testid="logout-button"]',
  statTotal: '[data-testid="stat-total"]',
  statCompleted: '[data-testid="stat-completed"]',
  statPending: '[data-testid="stat-pending"]',
  statOverdue: '[data-testid="stat-overdue"]',
  addTaskButton: '[data-testid="add-task-button"]',
  taskList: '[data-testid="task-list"]',
  taskItems: '[data-testid="task-item"]',
  toast: '[data-testid="toast"]',
};

export const MODAL_SELECTORS = {
  modal: '[data-testid="add-task-modal"]',
  titleInput: '[data-testid="task-title-input"]',
  prioritySelect: '[data-testid="task-priority-select"]',
  cancelButton: '[data-testid="cancel-button"]',
  saveButton: '[data-testid="save-task-button"]',
};
