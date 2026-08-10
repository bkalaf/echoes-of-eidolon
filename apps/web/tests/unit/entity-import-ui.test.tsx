import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { PacketScreen } from "../../src/screens/PacketScreen";

const soulImport = pageManifest.find((entry) => entry.screenId === "DATA_SOUL_IMPORT")!;

describe("entity import screen", () => {
  it("parses pasted data into a real, non-writing preview", () => {
    render(<PacketScreen screen={soulImport} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Paste structured data" }), {
      target: { value: '[{"soulId":"SOUL-100","name":"Validated Soul"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse pasted data" }));

    expect(screen.getByText("1 valid row")).toBeInTheDocument();
    expect(screen.getByText("SOUL-100")).toBeInTheDocument();
    expect(screen.getByText("Validated Soul")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply unavailable" })).toBeDisabled();
  });

  it("blocks unknown fields until they are mapped or ignored", () => {
    render(<PacketScreen screen={soulImport} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Paste structured data" }), {
      target: { value: '[{"legacyId":"SOUL-100","name":"Validated Soul"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse pasted data" }));

    expect(screen.getByText("Source field legacyId must be mapped or ignored.")).toBeInTheDocument();
    expect(screen.getByText("Row 1 requires soulId.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Map legacyId" }), {
      target: { value: "soulId" },
    });
    expect(screen.getByText("1 valid row")).toBeInTheDocument();
  });
});
