// src/contentScript/replay.tsx
// This script runs in PAGE CONTEXT (not content-script context).
// Inject it using a <script> tag from content.tsx when needed.

(function () {
  console.log("🎬 [Replay] Loaded and listening for autocomplete actions...");

  type ReplayAction = {
    type: "AUTOCOMPLETE_INPUT" | "AUTOCOMPLETE_SELECTION" | string;
    xpath?: string;
    text?: string;
    value?: string;
    delayMs?: number;
    hostXPath?: string;
    bundle?: { xpath?: string };
  };

  function getElementByXPath(xpath?: string): Element | null {
    if (!xpath) return null;
    try {
      return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue as Element | null;
    } catch (e) {
      console.warn("❌ XPath error:", e);
      return null;
    }
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function findShadowHostCandidate(action: ReplayAction): Promise<any | null> {
    if (action.hostXPath) {
      const host = getElementByXPath(action.hostXPath);
      if (host) return host;
    }

    const bundleXPath = action.bundle?.xpath;
    if (bundleXPath) {
      const host = getElementByXPath(bundleXPath);
      if (host) return host;
    }

    const fallback = document.querySelector("gmp-place-autocomplete");
    return fallback;
  }

  async function replayAutocompleteActions(actions: ReplayAction[]) {
    console.log("🎞 [Replay] Replaying actions:", actions);

    for (const action of actions) {
      await sleep(action.delayMs ?? 300);

      let el: Element | null = action.xpath
        ? getElementByXPath(action.xpath)
        : null;

      // Try shadow-host fallback if not found
      if (!el) {
        const host = await findShadowHostCandidate(action);
        if (host) {
          if ((host as any).__autocompleteInput) {
            el = (host as any).__autocompleteInput;
          } else if ((host as any).__realShadowRoot) {
            try {
              el = (host as any).__realShadowRoot.querySelector("input");
            } catch (err) {
              console.warn("⚠️ Failed to query __realShadowRoot:", err);
            }
          }
        }
      }

      // --- Input action ---
      if (action.type === "AUTOCOMPLETE_INPUT") {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          console.log("📝 [Replay] Typing value:", action.value);

          const proto = Object.getPrototypeOf(el);
          const desc = Object.getOwnPropertyDescriptor(proto, "value");
          if (desc && desc.set) {
            desc.set.call(el, action.value ?? "");
          } else {
            el.value = action.value ?? "";
          }

          el.focus();
          el.dispatchEvent(
            new InputEvent("input", { bubbles: true, composed: true, data: action.value ?? "" })
          );
          el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          continue;
        }

        console.warn("⚠️ [Replay] Input target not found:", action.xpath, el);
      }

      // --- Selection action ---
        if (action.type === "AUTOCOMPLETE_SELECTION") {
            const host = document.querySelector("gmp-place-autocomplete");
            if (host && (host as any).__realShadowRoot) {
                const shadow = (host as any).__realShadowRoot as ShadowRoot;

                const options = Array.from(shadow.querySelectorAll("li[role='option'], li"));
                const match = options.find(o =>
                    (o.textContent || "").trim().toLowerCase() === (action.text || "").trim().toLowerCase()
                );

                if (match instanceof HTMLElement) {
                    ["mouseover", "mousedown", "mouseup", "click"].forEach(ev =>
                        match.dispatchEvent(new MouseEvent(ev, { bubbles: true, composed: true }))
                    );
                    console.log("✅ Clicked option:", match.textContent?.trim());
                    continue;
                }
            }
        }
    }
  }

  window.addEventListener("message", (e) => {
    if (e.data?.type === "REPLAY_AUTOCOMPLETE") {
      const actions: ReplayAction[] = e.data.actions ?? [];
      replayAutocompleteActions(actions);
    }
  });
})();
