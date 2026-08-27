import { ApiError } from "../../api/client";

export function isClinicalAccessDenied(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}
