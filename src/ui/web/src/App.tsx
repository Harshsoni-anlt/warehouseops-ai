import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import ImportData from './pages/ImportData';
import Dashboard from './pages/Dashboard';
import ChatInterfaceNew from './pages/ChatInterfaceNew';
import Equipment from './pages/EquipmentNew';
import Forecasting from './pages/Forecasting';
import Operations from './pages/Operations';
import Safety from './pages/Safety';
import Analytics from './pages/Analytics';
import Documentation from './pages/Documentation';
import DocumentExtraction from './pages/DocumentExtraction';
import MCPIntegrationGuide from './pages/MCPIntegrationGuide';
import APIReference from './pages/APIReference';
import DeploymentGuide from './pages/DeploymentGuide';
import ArchitectureDiagrams from './pages/ArchitectureDiagrams';
import MCPTest from './pages/MCPTest';
import VersionFooter from './components/VersionFooter';

function App() {
  return (
    <AuthProvider>
      {/* Layout already renders the flex row (sidebar + main). Wrapping it in a
          second identical flex container made Layout a content-sized flex item,
          so `main` never grew to fill the window and every page rendered in a
          ~60%-wide column with dead space to the right. */}
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Overview />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/import" element={<ImportData />} />
                    <Route path="/chat" element={<ChatInterfaceNew />} />
                    <Route path="/equipment" element={<Equipment />} />
                    <Route path="/forecasting" element={<Forecasting />} />
                    <Route path="/operations" element={<Operations />} />
                    <Route path="/safety" element={<Safety />} />
                    <Route path="/documents" element={<DocumentExtraction />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/documentation" element={<Documentation />} />
                    <Route path="/documentation/mcp-integration" element={<MCPIntegrationGuide />} />
                    <Route path="/documentation/api-reference" element={<APIReference />} />
                    <Route path="/documentation/deployment" element={<DeploymentGuide />} />
                    <Route path="/documentation/architecture" element={<ArchitectureDiagrams />} />
                    <Route path="/mcp-test" element={<MCPTest />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
      </Routes>
      <VersionFooter />
    </AuthProvider>
  );
}

export default App;
