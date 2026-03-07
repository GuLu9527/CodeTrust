// A clean, well-structured TypeScript file with no issues

export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function isEven(n: number): boolean {
  return n % 2 === 0;
}

export function filterPositive(numbers: number[]): number[] {
  return numbers.filter((n) => n > 0);
}
