import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { campaignObjectTypes } from "../../src/domain/campaign-planner";
import { pageManifest } from "../../src/lib/page-manifest";
import { CampaignAdminPage } from "../../src/screens/admin/CampaignAdminPage";

function campaignScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("Campaign Manager structure", () => {
  it("requires explicit world selection on the landing state", () => {
    render(<CampaignAdminPage screen={campaignScreen("CAM002")} />);
    expect(screen.getByText(/No world is selected by default\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CONCORD" })).toHaveAttribute("href", "/admin/campaign/planner?state=CAMPAIGN_CONCORD");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders 18 Book rows, every exact object-type column, and the three reviewed filters", () => {
    render(<CampaignAdminPage screen={campaignScreen("CAMPAIGN_RUIN")} />);
    const planner = screen.getByRole("table", { name: "RUIN 18-Book campaign planner" });
    expect(within(planner).getAllByRole("row")).toHaveLength(19);
    for (const objectType of campaignObjectTypes) {
      expect(within(planner).getByRole("columnheader", { name: objectType })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("World filter: RUIN")).toBeInTheDocument();
    expect(screen.getByLabelText("Book filter: Books 1 through 18")).toBeInTheDocument();
    expect(screen.getByLabelText("Linked-type filter: All linked types")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /empty assignment cell/ })).toHaveLength(18 * campaignObjectTypes.length);
  });

  it("does not copy sample assignment IDs into an empty canonical planner", () => {
    render(<CampaignAdminPage screen={campaignScreen("CAMPAIGN_CONCORD")} />);
    expect(screen.getByText(/No campaign assignment records are stored/)).toBeInTheDocument();
    expect(screen.queryByText(/PIL-01|WIT-01|ARCH-01|LR-01/)).not.toBeInTheDocument();
  });
});
