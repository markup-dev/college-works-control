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
