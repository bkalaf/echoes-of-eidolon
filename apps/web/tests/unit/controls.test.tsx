import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoundedNumberField, FiniteChipSelection, OtpInput, PasswordInput } from "../../src/components/ui/controls";
import { numericControlContracts } from "../../src/domain/numeric-controls";

describe("hardened numeric controls", () => {
  it("preserves the exact approved numeric boundaries", () => {
    expect(numericControlContracts).toEqual({
      book: { label: "Book", max: 18, min: 1, step: 1 },
      gameHour: { label: "Game hour", max: 23, min: 0, step: 1 },
      gameMinute: { label: "Game minute", max: 59, min: 0, step: 1 },
      gameOrdinalDay: { label: "Game ordinal day", max: 489, min: 1, step: 1 },
      gameYear: { label: "Game year", max: 4040, min: 0, step: 1 },
      latitude: { label: "Latitude", max: 90, min: -90, step: "any" },
      longitude: { label: "Longitude", max: 180, min: -180, step: "any" },
    });
    render(<BoundedNumberField control="gameOrdinalDay" />);
    expect(screen.getByRole("spinbutton", { name: "Game ordinal day" })).toHaveAttribute("min", "1");
    expect(screen.getByRole("spinbutton", { name: "Game ordinal day" })).toHaveAttribute("max", "489");
  });

  it("renders one logical OTP input as six visible digit positions and strips non-digits", () => {
    render(<label>Verification code<OtpInput /></label>);
    const input = screen.getByRole("textbox", { name: "Verification code" });
    expect(document.querySelectorAll("[data-otp-slot]")).toHaveLength(6);
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(input).toHaveAttribute("minlength", "6");
    expect(input).toHaveAttribute("pattern", "[0-9]{6}");
    expect(input).toHaveAttribute("type", "text");
    fireEvent.input(input, { target: { value: "12a34-567" } });
    expect(input).toHaveValue("123456");
    expect([...document.querySelectorAll("[data-otp-slot]")].map((slot) => slot.textContent)).toEqual(["1", "2", "3", "4", "5", "6"]);
    fireEvent.input(input, { target: { value: "12345" } });
    expect(input).toHaveValue("12345");
    expect(document.querySelectorAll("[data-otp-slot]")[5]).toHaveTextContent("");
  });
});

describe("canonical password control", () => {
  it("preserves values, toggles independently, and never submits from its visibility action", () => {
    const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submitted}>
      <PasswordInput autoComplete="new-password" label="New password" />
      <PasswordInput autoComplete="new-password" label="Confirm new password" />
    </form>);

    const password = screen.getByLabelText("New password", { exact: true });
    const confirmation = screen.getByLabelText("Confirm new password", { exact: true });
    fireEvent.change(password, { target: { value: "Replacement-Password!" } });
    fireEvent.change(confirmation, { target: { value: "Replacement-Password!" } });
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]!);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("Replacement-Password!");
    expect(confirmation).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("type", "button");
    expect(submitted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("Replacement-Password!");
  });
});

describe("finite enum chip controls", () => {
  it("sorts and labels raw tokens while deriving stable color from the allowed-token index", () => {
    const onChange = vi.fn();
    render(<FiniteChipSelection
      allowedTokens={["CHANGE", "ANGER", "ACCOUNTABILITY"]}
      label="Personality family"
      multiple
      onChange={onChange}
      selectedTokens={["CHANGE", "ACCOUNTABILITY"]}
    />);

    const selected = screen.getByRole("group", { name: "Personality family" }).querySelectorAll("button");
    expect([...selected].map((button) => button.dataset.token)).toEqual(["ACCOUNTABILITY", "CHANGE"]);
    expect(selected[0]).toHaveClass("finite-chip--tone-0");
    expect(selected[1]).toHaveClass("finite-chip--tone-2");
    expect(screen.getByRole("button", { name: "Clear Accountability" })).toHaveValue("ACCOUNTABILITY");
    fireEvent.click(screen.getByRole("button", { name: "Clear Accountability" }));
    expect(onChange).toHaveBeenCalledWith(["CHANGE"]);
  });
});
