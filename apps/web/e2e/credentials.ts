// The seeded dev user. The defaults match .env.example; override them for another account.
export const E2E_USER = process.env.E2E_USER_EMAIL ?? "dev@cuesense.local";
export const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "change-me-dev-password";

export const STORAGE_STATE = "playwright/.auth/user.json";
