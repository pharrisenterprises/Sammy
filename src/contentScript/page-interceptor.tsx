// page-interceptor.ts
(function () {
  const origAttachShadow = Element.prototype.attachShadow;

  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const shadow = origAttachShadow.call(this, init);

    if (init.mode === "closed") {
      console.log("🔍 Intercepted closed shadow root on:", this);

      // Expose hidden root for automation
      (this as any).__realShadowRoot = shadow;

      // Auto-detect Google Autocomplete component
      if (this.tagName === "GMP-PLACE-AUTOCOMPLETE") {
        monitorAutocomplete(this, shadow);
      }
    }
    return shadow;
  };

  function monitorAutocomplete(host: Element, shadow: ShadowRoot | Node) {
    const input = (shadow as ShadowRoot).querySelector<HTMLInputElement>("input");

    if (!input) {
      // Try again later (Google loads lazily)
      const observer = new MutationObserver(() => {
        const input2 = (shadow as ShadowRoot).querySelector<HTMLInputElement>("input");
        if (input2) {
          observer.disconnect();
          setupListeners(host, input2, shadow);
        }
      });
      observer.observe(shadow, { childList: true, subtree: true });
    } else {
      setupListeners(host, input, shadow);
    }
  }

  function setupListeners(
    host: Element,
    input: HTMLInputElement,
    shadow: ShadowRoot | Node
  ) {
    console.log("🎯 Found internal input inside closed shadow root:", input);

    // 1️⃣ Listen for user input
    input.addEventListener("input", (e: Event) => {
      const target = e.target as HTMLInputElement;
      window.postMessage(
        {
          type: "AUTOCOMPLETE_INPUT",
          value: target.value,
          xpath: getXPath(e.target),
          label: target.name
        },
        "*"
      );
    });

    // 2️⃣ Listen for selection from suggestions
    shadow.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement;
      const li = target.closest<HTMLLIElement>("li[role='option']");
      if (li) {
        const text = li.innerText || li.textContent || "";
        window.postMessage(
          {
            type: "AUTOCOMPLETE_SELECTION",
            text,
            xpath: getXPath(li)
          },
          "*"
        );
      }
    });

    // Expose to global for automation replay
    (host as any).__autocompleteInput = input;
  }

    // 1️⃣ Helper: Get XPath of an element
  function getXPath(element: any) {
    const parts: string[] = [];

    while (element) {
      if (element.nodeType !== Node.ELEMENT_NODE) {
        element = element.parentNode;
        continue;
      }

      let index = 1;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = element.nodeName.toLowerCase();
      const part = `${tagName}[${index}]`;
      parts.unshift(part);

      // If element is inside a shadow root, move to the shadow host
      if (element.getRootNode() instanceof ShadowRoot) {
        element = (element.getRootNode() as ShadowRoot).host;
      } else {
        element = element.parentNode;
      }
    }

    return '/' + parts.join('/');
    }
})();
