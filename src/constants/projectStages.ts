export const PROJECT_STAGE_VALUES = ['discover', 'define', 'develop', 'deliver'] as const;

export const PROJECT_STAGE_OPTIONS = [
  { value: 'discover', label: '探索階段 Research' },
  { value: 'define', label: '定義階段 Synthesis' },
  { value: 'develop', label: '發展階段 Ideation' },
  { value: 'deliver', label: '交付階段 Implementation' },
] as const;
