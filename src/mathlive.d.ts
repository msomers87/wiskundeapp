import type React from 'react';
import type { MathfieldElement } from 'mathlive';

// Maakt het MathLive web-component <math-field> bekend bij JSX/TypeScript.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}
