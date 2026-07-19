// Evalueert formule-strings in x (zoals "2*x+3" of "x^2-4") die de AI als
// figuurdata teruggeeft. Recursive-descent parser met + - * / ^, haakjes,
// impliciete vermenigvuldiging (2x, 3(x+1)) en sin/cos/tan/sqrt/abs/ln/log/exp.

export function evalueerFormule(formule: string, x: number): number | null {
  const parser = new Parser(formule, x);
  const waarde = parser.parseExpressie();
  if (waarde === null || !parser.restIsLeeg()) return null;
  return Number.isFinite(waarde) ? waarde : null;
}

class Parser {
  private readonly tekens: string;
  private index = 0;
  private readonly x: number;

  constructor(formule: string, x: number) {
    this.tekens = formule.replace(/,/g, '.');
    this.x = x;
  }

  private get huidig(): string | undefined {
    return this.tekens[this.index];
  }

  private slaSpatiesOver(): void {
    while (this.huidig === ' ') this.index++;
  }

  restIsLeeg(): boolean {
    this.slaSpatiesOver();
    return this.index >= this.tekens.length;
  }

  // expressie := term (('+' | '-') term)*
  parseExpressie(): number | null {
    let resultaat = this.parseTerm();
    if (resultaat === null) return null;
    for (;;) {
      this.slaSpatiesOver();
      if (this.huidig === '+') {
        this.index++;
        const rechts = this.parseTerm();
        if (rechts === null) return null;
        resultaat += rechts;
      } else if (this.huidig === '-') {
        this.index++;
        const rechts = this.parseTerm();
        if (rechts === null) return null;
        resultaat -= rechts;
      } else {
        break;
      }
    }
    return resultaat;
  }

  // term := macht (('*' | '/' | impliciet) macht)*
  private parseTerm(): number | null {
    let resultaat = this.parseMacht();
    if (resultaat === null) return null;
    for (;;) {
      this.slaSpatiesOver();
      const teken = this.huidig;
      if (teken === '*' || teken === '×') {
        this.index++;
        const rechts = this.parseMacht();
        if (rechts === null) return null;
        resultaat *= rechts;
      } else if (teken === '/' || teken === '÷') {
        this.index++;
        const rechts = this.parseMacht();
        if (rechts === null) return null;
        resultaat /= rechts;
      } else if (teken !== undefined && (/[a-zA-Z0-9(π√]/.test(teken))) {
        // Impliciete vermenigvuldiging: 2x, 3(x+1), 2πx
        const rechts = this.parseMacht();
        if (rechts === null) return null;
        resultaat *= rechts;
      } else {
        break;
      }
    }
    return resultaat;
  }

  // macht := factor ('^' macht)?   (rechts-associatief)
  private parseMacht(): number | null {
    const basis = this.parseFactor();
    if (basis === null) return null;
    this.slaSpatiesOver();
    if (this.huidig === '^') {
      this.index++;
      const exponent = this.parseMacht();
      if (exponent === null) return null;
      return Math.pow(basis, exponent);
    }
    return basis;
  }

  private parseFactor(): number | null {
    this.slaSpatiesOver();
    const teken = this.huidig;
    if (teken === undefined) return null;

    if (teken === '-') {
      this.index++;
      const waarde = this.parseFactor();
      return waarde === null ? null : -waarde;
    }
    if (teken === '(') {
      this.index++;
      const waarde = this.parseExpressie();
      this.slaSpatiesOver();
      if (this.huidig === ')') this.index++;
      return waarde;
    }
    if (teken === '√') {
      this.index++;
      const waarde = this.parseFactor();
      return waarde === null ? null : Math.sqrt(waarde);
    }
    if (teken === 'π') {
      this.index++;
      return Math.PI;
    }
    if (/[0-9.]/.test(teken)) {
      let getal = '';
      while (this.huidig !== undefined && /[0-9.]/.test(this.huidig)) {
        getal += this.huidig;
        this.index++;
      }
      const waarde = Number(getal);
      return Number.isNaN(waarde) ? null : waarde;
    }
    if (/[a-zA-Z]/.test(teken)) {
      let naam = '';
      while (this.huidig !== undefined && /[a-zA-Z]/.test(this.huidig)) {
        naam += this.huidig;
        this.index++;
      }
      switch (naam.toLowerCase()) {
        case 'x': return this.x;
        case 'pi': return Math.PI;
        case 'e': return Math.E;
        case 'sin': return this.pasToe(Math.sin);
        case 'cos': return this.pasToe(Math.cos);
        case 'tan': return this.pasToe(Math.tan);
        case 'sqrt':
        case 'wortel': return this.pasToe(Math.sqrt);
        case 'abs': return this.pasToe(Math.abs);
        case 'ln': return this.pasToe(Math.log);
        case 'log': return this.pasToe(Math.log10);
        case 'exp': return this.pasToe(Math.exp);
        default: return null;
      }
    }
    return null;
  }

  private pasToe(functie: (waarde: number) => number): number | null {
    const argument = this.parseArgument();
    return argument === null ? null : functie(argument);
  }

  private parseArgument(): number | null {
    this.slaSpatiesOver();
    if (this.huidig !== '(') return this.parseFactor();
    this.index++;
    const waarde = this.parseExpressie();
    this.slaSpatiesOver();
    // Niet via de getter: TypeScript houdt anders de eerdere narrowing vast.
    if (this.tekens[this.index] === ')') this.index++;
    return waarde;
  }
}
