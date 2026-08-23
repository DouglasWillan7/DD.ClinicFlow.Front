import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, apiBlobRequest } from "./client";

describe("apiBlobRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("envia bearer token e devolve o PDF autenticado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("%PDF-1.7", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiBlobRequest(
      "/exams/exam-1/document",
      { headers: { "X-Request-Id": "request-1" } },
      "access-token",
    );

    expect(await result.text()).toBe("%PDF-1.7");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token");
    expect(new Headers(init.headers).get("X-Request-Id")).toBe("request-1");
  });

  test("interpreta ProblemDetails de conflito em vez de devolver JSON como blob", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Documento duplicado.",
            existingExamId: "exam-existing",
            currentVersion: 7,
          }),
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    await expect(apiBlobRequest("/exams/exam-1/document", {}, "access-token"))
      .rejects.toEqual(expect.objectContaining<Partial<ApiError>>({
        status: 409,
        problem: expect.objectContaining({
          existingExamId: "exam-existing",
          currentVersion: 7,
        }),
      }));
  });
});
