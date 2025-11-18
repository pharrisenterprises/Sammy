import ReactDOM from "react-dom/client";
import Layout from "./contentScript/content.tsx";
//import cssStyles from "./css/InputAiPopup.css?inline"; // Ensure Vite inlines the CSS
import App from "./App.tsx";
import { HashRouter as Router } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./redux/store.ts";
import OptionalPages from "./components/Pages/index.tsx";
import { Toaster } from "./components/Ui/toaster.tsx";
//import { metropolisFonts } from "./common/utils/fontsUtils.ts";
//import { pageCss } from "./css/inject.ts";

setTimeout(() => {

    const demo = document.querySelector('body');
    const boxType = demo?.getAttribute('dom');
    if (boxType === 'popup') {
        // Create a new <div> element to serve as the root container for the React app
        const root = document.querySelector("body");

        // Render the React application into the root container
        if (root) {
            ReactDOM.createRoot(root).render(
                <Router>
                    <Provider store={store}>
                        <App />
                    </Provider>
                </Router>
            );
        }

    }

    if (boxType === 'dashboard') {
        // Create a new <div> element to serve as the root container for the React app
        const root = document.querySelector("body");

        // Render the React application into the root container
        if (root) {
            ReactDOM.createRoot(root).render(
                <Router>
                    <Toaster />
                    <Provider store={store}>
                        <OptionalPages />
                    </Provider>
                </Router>
            );
        }
    }

    if (boxType != 'dashboard' && boxType != 'popup' && !boxType) {
        // Create a new div for the extension root
        const div = document.createElement("div");
        div.id = "recorder-extension-root";

        // Attach Shadow DOM
        const shadowRoot = div.attachShadow({ mode: "open" });
        document.body.appendChild(div);

        // Create a container inside the Shadow DOM
        const reactRoot = document.createElement("div");
        shadowRoot.appendChild(reactRoot);

        // Inject CSS inside Shadow DOM
        // const style = document.createElement("style");
        // style.textContent = cssStyles; // Insert CSS content
        // shadowRoot.appendChild(style);

        // // Inject CSS inside Shadow DOM
        // const styleFont = document.createElement("style");
        // styleFont.textContent = metropolisFonts; // Insert CSS content
        // shadowRoot.appendChild(styleFont);

        // // Inject CSS inside Shadow DOM
        // const stylePageCss = document.createElement("style");
        // stylePageCss.textContent = pageCss; // Insert CSS content
        // shadowRoot.appendChild(stylePageCss);

        // Render the React app inside Shadow DOM
        ReactDOM.createRoot(reactRoot).render(<Provider store={store}><Layout /></Provider>);
    }
})