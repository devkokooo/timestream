/** Git-style subject + optional body. */
export function composeCommitMessage(title: string, body: string): string {
  const subject = title.replace(/\s+/g, " ").trim();
  const note = body.replace(/[ \t]+\n/g, "\n").trim();
  if (!subject) return note;
  if (!note) return subject;
  return `${subject}\n\n${note}`;
}
