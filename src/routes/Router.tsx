import { Route, Routes } from "react-router-dom";
import Section from "../pages/Section";
import Loader from "../components/Loader/Loader";
// import App from "../App";
//import Signin from "../components/Auth/Signin";
import Dashboard from "../pages/Dashboard";
import Layout from "../pages/Layout";
import Recorder from "../pages/Recorder";
import FieldMapper from "../pages/FieldMapper";
import TestRunner from "../pages/TestRunner";


/**
 * Router component that defines the application's routing structure.
 *
 * This component uses React Router's `<Routes>` and `<Route>` to define different routes
 * for the application. Each route renders a specific page component within a `Dashboard` layout.
 *
 * @returns {JSX.Element} The routes configuration for the application.
 */
const Router = () => {

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Section>
            <Loader />
          </Section>
        }
      />

      {/* <Route
        path="/sign-in"
        element={
          <Section>
            <Signin />
          </Section>
        }
      /> */}

      <Route
        path="/dashboard"
        element={
            <Layout>
              <Dashboard />
            </Layout>
        }
      />

      <Route
        path="/recorder"
        element={
            <Layout>
              <Recorder />
            </Layout>
        }
      />

      <Route
        path="/fieldMapper"
        element={
            <Layout>
              <FieldMapper/>
            </Layout>
        }
      />

      <Route
        path="/testRunner"
        element={
          <Layout>
            <TestRunner />
          </Layout>
        }
      />
    </Routes>
  );
};

export default Router;
