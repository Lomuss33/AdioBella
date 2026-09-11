import "@testing-library/jest-dom/vitest";

// jsdom does not implement the native dialog lifecycle. Layout/focus containment
// are verified in the browser; expose open state for component behavior tests.
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };
