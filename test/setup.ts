import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

if (typeof window !== "undefined") {
  // jsdom doesn't implement <dialog> modality.
  const proto = window.HTMLDialogElement?.prototype;
  if (proto && typeof proto.showModal !== "function") {
    proto.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
    proto.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
  }
  window.HTMLMediaElement.prototype.play = async () => {};
  window.HTMLMediaElement.prototype.pause = () => {};
  window.requestAnimationFrame ??= (cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver ??= MockIntersectionObserver as unknown as typeof IntersectionObserver;
  URL.createObjectURL ??= () => "blob:mock";
  URL.revokeObjectURL ??= () => {};
}

if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
