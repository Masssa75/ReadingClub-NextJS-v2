import { test, expect } from '@playwright/test';

test('simple page load test', async ({ page }) => {
  console.log('Test starting...');
  await page.goto('/');
  console.log('Page loaded');
  const title = await page.title();
  console.log('Title:', title);
  expect(title).toBeTruthy();
});
