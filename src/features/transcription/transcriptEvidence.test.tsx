import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { ImportantPointEvidence } from "./importantPoints";
import {
  mergeEvidenceRanges,
  renderTranscriptText,
  selectFirstEvidence,
} from "./transcriptEvidence";

function evidence(
  quote: string,
  quoteStart: number,
  quoteLength = quote.length,
  segmentId = "segment-one",
): ImportantPointEvidence {
  return { segmentId, quote, quoteStart, quoteLength, startTimeMs: 12_000 };
}

describe("mergeEvidenceRanges", () => {
  test("mantém uma faixa literal válida", () => {
    expect(mergeEvidenceRanges("Paciente relata dor abdominal.", [evidence("dor", 16)])).toEqual([
      { start: 16, end: 19 },
    ]);
  });

  test("une faixas sobrepostas", () => {
    expect(mergeEvidenceRanges("dor abdominal intensa", [
      evidence("dor abdominal", 0),
      evidence("abdominal intensa", 4),
    ])).toEqual([{ start: 0, end: 21 }]);
  });

  test("une faixas adjacentes", () => {
    expect(mergeEvidenceRanges("dor abdominal", [
      evidence("dor ", 0),
      evidence("abdominal", 4),
    ])).toEqual([{ start: 0, end: 13 }]);
  });

  test("mantém faixas literais separadas em ordem", () => {
    expect(mergeEvidenceRanges("dor após almoço e azia à noite", [
      evidence("azia", 18),
      evidence("dor", 0),
    ])).toEqual([{ start: 0, end: 3 }, { start: 18, end: 22 }]);
  });

  test.each([
    ["início negativo", evidence("dor", -1)],
    ["comprimento zero", evidence("", 0, 0)],
    ["fim fora do texto", evidence("dor", 20)],
    ["citação divergente", evidence("azia", 16)],
  ])("ignora %s", (_name, invalidEvidence) => {
    expect(mergeEvidenceRanges("Paciente relata dor.", [invalidEvidence])).toEqual([]);
  });

  test("preserva offsets de texto PT-BR com acentos", () => {
    const text = "Queimação após o café.";
    expect(mergeEvidenceRanges(text, [evidence("Queimação", 0)])).toEqual([
      { start: 0, end: 9 },
    ]);
  });

  test("retorna vazio sem texto ou evidência", () => {
    expect(mergeEvidenceRanges("", [evidence("dor", 0)])).toEqual([]);
    expect(mergeEvidenceRanges("Sem destaque.", [])).toEqual([]);
  });
});

describe("renderTranscriptText", () => {
  test("marca somente as substrings validadas e mantém o entorno", () => {
    const text = "Dor após almoço e azia à noite.";
    render(<p data-testid="transcript">{renderTranscriptText(text, [
      { start: 0, end: 3 },
      { start: 18, end: 22 },
    ])}</p>);

    expect(screen.getAllByText(/dor|azia/i, { selector: "mark" }).map((item) => item.textContent))
      .toEqual(["Dor", "azia"]);
    expect(screen.getByTestId("transcript")).toHaveTextContent(text);
  });

  test("mantém o texto completo disponível para tecnologia assistiva", () => {
    const text = "Paciente relata dor epigástrica após as refeições.";
    const { container } = render(<p>{renderTranscriptText(text, [{ start: 16, end: 31 }])}</p>);

    expect(container.querySelector("p")?.textContent).toBe(text);
    expect(container.querySelector("mark")?.textContent).toBe("dor epigástrica");
  });

  test("renderiza texto sem marca quando não existem faixas", () => {
    const { container } = render(<p>{renderTranscriptText("Sem evidência.", [])}</p>);
    expect(container.querySelector("p")?.textContent).toBe("Sem evidência.");
    expect(container.querySelector("mark")).toBeNull();
  });
});

test("seleciona a primeira evidência sem remover o detalhe multissegmento", () => {
  const allEvidence = [
    evidence("primeiro trecho", 0, 15, "segment-one"),
    evidence("segundo trecho", 4, 14, "segment-two"),
  ];

  expect(selectFirstEvidence(allEvidence)?.segmentId).toBe("segment-one");
  expect(allEvidence).toHaveLength(2);
  expect(allEvidence[1].quote).toBe("segundo trecho");
});
