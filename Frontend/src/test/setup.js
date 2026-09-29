import '@testing-library/jest-dom';

// jsdom não implementa matchMedia — várias telas do app (Visão Geral,
// Alertas, tema) chamam window.matchMedia no primeiro render.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(query) {
    return {
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  };
}
