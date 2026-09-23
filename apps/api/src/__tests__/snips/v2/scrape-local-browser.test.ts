import { describeIf, TEST_SELF_HOST, HAS_PLAYWRIGHT, TEST_SUITE_WEBSITE } from "../lib";
import { Identity, idmux, scrapeTimeout, scrape, scrapeRaw } from "./lib";

describeIf(TEST_SELF_HOST && HAS_PLAYWRIGHT)("Local browser features", () => {
  let identity: Identity;
  beforeAll(async () => { identity = await idmux({ name: "local-browser" }); });
  it("returns a screenshot and extracts DOM changes from page actions", async () => {
    const data = await scrape({
      url: TEST_SUITE_WEBSITE,
      formats: ["rawHtml", { type: "screenshot", viewport: { width: 640, height: 480 } }],
      actions: [
        { type: "executeJavascript", script: 'document.body.innerHTML = "<h1>Local browser works</h1>"; return 42;' },
        { type: "scrape" },
      ],
    }, identity);
    expect(data.rawHtml).toContain("Local browser works");
    expect(data.screenshot).toMatch(/^data:image\/png;base64,/);
    expect(data.actions?.javascriptReturns?.[0].value).toBe(42);
    expect(data.actions?.scrapes?.[0].html).toContain("Local browser works");
  }, scrapeTimeout);
  it("rejects unsupported actions", async () => {
    const response = await scrapeRaw({ url: TEST_SUITE_WEBSITE, actions: [{ type: "unknown" }] } as any, identity);
    expect(response.status).toBe(400);
  }, scrapeTimeout);
});
