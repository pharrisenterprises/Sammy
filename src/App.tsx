import "../src/css/InputAiPopup.css";
import { useEffect } from "react";
import Router from "./routes/Router";
// Check if chrome.runtime is available
/**
 * Main application component.
 *
 * This component handles the main logic of the application, including:
 * - Toggle functionality for opening/closing the main content.
 * - Drag-and-drop functionality for a draggable icon.
 * - Application of dynamic styles to iframes.
 * - Interaction with Chrome's storage and runtime APIs.
 *
 * @returns {JSX.Element} The rendered component.
 */

const App = () => {
  useEffect(() => {
  }, []);


  return (<div><Router /></div>);
};

export default App;