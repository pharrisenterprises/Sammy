import Layout from "./Layout";
import Dashboard from "./Dashboard";
import Recorder from "./Recorder";
import FieldMapper from "./FieldMapper";
import TestRunner from "./TestRunner";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';


const PAGES = {

    Dashboard: Dashboard,

    Recorder: Recorder,

    FieldMapper: FieldMapper,

    TestRunner: TestRunner

}

function _getCurrentPage(url: any) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    console.log("currentPage >>>", currentPage);
    return (
        <Layout>
            <Routes>

                <Route path="/" element={<Dashboard />} />


                <Route path="/Dashboard" element={<Dashboard />} />

                <Route path="/FieldMapper" element={<FieldMapper />} />

                <Route path="/TestRunner" element={<TestRunner />} />

                <Route path="/Recorder" element={<Recorder />} />

            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}