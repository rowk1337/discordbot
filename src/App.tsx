import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { supabase } from './lib/supabase';
import LoginForm from './components/Auth/LoginForm';
import MagicLinkForm from './components/Auth/MagicLinkForm';
import MagicLinkConfirmation from './components/Auth/MagicLinkConfirmation';
import GoogleCallback from './components/Auth/GoogleCallback';
import PasswordSetupPage from './components/Auth/PasswordSetupPage';
import PasswordChangeForm from './components/Auth/PasswordChangeForm';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import InvoiceList from './components/Invoices/InvoiceList';
import ImportTab from './components/Import/ImportTab';
import Settings from './components/Settings/Settings';
import ClientsTab from './components/Clients/ClientsTab';
import RemindersTab from './components/Reminders/RemindersTab';

const AppContent: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: dataLoading } = useData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  // Check if password change is required
  React.useEffect(() => {
    if (user) {
      checkPasswordChangeRequired();
    }
  }, [user]);

  const checkPasswordChangeRequired = async () => {
    try {
      // Check if the user needs to set up a password
      if (user?.user_metadata?.needs_password_setup) {
        setPasswordChangeRequired(true);
        return;
      }
      
      // Additional check from the database if needed
      const { data, error } = await supabase.rpc('verify_password_change_required');
      
      if (error) {
        console.error('Error checking password status:', error);
        return;
      }
      
      if (data.password_change_required) {
        setPasswordChangeRequired(true);
      }
    } catch (error) {
      console.error('Error checking password status:', error);
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Vérification de l\'authentification...' : 'Chargement des données...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // If password change is required, show the password change form
  if (passwordChangeRequired) {
    return <PasswordChangeForm />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'invoices': return <InvoiceList />;
      case 'clients': return <ClientsTab />;
      case 'reminders': return <RemindersTab />;
      case 'import': return <ImportTab />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
      />
      <main className="flex-1 overflow-x-hidden">
        {renderContent()}
      </main>
    </div>
  );
};

const MainApp: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/magic-link" element={<MagicLinkForm />} />
        <Route path="/auth/callback" element={<MagicLinkConfirmation />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/setup-password" element={<PasswordSetupPage />} />
        <Route path="/change-password" element={<PasswordChangeForm />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;