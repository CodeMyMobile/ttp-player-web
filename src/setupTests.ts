import '@testing-library/jest-dom/vitest';

window.IntersectionObserver =
  window.IntersectionObserver ||
  class MockIntersectionObserver {
    readonly root: Element | null = null;

    readonly rootMargin = '0px';

    readonly thresholds: ReadonlyArray<number> = [0];

    observe() {}

    unobserve() {}

    disconnect() {}
  };
