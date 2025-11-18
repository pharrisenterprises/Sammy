/**
 * @component
 * @description
 * The `Dashboard` component represents the main layout for the application, including a sidebar and a header. It is designed to wrap around child components, providing a consistent layout and navigation structure. The component also handles search functionality, displaying matched names based on user input.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered inside the `Dashboard`.
 *
 * @example
 * <Dashboard>
 *   <SomeChildComponent />
 * </Dashboard>
 *
 * @returns {JSX.Element} The rendered component.
 *
 * @hooks
 * - `useState`: Manages local state for `sidebarOpen`, `inputValue`, and `matchedNames`.
 *
 * @state
 * - `sidebarOpen` (boolean): Indicates whether the sidebar is open or closed.
 * - `inputValue` (string): The current value of the input field in the header.
 * - `matchedNames` (Array<{ matchedPart: string, remainingPart: string }>): Array of objects representing the names that match the search input.
 *
 * @effects
 * - Uses `setTimeout` to perform a navigation action after 10 seconds (commented out in the provided code).
 *
 * @methods
 * - `setSidebarOpen`: Toggles the sidebar open state.
 * - `setInputValue`: Updates the value of the input field in the header.
 * - `setMatchedNames`: Updates the list of matched names based on the search input.
 *
 * @returns {JSX.Element}
 * - Renders a `div` with the main structure of the dashboard including:
 *   - `Sidebar`: A component that represents the sidebar.
 *   - `Header`: A component that represents the header and includes search functionality.
 *   - A `main` section that contains the main content area for child components.
 *   - A list of matched names that is displayed as a dropdown below the search input when there are search results.
 *
 * @styles
 * - The sidebar and content area are styled to occupy the full height of the screen.
 * - The matched names dropdown is positioned absolutely and styled to appear over other content with a z-index of 9999.
 */

import { useLocation } from "react-router-dom";

const Section = ({ children }: any) => {
  const location = useLocation(); // Get location object
  const activePath = location.pathname; // Extract active path
  const notAllowPath = ['/', '/sign-in', '/sign-up', '/forgot-password', '/verify-email', '/reset-password', '/reset-success', '/check-auth'];
  // Check if the active path matches exactly
  const isWorkButton = notAllowPath.some(path =>
    path === activePath
  );
  const notallowHeaderFooter = ['/Recorder-tips', '/breathing-exercise', '/focus-timer', '/hold-breath'];
  const isNotallowHeaderFooter = notallowHeaderFooter.some(path =>
    path === activePath
  );
  return (
    <div id="wrapper" className="bg-gradient">
      {!isNotallowHeaderFooter &&
        <div className="bg-gradient h-screen w-full py-12 px-16 max-[767px]:py-6 max-[767px]:px-6">
          <div className="flex flex-col justify-between h-full">
            {/* Header */}
            <header className="flex justify-between items-center">
              <div className="logo">
                <span className="w-[118px] flex justify-center items-center">
                  <a href="#">
                    {/* <img
                      src="logo/logo_white.svg"
                      alt="logo"
                      className="w-full h-full object-center"
                    /> */}
                  </a>
                </span>
              </div>
              {!isWorkButton &&
                <div>
                  <a
                    href="#/dashboard"
                    className="flex bgfive w-full text-center text-white rounded-xl py-3 px-6 font16"
                  >
                    My Workspace
                  </a>
                </div>}
            </header>

            {children}

            <div className="flex gap-2.5">
              <span className="w-7 flex justify-center items-center">
                {/* <img
                  src="icon/a-cup.svg"
                  alt="icon"
                  className="w-full h-full object-center"
                /> */}
              </span>
              <p className="text-white font17 relative mt-[15px]">Small wins create ripples</p>
              <div className="h-[60px]"></div>
            </div>
          </div>
        </div>
      }
      {isNotallowHeaderFooter && children}
    </div>
  );
};

export default Section;
