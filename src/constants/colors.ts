export const Colors = {
  // Brand
  primary:     '#534AB7',
  primaryDark: '#3C3489',
  primaryLight:'#EEEDFE',

  // Backgrounds
  bgPrimary:   '#FFFFFF',
  bgSecondary: '#F8F7FF',
  bgTertiary:  '#F1EFE8',

  // Text
  textPrimary:   '#1A1A2E',
  textSecondary: '#5F5E5A',
  textTertiary:  '#888780',

  // Risk levels
  risk: {
    low:      { bg: '#EAF3DE', text: '#27500A', border: '#C0DD97' },
    medium:   { bg: '#FAEEDA', text: '#633806', border: '#FAC775' },
    high:     { bg: '#FAECE7', text: '#712B13', border: '#F5C4B3' },
    critical: { bg: '#FCEBEB', text: '#791F1F', border: '#F7C1C1' },
  },

  // Diff colors
  diffAdd:     { bg: '#EAF3DE', text: '#27500A' },
  diffRemove:  { bg: '#FCEBEB', text: '#791F1F' },
  diffContext: { bg: 'transparent', text: '#5F5E5A' },

  // Status
  success: '#3B6D11',
  warning: '#854F0B',
  danger:  '#A32D2D',
  info:    '#185FA5',

  // UI
  border:       '#E8E6E0',
  borderLight:  '#F0EDE8',
  cardBg:       '#FFFFFF',
  shadow:       'rgba(0,0,0,0.06)',

  // Tool type colors
  tool: {
    Bash:      { bg: '#E6F1FB', text: '#0C447C', dot: '#378ADD' },
    Write:     { bg: '#EAF3DE', text: '#27500A', dot: '#639922' },
    Edit:      { bg: '#EEEDFE', text: '#3C3489', dot: '#534AB7' },
    MultiEdit: { bg: '#FAEEDA', text: '#633806', dot: '#BA7517' },
    unknown:   { bg: '#F1EFE8', text: '#444441', dot: '#888780' },
  },

  // Tab bar
  tabActive:   '#534AB7',
  tabInactive: '#888780',
  tabBg:       '#FFFFFF',

  white:       '#FFFFFF',
  black:       '#000000',
}

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
}

export const Radius = {
  sm:  6,
  md:  10,
  lg:  14,
  xl:  20,
  full: 9999,
}

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 28,
}

export const Shadow = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  4,
    elevation:     2,
  },
  modal: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    elevation:     8,
  },
}
