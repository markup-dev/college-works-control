export const DEFAULT_GRADE_SCALE = [
  { label: '5', minScore: 95 },
  { label: '5-', minScore: 90 },
  { label: '4+', minScore: 85 },
  { label: '4', minScore: 75 },
  { label: '4-', minScore: 70 },
  { label: '3+', minScore: 65 },
  { label: '3', minScore: 55 },
  { label: '3-', minScore: 50 },
  { label: '2', minScore: 0 },
];

export const normalizeGradeScale = (scale) => {
  const source = Array.isArray(scale) && scale.length > 0 ? scale : DEFAULT_GRADE_SCALE;

  return source
    .map((item) => {
      const label = String(item?.label || '').trim();
      const minScore = Number(item?.minScore ?? item?.min_score);

      if (!/^[1-5][+-]?$/.test(label) || !Number.isInteger(minScore) || minScore < 0 || minScore > 100) {
        return null;
      }

      return { label, minScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.minScore - a.minScore);
};

export const getGradeScaleDuplicateError = (scale) => {
  const rows = Array.isArray(scale) ? scale : [];
  const labelCounts = new Map();
  const scoreCounts = new Map();

  rows.forEach((item) => {
    const label = String(item?.label || '').trim();
    const minScore = Number(item?.minScore ?? item?.min_score);

    if (!/^[1-5][+-]?$/.test(label) || !Number.isInteger(minScore)) {
      return;
    }

    labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    scoreCounts.set(minScore, (scoreCounts.get(minScore) || 0) + 1);
  });

  const duplicateLabels = [...labelCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([label]) => label);
  const duplicateScores = [...scoreCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([score]) => score);

  if (duplicateLabels.length > 0 && duplicateScores.length > 0) {
    return `Оценки не должны повторяться (${duplicateLabels.join(', ')}). Пороги «От баллов» тоже должны быть разными (${duplicateScores.join(', ')}).`;
  }

  if (duplicateLabels.length > 0) {
    return `Оценки не должны повторяться: ${duplicateLabels.join(', ')}.`;
  }

  if (duplicateScores.length > 0) {
    return `Пороги «От баллов» не должны повторяться: ${duplicateScores.join(', ')}.`;
  }

  return null;
};

export const getGradeScaleRanges = (scale) => {
  const rows = Array.isArray(scale) ? scale : [];
  const indexed = rows.map((item, index) => ({
    index,
    label: String(item?.label || '').trim(),
    minScore: Number(item?.minScore ?? item?.min_score),
  }));

  const validSorted = indexed
    .filter((item) => (
      /^[1-5][+-]?$/.test(item.label)
      && Number.isInteger(item.minScore)
      && item.minScore >= 0
      && item.minScore <= 100
    ))
    .sort((a, b) => b.minScore - a.minScore);

  const rangeByIndex = new Map();

  validSorted.forEach((item, position) => {
    const maxScore = position === 0 ? 100 : validSorted[position - 1].minScore - 1;
    rangeByIndex.set(item.index, {
      min: item.minScore,
      max: maxScore,
      label: `${item.minScore}–${maxScore}`,
    });
  });

  return rangeByIndex;
};

export const getGradeLabelForScore = (score, scale) => {
  if (score === null || score === undefined || score === '') {
    return null;
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return null;
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(numericScore)));
  const normalizedScale = normalizeGradeScale(scale);
  return normalizedScale.find((item) => normalizedScore >= item.minScore)?.label || null;
};
