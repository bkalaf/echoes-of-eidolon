import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { runAuthFixtureCleanup } from "./support/auth-fixture-cleanup";

const captureDirectory = "/tmp/echoes-e2e-auth-codes";
let databasePromise: Promise<Awaited<ReturnType<typeof import("../../src/server/database")["getDatabase"]>>> | undefined;
const fixtureEmails = new Set<string>();
const fixtureUsernames = new Set<string>();

async function testDatabase() {
  if (!databasePromise) {
    if (!process.env.DATABASE_URL) {
      const repositoryRoot = resolve(process.cwd(), "../..");
      const config = JSON.parse(readFileSync(resolve(repositoryRoot, ".local/config.json"), "utf8")) as { credentialDirectory: string };
      process.env.DATABASE_URL = readFileSync(resolve(repositoryRoot, config.credentialDirectory, "database_url"), "utf8").trim();
    }
    databasePromise = import("../../src/server/database").then(({ getDatabase }) => getDatabase());
  }
  return databasePromise;
}

function capturePath(email: string, purpose: string): string {
  const identity = createHash("sha256").update(`${email.toLowerCase()}\0${purpose}`).digest("hex");
  return resolve(captureDirectory, `${identity}.json`);
}

function clearCode(email: string, purpose: string): void {
  rmSync(capturePath(email, purpose), { force: true });
}

async function readCode(email: string, purpose: string): Promise<string> {
  let code = "";
  await expect.poll(() => {
    try {
      const capture = JSON.parse(readFileSync(capturePath(email, purpose), "utf8")) as { code?: unknown };
      code = typeof capture.code === "string" ? capture.code : "";
      return /^\d{6}$/.test(code);
    } catch {
      return false;
    }
  }).toBe(true);
  return code;
}

function accountIdentity(prefix: string) {
  const nonce = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  const account = { email: `${prefix}-${nonce}@example.test`, password: `Old-${nonce}-Password!`, username: `${prefix}_${nonce}` };
  fixtureEmails.add(account.email);
  fixtureUsernames.add(account.username);
  return account;
}

async function signUpAndVerify(page: Page, account: ReturnType<typeof accountIdentity>) {
  clearCode(account.email, "email-verification");
  await page.goto("/auth/sign-up");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("radio", { name: "18 or older" }).check();
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-up\?state=AUTH06$/);
  await expect(page.getByRole("dialog", { name: "Check your email." })).toBeVisible();
  const otp = page.getByLabel("Verification code");
  await expect(page.locator("[data-otp-slot]")).toHaveCount(6);
  await expect(otp).toHaveAttribute("inputmode", "numeric");
  await expect(otp).toHaveAttribute("autocomplete", "one-time-code");
  await expect(otp).toHaveAttribute("maxlength", "6");
  await expect(otp).toHaveAttribute("minlength", "6");
  await expect(otp).toHaveAttribute("pattern", "[0-9]{6}");
  await otp.fill("12x3456");
  await expect(otp).toHaveValue("12345");
  await otp.fill("000000");
  await page.getByRole("button", { name: "Verify Email" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  clearCode(account.email, "email-verification");
  await page.getByRole("button", { name: "Resend" }).click();
  const code = await readCode(account.email, "email-verification");
  await otp.fill(code);
  await page.getByRole("button", { name: "Verify Email" }).click();
  await expect(page.getByText("Email verified. You can now sign in.")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Sign In" })).toBeVisible();
}

async function signIn(page: Page, email: string, password: string, returnTo = "/account/profile") {
  await page.goto(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

async function expectAuthenticated(page: Page) {
  await page.waitForURL((url) => url.pathname === "/account/profile");
  await expect.poll(async () => (await page.request.get("/api/player/access")).status()).toBe(200);
}

async function signOut(page: Page) {
  await page.goto("/auth/sign-out");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect.poll(async () => (await page.request.get("/api/player/access")).status()).toBe(401);
}

test.describe("real Better Auth browser workflows", () => {
  test.afterEach(async ({ context }) => {
    const emails = [...fixtureEmails];
    const usernames = [...fixtureUsernames];
    await runAuthFixtureCleanup({
      hasFixtures: emails.length > 0 || usernames.length > 0,
      closeBrowserContext: () => context.close(),
      deleteDatabaseRecords: async () => {
        const database = await testDatabase();
        const users = await database.user.findMany({
          select: { email: true, id: true },
          where: { username: { in: usernames } },
        });
        const identifiers = [...new Set([...emails, ...users.map(({ email }) => email)])];
        await database.$transaction([
          database.verification.deleteMany({ where: { OR: identifiers.map((identifier) => ({ identifier: { contains: identifier } })) } }),
          database.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } }),
        ]);
        for (const email of identifiers) {
          for (const purpose of ["change-email", "email-verification", "forget-password", "two-factor"]) clearCode(email, purpose);
        }
      },
      clearTrackedFixtures: () => {
        for (const email of emails) fixtureEmails.delete(email);
        for (const username of usernames) fixtureUsernames.delete(username);
      },
    });
  });

  test("sign up, invalid and resent verification OTP, verify, and sign in", async ({ page }) => {
    const account = accountIdentity("signup");
    await signUpAndVerify(page, account);
    await signIn(page, account.email, account.password);
    await expectAuthenticated(page);
    await expect(page.getByRole("heading", { name: "Account - Profile" })).toBeVisible();
  });

  test("forgot password transitions to reset, resends, rotates the credential, and preserves no secrets in URLs", async ({ page, context }) => {
    const account = accountIdentity("reset");
    const newPassword = `New-${Date.now()}-Password!`;
    await signUpAndVerify(page, account);
    clearCode(account.email, "forget-password");
    await page.goto("/auth/forgot-password");
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByText("Enter your email address and we'll send you a password reset code.")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await page.getByLabel("Email").fill(account.email);
    await page.getByRole("button", { name: "Send Reset Code" }).click();
    await expect(page).toHaveURL(/\/auth\/reset-password$/);
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.getByText("Enter the 6-digit code sent to your email, then choose a new password.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Account/email" })).toHaveCount(0);
    await expect(page.getByText(account.email)).toBeVisible();
    const otp = page.getByLabel("Reset code");
    await expect(page.locator("[data-otp-slot]")).toHaveCount(6);
    await expect(otp).toHaveAttribute("inputmode", "numeric");
    await expect(otp).toHaveAttribute("autocomplete", "one-time-code");
    await expect(otp).toHaveAttribute("maxlength", "6");
    await expect(otp).toHaveAttribute("minlength", "6");
    await expect(otp).toHaveAttribute("pattern", "[0-9]{6}");
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm new password", { exact: true })).toBeVisible();
    expect(await otp.evaluate((node, password) => Boolean(node.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING), await page.getByLabel("New password", { exact: true }).elementHandle())).toBe(true);
    await expect(page.getByRole("button", { name: "Show password" })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeDisabled();
    expect(page.url()).not.toContain(account.email);
    await otp.fill("123456");
    await otp.press("Backspace");
    await expect(otp).toHaveValue("12345");
    await otp.press("6");
    await otp.evaluate((input) => (input as HTMLInputElement).setSelectionRange(2, 3));
    await otp.press("9");
    await expect(otp).toHaveValue("129456");
    await otp.fill("12x34");
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(`${newPassword}-mismatch`);
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeDisabled();
    clearCode(account.email, "forget-password");
    await page.getByRole("button", { name: "Resend code" }).click();
    const code = await readCode(account.email, "forget-password");
    await page.getByLabel("Confirm new password").fill(newPassword);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate((value) => navigator.clipboard.writeText(value), code);
    await otp.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Control+V");
    await expect(otp).toHaveValue(code);
    await page.getByRole("button", { name: "Reset Password" }).click();
    await expect(page.getByRole("heading", { name: "Password Reset" })).toBeVisible();
    await expect(page.getByText("Your password has been changed successfully.")).toBeVisible();
    await expect(page.getByText("Sign in with your new password.")).toBeVisible();
    await expect(page.getByText("Enter the 6-digit code sent to your email, then choose a new password.")).toHaveCount(0);
    await expect(page.getByLabel("Reset code")).toHaveCount(0);
    await expect(page.locator(".auth-card").getByRole("link", { name: "Sign In" })).toBeVisible();
    expect(page.url()).not.toMatch(/\d{6}/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.getByLabel("Account/email")).toHaveValue("");
    await signIn(page, account.email, account.password);
    await expect(page.getByRole("alert")).toBeVisible();
    await signIn(page, account.email, newPassword);
    await expectAuthenticated(page);
    await expect(page.getByRole("heading", { name: "Account - Profile" })).toBeVisible();
  });

  test("sign in rejects invalid and unverified credentials and bounds return destinations", async ({ page, browser }) => {
    const account = accountIdentity("signin");
    clearCode(account.email, "email-verification");
    await page.goto("/auth/sign-up");
    await page.locator("html[data-hydrated=true]").waitFor();
    await page.getByLabel("Username").fill(account.username);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("radio", { name: "18 or older" }).check();
    await page.getByRole("button", { name: "Create Account" }).click();
    const unverified = await browser.newPage();
    await signIn(unverified, account.email, account.password);
    await expect(unverified.getByRole("alert")).toBeVisible();
    await unverified.close();
    const code = await readCode(account.email, "email-verification");
    await page.getByLabel("Verification code").fill(code);
    await page.getByRole("button", { name: "Verify Email" }).click();
    await signIn(page, account.email, "incorrect-password");
    await expect(page.getByRole("alert")).toBeVisible();
    await signIn(page, account.email, account.password, "https://example.com/steal");
    await expect(page).toHaveURL(/\/account\/profile$/);
  });

  test("sign out removes the session and account pages return to signed-out state", async ({ page }) => {
    const account = accountIdentity("signout");
    await signUpAndVerify(page, account);
    await signIn(page, account.email, account.password);
    await expectAuthenticated(page);
    await expect(page.getByRole("heading", { name: "Account - Profile" })).toBeVisible();
    await signOut(page);
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
  });

  test("session-expired restoration presents sign-in and rejects an external return path", async ({ page }) => {
    await page.goto("/auth/session-expired");
    await expect(page.getByRole("heading", { name: "Session Expired" })).toBeVisible();
    await page.getByRole("link", { name: "Sign in again" }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await page.goto("/auth/sign-in?returnTo=https%3A%2F%2Fexample.com%2Fsteal");
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  });

  test("passkey authentication cancellation or missing credentials fails closed without leaving the application", async ({ page }) => {
    await page.goto("/auth/passkeys?returnTo=%2Faccount%2Fprofile");
    const applicationOrigin = new URL(page.url()).origin;
    await page.locator("html[data-hydrated=true]").waitFor();
    await page.getByRole("button", { name: "Continue with a passkey" }).click();
    await expect(page.getByRole("button", { name: "Continue with a passkey" })).toBeEnabled();
    expect((await page.request.get("/api/player/access")).status()).toBe(401);
    await expect(page).toHaveURL(/\/auth\/passkeys/);
    expect(new URL(page.url()).origin).toBe(applicationOrigin);
  });

  test("email two-factor challenge blocks account access until a valid numeric OTP succeeds", async ({ page }) => {
    const account = accountIdentity("twofactor");
    await signUpAndVerify(page, account);
    await signIn(page, account.email, account.password);
    await expectAuthenticated(page);
    await signOut(page);
    const database = await testDatabase();
    await database.user.update({ where: { email: account.email }, data: { twoFactorEnabled: true } });
    const twoFactorUser = await database.user.findUniqueOrThrow({ where: { email: account.email } });
    await database.twoFactor.create({
      data: { id: crypto.randomUUID(), userId: twoFactorUser.id, secret: crypto.randomUUID(), backupCodes: "[]", verified: true },
    });
    clearCode(account.email, "two-factor");
    await signIn(page, account.email, account.password);
    await expect(page).toHaveURL(/\/auth\/two-factor/);
    const blockedResponse = await page.request.get("/api/player/access");
    expect(blockedResponse.status()).toBe(401);
    const otp = page.getByLabel("6-digit code");
    await expect(otp).toHaveAttribute("inputmode", "numeric");
    await expect(otp).toHaveAttribute("autocomplete", "one-time-code");
    await otp.fill("12x34");
    await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Send code" }).click();
    const code = await readCode(account.email, "two-factor");
    await otp.fill("000000");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    clearCode(account.email, "two-factor");
    await page.getByRole("button", { name: "Send code" }).click();
    const replacementCode = await readCode(account.email, "two-factor");
    expect(replacementCode).not.toBe(code);
    await otp.fill(replacementCode);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/profile$/);
    await expectAuthenticated(page);
    await expect(page.getByRole("heading", { name: "Account - Profile" })).toBeVisible();
  });

  test("invitation redemption rejects invalid and used codes, grants beta eligibility, and never mutates organization membership", async ({ page }) => {
    const account = accountIdentity("invite");
    await signUpAndVerify(page, account);
    await signIn(page, account.email, account.password);
    await expectAuthenticated(page);
    const database = await testDatabase();
    const user = await database.user.findUniqueOrThrow({ where: { email: account.email } });
    const requestId = crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    const code = `invite-${crypto.randomUUID()}`;
    await database.betaInviteRequest.create({
      data: {
        id: requestId,
        requesterId: user.id,
        friendName: account.username,
        email: account.email,
        reason: "Authentication E2E fixture",
        status: "INVITED",
        invitation: {
          create: {
            id: invitationId,
            recipientEmail: account.email,
            codeHash: createHash("sha256").update(code).digest("hex"),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        },
      },
    });
    const membershipsBefore = await database.member.count({ where: { userId: user.id } });
    await page.goto("/auth/redeem-invitation");
    await page.locator("html[data-hydrated=true]").waitFor();
    await page.getByLabel("Invitation code").fill("invalid-invitation");
    await page.getByRole("button", { name: "Redeem Invitation" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel("Invitation code").fill(code);
    await page.getByRole("button", { name: "Redeem Invitation" }).click();
    await expect(page.getByRole("status")).toContainText("Beta access granted");
    expect(page.url()).not.toContain(code);
    await expect.poll(async () => (await database.user.findUniqueOrThrow({ where: { id: user.id } })).betaEligible).toBe(true);
    expect(await database.member.count({ where: { userId: user.id } })).toBe(membershipsBefore);
    await page.getByRole("button", { name: "Redeem Invitation" }).click();
    await expect(page.getByRole("alert")).toContainText(/used|invalid|expired|revoked/i);
  });

  test("profile settings, change-email OTP, and session revocation run through authenticated browser UI", async ({ page, browser }) => {
    test.setTimeout(60_000);
    const account = accountIdentity("security");
    const newEmail = account.email.replace("@", "-changed@");
    fixtureEmails.add(newEmail);
    await signUpAndVerify(page, account);
    await signIn(page, account.email, account.password);
    await expectAuthenticated(page);
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
    await expect(page.getByText(account.username)).toBeVisible();
    await expect(page.getByText(account.email)).toBeVisible();
    const displayName = `Display ${Date.now()}`;
    await page.getByLabel("Display name").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Change email" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Change password" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Manage sessions" })).toBeFocused();
    await page.getByLabel("Display name").fill(displayName);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Display name saved");
    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue(displayName);

    clearCode(newEmail, "change-email");
    await page.goto("/account/profile?state=ACC002");
    await page.getByLabel("New email").fill(newEmail);
    await page.getByRole("button", { name: "Send Verification" }).click();
    await readCode(newEmail, "change-email");
    const changeOtp = page.getByLabel("Verification code");
    await expect(changeOtp).toHaveAttribute("autocomplete", "one-time-code");
    await changeOtp.fill("000000");
    await page.getByRole("button", { name: "Verify & Change Email" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    clearCode(newEmail, "change-email");
    await page.getByRole("button", { name: "Resend" }).click();
    const resentCode = await readCode(newEmail, "change-email");
    await changeOtp.fill(resentCode);
    await page.getByRole("button", { name: "Verify & Change Email" }).click();
    await expect(page.getByRole("status")).toContainText("Email address changed");

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, newEmail, account.password);
    await expectAuthenticated(otherPage);
    await expect(otherPage.getByRole("heading", { name: "Account - Profile" })).toBeVisible();
    const thirdContext = await browser.newContext();
    const thirdPage = await thirdContext.newPage();
    await signIn(thirdPage, newEmail, account.password);
    await expectAuthenticated(thirdPage);
    await expect(thirdPage.getByRole("heading", { name: "Account - Profile" })).toBeVisible();
    await page.goto("/account/profile?state=ACC004");
    await expect(page.getByRole("button", { name: "Revoke this other session" })).toHaveCount(2);
    await page.getByRole("button", { name: "Revoke this other session" }).first().click();
    await expect(page.getByRole("button", { name: "Revoke this other session" })).toHaveCount(1);
    await page.getByRole("button", { name: "Revoke all other sessions" }).click();
    await expect(page.getByRole("button", { name: "Revoke this other session" })).toHaveCount(0);
    await otherPage.reload();
    await expect(otherPage.getByRole("heading", { name: "Sign in required" })).toBeVisible();
    await thirdPage.reload();
    await expect(thirdPage.getByRole("heading", { name: "Sign in required" })).toBeVisible();
    await otherContext.close();
    await thirdContext.close();
  });

  test("authenticated password change verifies the current credential and recovery reuses AUTH05", async ({ page }) => {
    test.setTimeout(120_000);
    const account = accountIdentity("password");
    const newPassword = `Changed-${Date.now()}-Password!`;
    await signUpAndVerify(page, account);
    await signIn(page, account.email, account.password);
    await expectAuthenticated(page);
    await page.goto("/account/profile?state=ACC024");
    await expect(page.getByRole("heading", { name: "Change Password" })).toBeVisible();
    const current = page.getByLabel("Current password");
    const replacement = page.getByLabel("New password", { exact: true });
    const confirmation = page.getByLabel("Confirm new password");
    await expect(page.getByRole("button", { name: "Show password" })).toHaveCount(3);
    await current.fill("wrong-current-password");
    await replacement.fill(newPassword);
    await confirmation.fill(newPassword);
    await page.getByRole("button", { name: "Change Password" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await confirmation.fill(`${newPassword}-mismatch`);
    await expect(page.getByRole("button", { name: "Change Password" })).toBeDisabled();
    await confirmation.fill(newPassword);
    await current.fill(account.password);
    await page.getByRole("button", { name: "Show password" }).nth(1).focus();
    await page.keyboard.press("Space");
    await expect(replacement).toHaveAttribute("type", "text");
    await expect(confirmation).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Change Password" }).click();
    await expect(page.getByRole("heading", { name: "Password Changed" })).toBeVisible();
    await expect(page.getByText("Your password has been changed successfully.")).toBeVisible();

    await signOut(page);
    await signIn(page, account.email, account.password);
    await expect(page.getByRole("alert")).toBeVisible();
    await signIn(page, account.email, newPassword);
    await expectAuthenticated(page);
    await page.goto("/account/profile?state=ACC024");
    clearCode(account.email, "forget-password");
    await page.getByRole("button", { name: "Forgot your current password?" }).click();
    await expect(page).toHaveURL(/\/auth\/reset-password$/);
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.locator("[data-otp-slot]")).toHaveCount(6);
    expect(await readCode(account.email, "forget-password")).toMatch(/^\d{6}$/);
    expect(page.url()).not.toContain(account.email);
  });
});
