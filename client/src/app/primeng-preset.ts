import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// PrimeNG theme preset, seeded from AuraLink's existing --obd-* design tokens
// (see styles.scss) so PrimeNG components land close to the app's current
// look on day one instead of introducing a second, mismatched visual system.
// Built on the "Aura" base preset — unrelated naming collision with the
// in-app AI assistant "Aura"; it's just PrimeNG's preset name.
export const AuraLinkPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // --obd-blue
      600: '#2f74e0',
      700: '#2563eb',
      800: '#1d4ed8',
      900: '#1e40af',
      950: '#1e3a8a',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f2f4f8',
          100: '#9aa4b2',
          200: '#5b6472',
          300: '#2d313a',
          400: '#23262e',
          500: '#1a1d23',
          600: '#131519',
          700: '#0b0d11',
          800: '#0b0d11',
          900: '#08090c',
          950: '#050607',
        },
        primary: {
          color: '#3b82f6',
          contrastColor: '#ffffff',
          hoverColor: '#60a5fa',
          activeColor: '#2f74e0',
        },
        highlight: {
          background: 'rgba(59, 130, 246, 0.14)', // --obd-blue-dim
          focusBackground: 'rgba(59, 130, 246, 0.28)', // --obd-blue-glow
          color: '#f2f4f8',
          focusColor: '#f2f4f8',
        },
        content: {
          background: '#1a1d23', // --obd-surface-2
          hoverBackground: '#23262e', // --obd-surface-3
          borderColor: 'rgba(255, 255, 255, 0.11)', // --obd-border-strong
          color: '#f2f4f8',
          hoverColor: '#f2f4f8',
        },
        formField: {
          background: '#1a1d23',
          disabledBackground: '#23262e',
          filledBackground: '#1a1d23',
          borderColor: 'rgba(255, 255, 255, 0.11)',
          hoverBorderColor: '#5b6472',
          focusBorderColor: '#3b82f6',
          color: '#f2f4f8',
          placeholderColor: '#5b6472',
        },
      },
    },
  },
});
