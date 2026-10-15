import { describe, expect, it } from "vitest";
import { getSmartSignLiveEmail } from "@/lib/email";

describe("Smart Sign live email template", () => {
  it("renders escaped listing data and the non-notifying view link", () => {
    const email = getSmartSignLiveEmail({
      firstName: "Paige <Miller>",
      address: "1410 Division & Tacoma",
      viewUrl: "https://app.northshoresignco.com/s/TEST?source=share&check=1",
    });

    expect(email.subject).toContain("1410 Division & Tacoma");
    expect(email.html).toContain("Your Smart Sign box is live.");
    expect(email.html).toContain("Paige &lt;Miller&gt;");
    expect(email.html).toContain("1410 Division &amp; Tacoma");
    expect(email.html).toContain('href="https://app.northshoresignco.com/s/TEST?source=share&amp;check=1"');
    expect(email.html).not.toContain("{{");
  });
});
