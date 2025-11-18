import { useEffect, useState } from "react";
import CustomIframe from "../../CustomIframe";
//import dashboardStyles from "../../css/dashboard.css?inline";
import Router from "../../routes/Router";
import { useLocation, useNavigate } from "react-router-dom";
import { StorageHelper } from "../../common/helpers/storageHelper";
import { setUser } from "../../redux/reducer/users";
import { useDispatch } from "react-redux";
//import { encodeBase64 } from "../../common/helpers/commonHelpers";
import { StorageKey } from "../../common/config/constMessage";

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

const OptionalPages = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const locationPage = useLocation(); // Get location object
  const [isPage, setIsPage] = useState(false);

  useEffect(() => {
    if (location.href.indexOf('onboarding') > -1) {
      setIsPage(true);
    } else {
      setIsPage(false);
    }
  }, [locationPage]);

  useEffect(() => {
    (async () => {
      if (location.href.indexOf('check-auth') > -1) {
        return;
      }
      else if (location.href.indexOf('onboarding') > -1) {
        setIsPage(true);
        return;
      } else {
        // Get user
        const user = await StorageHelper.get<any>(StorageKey['user']);
        if (user?.email && user?.accessToken || -1) {
          dispatch(setUser(user));
          // try {
          //   chrome.runtime.sendMessage({ action: 'saveUserDetails', path: `${encodeBase64(user.email)}/email`, value: user.email })
          // } catch (error) {
          //   console.error("❌ Failed to save user:", error);
          // }
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000);
          return true;
        }
        setTimeout(() => {
          navigate('/sign-in');
        }, 1000);

      }
    })();

  }, []);

  return <>
    <CustomIframe>
      {/* <style>
        {dashboardStyles}
      </style> */}
      <div className={`overflow-x-hidden relative w-full background-three ${isPage ? '' : 'bg-gradient'}`}>
        <Router />
      </div>
    </CustomIframe>
  </>
};

export default OptionalPages;

