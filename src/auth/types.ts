export type ForgeId = "github";

export interface ForgeUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  email?: string | null;
  emails?: string[];
}
