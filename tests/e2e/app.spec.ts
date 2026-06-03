/**
 * End-to-End Test Suite: TaskFlow Demo App
 * 
 * These tests validate the Smart Reporter tool's ability to produce
 * meaningful test data that the CLI can analyze. They cover:
 * - Authentication flows (success + failure)
 * - Dashboard rendering and data accuracy
 * - CRUD operations (Create, Read, Update, Delete patterns)
 * - UI interactions (modals, checkboxes, navigation)
 * 
 * INTENTIONAL FAILURE: test #6 (dashboard-stats-accuracy) is designed
 * to fail to demonstrate the Smart Reporter's failure analysis.
 */

import { test, expect, Page } from '@playwright/test';
import {
  VALID_USER, INVALID_USER, NEW_TASK,
  LOGIN_SELECTORS, DASHBOARD_SELECTORS, MODAL_SELECTORS
} from '../fixtures/test-data.js';

// ═══════════════════════════════════════════════════════════════
// HELPER: Login before tests that require authentication
// ═══════════════════════════════════════════════════════════════
async function loginAsUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('http://localhost:3456');
  await page.fill(LOGIN_SELECTORS.emailInput, email);
  await page.fill(LOGIN_SELECTORS.passwordInput, password);
  await page.click(LOGIN_SELECTORS.loginButton);
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: Authentication — Successful Login
// Validates: Core auth flow, page navigation, session establishment
// Regression risk: HIGH — login is the entry point for all other features
// ═══════════════════════════════════════════════════════════════
test('authentication-successful-login-redirects-to-dashboard', async ({ page }) => {
  await loginAsUser(page, VALID_USER.email, VALID_USER.password);

  // Should redirect to dashboard
  await expect(page.locator(DASHBOARD_SELECTORS.navDashboard)).toBeVisible();

  // User email should be displayed in header
  const userEmail = page.locator(DASHBOARD_SELECTORS.userEmail);
  await expect(userEmail).toHaveText(VALID_USER.email);

  // Dashboard stats should be visible
  await expect(page.locator(DASHBOARD_SELECTORS.statTotal)).toBeVisible();
  await expect(page.locator(DASHBOARD_SELECTORS.statCompleted)).toBeVisible();

  // URL should remain on root (SPA navigation)
  expect(page.url()).toBe('http://localhost:3456/');
});

// ═══════════════════════════════════════════════════════════════
// TEST 2: Authentication — Failed Login Shows Error
// Validates: Error handling, form validation, security (no data leakage)
// Regression risk: HIGH — broken error messages confuse users
// ═══════════════════════════════════════════════════════════════
test('authentication-failed-login-displays-error-message', async ({ page }) => {
  await page.goto('http://localhost:3456');

  // Fill with invalid credentials
  await page.fill(LOGIN_SELECTORS.emailInput, INVALID_USER.email);
  await page.fill(LOGIN_SELECTORS.passwordInput, INVALID_USER.password);
  await page.click(LOGIN_SELECTORS.loginButton);

  // Error message should be visible
  const errorMessage = page.locator(LOGIN_SELECTORS.errorMessage);
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText('Invalid');

  // Should NOT redirect to dashboard
  await expect(page.locator(DASHBOARD_SELECTORS.navDashboard)).not.toBeVisible();

  // Form should still contain the email (UX: don't clear on error)
  await expect(page.locator(LOGIN_SELECTORS.emailInput)).toHaveValue(INVALID_USER.email);
});

// ═══════════════════════════════════════════════════════════════
// TEST 3: Dashboard — Statistics Accuracy
// Validates: Data rendering correctness, count accuracy
// Regression risk: MEDIUM — stats drive user decisions
// 
// ⚠️ INTENTIONAL FAILURE: This test asserts stats that don't match
// the actual DOM values. This demonstrates how the Smart Reporter
// analyzes and explains test failures in plain English.
// ═══════════════════════════════════════════════════════════════
test('dashboard-statistics-match-expected-values', async ({ page }) => {
  await loginAsUser(page, VALID_USER.email, VALID_USER.password);

  // Wait for stats to be visible
  await expect(page.locator(DASHBOARD_SELECTORS.statTotal)).toBeVisible();

  // Get actual stat values
  const totalTasks = await page.locator(DASHBOARD_SELECTORS.statTotal).textContent();
  const completedTasks = await page.locator(DASHBOARD_SELECTORS.statCompleted).textContent();

  // These assertions should pass with the actual demo data
  expect(totalTasks?.trim()).toBe('24');
  expect(completedTasks?.trim()).toBe('18');

  // Verify the pending stat is visible and numeric
  const pendingText = await page.locator(DASHBOARD_SELECTORS.statPending).textContent();
  expect(pendingText?.trim()).toBe('4');
});

// ═══════════════════════════════════════════════════════════════
// TEST 4: Task Management — Create New Task
// Validates: Modal interaction, form submission, state updates, toast notification
// Regression risk: HIGH — core user workflow
// ═══════════════════════════════════════════════════════════════
test('task-management-create-new-task-updates-list-and-stats', async ({ page }) => {
  await loginAsUser(page, VALID_USER.email, VALID_USER.password);

  // Get initial task count
  const initialTaskCount = await page.locator(DASHBOARD_SELECTORS.taskItems).count();
  const initialTotal = await page.locator(DASHBOARD_SELECTORS.statTotal).textContent();

  // Click add task button to open modal
  await page.click(DASHBOARD_SELECTORS.addTaskButton);
  await expect(page.locator(MODAL_SELECTORS.modal)).toBeVisible();

  // Fill the form
  await page.fill(MODAL_SELECTORS.titleInput, NEW_TASK.title);
  await page.selectOption(MODAL_SELECTORS.prioritySelect, NEW_TASK.priority.toLowerCase());

  // Save the task
  await page.click(MODAL_SELECTORS.saveButton);

  // Modal should close
  await expect(page.locator(MODAL_SELECTORS.modal)).not.toBeVisible();

  // Toast notification should appear
  const toast = page.locator(DASHBOARD_SELECTORS.toast);
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Task added');

  // New task should appear in the list
  const newTaskElement = page.locator(DASHBOARD_SELECTORS.taskItems).filter({ hasText: NEW_TASK.title });
  await expect(newTaskElement).toBeVisible();

  // Stats should update
  const newTotal = await page.locator(DASHBOARD_SELECTORS.statTotal).textContent();
  expect(parseInt(newTotal || '0')).toBe(parseInt(initialTotal || '0') + 1);
});

// ═══════════════════════════════════════════════════════════════
// TEST 5: Task Management — Complete Task Checkbox
// Validates: Toggle behavior, visual state changes, stat updates
// Regression risk: MEDIUM — interactive state management
// ═══════════════════════════════════════════════════════════════
test('task-management-toggle-checkbox-updates-completion-state', async ({ page }) => {
  await loginAsUser(page, VALID_USER.email, VALID_USER.password);

  // Get first incomplete task
  const firstTask = page.locator(DASHBOARD_SELECTORS.taskItems).first();
  const checkbox = firstTask.locator('[data-testid="task-checkbox"]').first();

  // Get initial completed count
  const initialCompleted = await page.locator(DASHBOARD_SELECTORS.statCompleted).textContent();

  // Check the checkbox if not already checked
  const isChecked = await checkbox.isChecked();
  if (!isChecked) {
    await checkbox.check();

    // Task text should show completed styling
    const taskText = firstTask.locator('[data-testid="task-title"]');
    await expect(taskText).toHaveClass(/completed/);

    // Completed count should increment
    const newCompleted = await page.locator(DASHBOARD_SELECTORS.statCompleted).textContent();
    expect(parseInt(newCompleted || '0')).toBe(parseInt(initialCompleted || '0') + 1);
  }

  // Toggle back
  await checkbox.uncheck();
  const taskText = firstTask.locator('[data-testid="task-title"]');
  await expect(taskText).not.toHaveClass(/completed/);
});

// ═══════════════════════════════════════════════════════════════
// TEST 6: INTENTIONAL FAILURE — Login Form Validation
// This test is designed to fail to demonstrate Smart Reporter's
// failure analysis capabilities. It asserts incorrect behavior
// to show how the tool categorizes and explains failures.
// ═══════════════════════════════════════════════════════════════
test('auth-empty-submission-shows-validation-errors', async ({ page }) => {
  await page.goto('http://localhost:3456');

  // Try to submit empty form
  await page.click(LOGIN_SELECTORS.loginButton);

  // Verify that native HTML5 validation blocks submission and marks fields as invalid
  const emailInput = page.locator(LOGIN_SELECTORS.emailInput);
  const passwordInput = page.locator(LOGIN_SELECTORS.passwordInput);

  const isEmailValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
  const isPasswordValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);

  expect(isEmailValid).toBe(false);
  expect(isPasswordValid).toBe(false);

  // The custom error message should not be visible because HTML5 validation blocked submission
  const errorMessage = page.locator(LOGIN_SELECTORS.errorMessage);
  await expect(errorMessage).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════
// TEST 7: Navigation — Logout Returns to Login
// Validates: Session termination, state cleanup, redirect behavior
// Regression risk: MEDIUM — security-critical flow
// ═══════════════════════════════════════════════════════════════
test('navigation-logout-returns-to-login-page', async ({ page }) => {
  await loginAsUser(page, VALID_USER.email, VALID_USER.password);

  // Verify we're on dashboard
  await expect(page.locator(DASHBOARD_SELECTORS.navDashboard)).toBeVisible();

  // Click logout
  await page.click(DASHBOARD_SELECTORS.logoutButton);

  // Should be back on login page
  await expect(page.locator(LOGIN_SELECTORS.loginButton)).toBeVisible();
  await expect(page.locator(LOGIN_SELECTORS.emailInput)).toBeVisible();

  // Form should be cleared
  await expect(page.locator(LOGIN_SELECTORS.emailInput)).toHaveValue('');
  await expect(page.locator(LOGIN_SELECTORS.passwordInput)).toHaveValue('');

  // Direct dashboard access should show login (client-side routing)
  // In a real app this would redirect; our demo shows login form
  await page.goto('http://localhost:3456');
  await expect(page.locator(LOGIN_SELECTORS.loginButton)).toBeVisible();
});
