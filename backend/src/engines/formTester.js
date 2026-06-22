/**
 * Form Tester
 *
 * Finds <form> elements on the already-loaded page and runs two checks:
 *   1. Empty submit  -> required fields should block submission
 *   2. Valid submit  -> generic data should pass native validation
 *
 * Honest limitation: every real form's "valid data" is different. This
 * fills fields with generic, type-appropriate placeholder values (an
 * email field gets a fake email, a text field gets generic text). For
 * forms with custom server-side validation beyond HTML5 attributes,
 * this can only confirm client-side validation behavior, not whether
 * the form actually accomplishes its real purpose.
 */
async function run(page, baseUrl) {
  const formCount = await page.locator('form').count();

  if (formCount === 0) {
    return {
      module: 'Form Tester',
      status: 'WARN',
      details: ['No <form> elements found on this page'],
    };
  }

  const details = [];
  let status = 'PASS';

  for (let i = 0; i < formCount; i++) {
    const form = page.locator('form').nth(i);
    const formLabel = (await form.getAttribute('id')) || (await form.getAttribute('name')) || `form #${i + 1}`;

    // --- Check 1: empty submit should be blocked by required fields ---
    const requiredCount = await form.locator('[required]').count();
    if (requiredCount > 0) {
      const submitBtn = form.locator('button[type=submit], input[type=submit]').first();
      const hasSubmit = (await submitBtn.count()) > 0;

      if (hasSubmit) {
        try {
          await submitBtn.click({ timeout: 5000 });
          await page.waitForTimeout(300);

          const stillInvalid = await form.evaluate((f) => {
            const fields = Array.from(f.querySelectorAll('[required]'));
            return fields.some((field) => !field.checkValidity());
          });

          if (!stillInvalid) {
            details.push({
              form: formLabel,
              check: 'empty submit',
              issue: `Form has ${requiredCount} required field(s) but empty submit was not blocked`,
            });
            status = 'FAIL';
          }
        } catch (err) {
          details.push({ form: formLabel, check: 'empty submit', issue: `Could not test: ${err.message}` });
        }
      } else {
        details.push({ form: formLabel, check: 'empty submit', issue: 'No submit button found to test' });
      }
    }

    // --- Check 2: generic valid data should pass client-side validation ---
    try {
      await fillWithGenericData(form);
      const allValid = await form.evaluate((f) => {
        const fields = Array.from(f.querySelectorAll('input, textarea, select'));
        return fields.every((field) => field.checkValidity());
      });

      if (!allValid) {
        details.push({
          form: formLabel,
          check: 'valid submit',
          issue: 'Generic data did not satisfy this form\'s validation — likely needs custom field values in config',
        });
        status = status === 'FAIL' ? 'FAIL' : 'WARN';
      }
    } catch (err) {
      details.push({ form: formLabel, check: 'valid submit', issue: `Could not test: ${err.message}` });
    }
  }

  return {
    module: 'Form Tester',
    status,
    details: details.length ? details : [`All ${formCount} form(s) checked OK`],
    totalForms: formCount,
  };
}

async function fillWithGenericData(form) {
  const inputs = form.locator('input:not([type=submit]):not([type=button]):not([type=hidden]):not([type=checkbox]):not([type=radio])');
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const type = (await input.getAttribute('type')) || 'text';

    let value = 'Test Value';
    if (type === 'email') value = 'test.user@example.com';
    else if (type === 'tel') value = '5551234567';
    else if (type === 'number') value = '1';
    else if (type === 'url') value = 'https://example.com';
    else if (type === 'password') value = 'TestPass123!';

    await input.fill(value).catch(() => {});
  }

  const textareas = form.locator('textarea');
  const textareaCount = await textareas.count();
  for (let i = 0; i < textareaCount; i++) {
    await textareas.nth(i).fill('This is a generic test message for QA validation purposes.').catch(() => {});
  }
}

module.exports = { run };