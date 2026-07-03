export interface EvaluationResult {
  correct: boolean;
  score: number; // 0-1 similarity
  normalizedExpected: string;
  normalizedActual: string;
}

export interface ResponseEvaluator {
  readonly name: string;
  // Promise-based even though the current implementation resolves
  // synchronously, so a future speech-recognition evaluator (which would
  // need to call an STT service) can implement this same interface without
  // a breaking signature change.
  evaluate(
    userInput: string,
    expectedPhrase: string,
    languageCode: string,
    kanaReading?: string,
    alternateReadings?: string[],
  ): Promise<EvaluationResult>;
}
