export const passwordRequirementsMessage =
  "Use ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.";

export function validPassword(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}
