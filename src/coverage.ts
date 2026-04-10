import {
  SourceAnalysis,
  CoveragePrediction,
  TestSuite,
} from './types.js';

export function predictCoverage(analysis: SourceAnalysis, suite: TestSuite): CoveragePrediction {
  const uncoveredPaths: string[] = [];
  const suggestions: string[] = [];

  const testedNames = new Set(suite.testCases.map((tc) => tc.name.split(' ')[0] ?? ''));

  // Check function coverage
  let coveredFunctions = 0;
  for (const fn of analysis.functions) {
    if (fn.isExported) {
      const isTested = testedNames.has(fn.name);
      if (isTested) {
        coveredFunctions++;
      } else {
        uncoveredPaths.push(`Function ${fn.name} is not tested`);
        suggestions.push(`Add tests for exported function: ${fn.name}`);
      }
    }
  }

  // Check class method coverage
  let coveredMethods = 0;
  let totalMethods = 0;
  for (const cls of analysis.classes) {
    for (const method of cls.methods) {
      totalMethods++;
      const isTested = testedNames.has(method.name) || Array.from(testedNames).some((n) => n.includes(method.name));
      if (isTested) {
        coveredMethods++;
      } else {
        uncoveredPaths.push(`${cls.name}.${method.name} is not tested`);
        suggestions.push(`Add tests for ${cls.name}.${method.name} method`);
      }
    }
  }

  // Check for uncovered error paths
  for (const fn of analysis.functions) {
    if (fn.throws.length > 0) {
      const hasErrorTest = suite.testCases.some(
        (tc) => tc.name.includes(fn.name) && (tc.tags.includes('error') || tc.tags.includes('edge-case')),
      );
      if (!hasErrorTest) {
        uncoveredPaths.push(`${fn.name} error paths not tested`);
        suggestions.push(`Add error path tests for ${fn.name} (throws: ${fn.throws.join(', ')})`);
      }
    }
  }

  // Check for untested async error paths
  for (const fn of analysis.functions) {
    if (fn.isAsync) {
      const hasAsyncErrorTest = suite.testCases.some(
        (tc) => tc.name.includes(fn.name) && tc.tags.includes('async'),
      );
      if (!hasAsyncErrorTest) {
        suggestions.push(`Add async rejection test for ${fn.name}`);
      }
    }
  }

  // Check for untested optional params
  for (const fn of analysis.functions) {
    const optionalParams = fn.params.filter((p) => p.optional);
    if (optionalParams.length > 0) {
      const hasOptionalTest = suite.testCases.some(
        (tc) => tc.name.includes(fn.name) && tc.name.includes('undefined'),
      );
      if (!hasOptionalTest) {
        suggestions.push(
          `Test ${fn.name} without optional params: ${optionalParams.map((p) => p.name).join(', ')}`,
        );
      }
    }
  }

  // Calculate estimates
  const totalExported = analysis.functions.filter((f) => f.isExported).length + totalMethods;
  const covered = coveredFunctions + coveredMethods;
  const functionCoverage = totalExported > 0 ? Math.round((covered / totalExported) * 100) : 100;

  const lineCoverage = Math.min(functionCoverage + 10, suite.coverageEstimate);
  const branchCoverage = Math.max(functionCoverage - 10, 0);

  return {
    filePath: analysis.filePath,
    estimatedLineCoverage: lineCoverage,
    estimatedBranchCoverage: branchCoverage,
    estimatedFunctionCoverage: functionCoverage,
    uncoveredPaths: uncoveredPaths.slice(0, 10),
    suggestions: suggestions.slice(0, 10),
  };
}

export function formatCoverageReport(prediction: CoveragePrediction): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`  Coverage Prediction: ${prediction.filePath}`);
  lines.push('  ----------------------------------------');
  lines.push(`  Line coverage:     ~${prediction.estimatedLineCoverage}%`);
  lines.push(`  Branch coverage:   ~${prediction.estimatedBranchCoverage}%`);
  lines.push(`  Function coverage: ~${prediction.estimatedFunctionCoverage}%`);

  if (prediction.uncoveredPaths.length > 0) {
    lines.push('');
    lines.push('  Uncovered paths:');
    for (const path of prediction.uncoveredPaths) {
      lines.push(`    - ${path}`);
    }
  }

  if (prediction.suggestions.length > 0) {
    lines.push('');
    lines.push('  Suggestions:');
    for (const suggestion of prediction.suggestions) {
      lines.push(`    + ${suggestion}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
