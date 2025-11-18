import { CacheProvider } from "@emotion/react"; // Provides a context for Emotion styles
import createCache from "@emotion/cache"; // Creates a custom cache for Emotion
//import { metropolisFonts } from "./common/utils/fontsUtils"; // Custom font styles as a string
//import inputAiStyles from "../src/css/InputAiPopup.css?inline";
interface CustomComponentProps {
  children: React.ReactNode; // Allows children elements to be passed to the component
}

/**
 * CustomComponent:
 * - Provides a custom Emotion cache for styling.
 * - Dynamically injects custom fonts into the document's head.
 * 
 * @param {CustomComponentProps} props - The children elements to be rendered.
 * @returns {JSX.Element} A wrapper component with Emotion cache support.
 */
const CustomComponent = ({ children }: CustomComponentProps) => {

  // Step 1: Create a custom Emotion cache
  // - `key`: A unique identifier for the cache.
  // - `prepend: true`: Ensures that styles are inserted at the top of the `<head>` tag.
  const cache = createCache({ key: "main-css", prepend: true });

  // Step 2: Dynamically inject custom font styles into the document's `<head>` tag.
  // - This ensures the `interFonts` styles are applied globally.
  // const styleElement = document.createElement("style");
  // styleElement.textContent = metropolisFonts;
  // document.head.appendChild(styleElement);

  // Step 3: Wrap children elements with `CacheProvider` to use the custom Emotion cache.
  return (
    <CacheProvider value={cache}>
      {/* <style>
        {inputAiStyles}
      </style> */}
      {children}
    </CacheProvider>
  );
};

export default CustomComponent;
