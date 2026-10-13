import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import FloatingOptions from "../src/components/FloatingOptions";

it("fits a narrow mobile viewport and flips above a control near the bottom", () => {
  const geometry = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      left: 20,
      right: 340,
      top: 500,
      bottom: 550,
      width: 320,
      height: 50,
    });
  vi.stubGlobal("innerWidth", 360);
  vi.stubGlobal("innerHeight", 640);
  function Harness() {
    const anchor = useRef(null);
    return (
      <div ref={anchor}>
        <FloatingOptions anchor={anchor} onClose={() => {}} role="listbox">
          <li>Food</li>
        </FloatingOptions>
      </div>
    );
  }
  render(<Harness />);
  const list = screen.getByRole("listbox");
  expect(list.style.position).toBe("fixed");
  expect(Number.parseFloat(list.style.top)).toBeLessThan(500);
  expect(
    Number.parseFloat(list.style.left) + Number.parseFloat(list.style.width),
  ).toBeLessThanOrEqual(352);
  fireEvent.resize(window);
  expect(list.style.maxHeight).toBe("240px");
  geometry.mockRestore();
  vi.unstubAllGlobals();
});
