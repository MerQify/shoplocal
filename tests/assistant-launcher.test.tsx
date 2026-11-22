// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  AssistantLauncherProvider,
  useAssistantLauncher,
} from "@/components/assistant/AssistantLauncher";

afterEach(cleanup);

function HelpButton() {
  const assistant = useAssistantLauncher();
  return <button onClick={(event) => assistant?.open(event.currentTarget)}>Get help</button>;
}

it("loads the assistant on demand and restores focus to the opener", async () => {
  render(
    <AssistantLauncherProvider vendorName="Aheed">
      <HelpButton />
    </AssistantLauncherProvider>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  const opener = screen.getByRole("button", { name: "Get help" });
  opener.focus();
  fireEvent.click(opener);
  expect(await screen.findByRole("dialog", {}, { timeout: 5000 })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close help assistant" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
