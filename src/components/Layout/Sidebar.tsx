import React, { useState, useRef } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Settings, 
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  Calendar,
  Users,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NotificationPanel from './NotificationPanel';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  setIsCollapsed 
}) => {
  const { user, logout } = useAuth();
  const { 
    companies, 
    selectedCompany, 
    setSelectedCompany, 
    accountingPeriods, 
    selectedPeriod, 
    setSelectedPeriod,
    getUnreadNotifications,
    settings
  } = useData();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  
  const unreadNotifications = getUnreadNotifications();
  const currentCompany = companies.find(c => c.id === selectedCompany);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Factures', icon: FileText },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'reminders', label: 'Relances', icon: AlertTriangle },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'settings', label: 'Paramètres', icon: Settings }
  ];

  return (
    <>
      <div className={`bg-slate-900 text-white transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      } min-h-screen flex flex-col relative`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center">
                {currentCompany?.logoUrl ? (
                  <img
                    src={currentCompany.logoUrl}
                    alt={`Logo ${currentCompany.name}`}
                    className="w-8 h-8 object-contain rounded mr-3"
                  />
                ) : (
                  <Building2 size={24} className="mr-3" />
                )}
                <div>
                  <h1 className="text-xl font-bold">PayTracker</h1>
                  <p className="text-slate-400 text-sm">{user?.user_metadata?.full_name || user?.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              {/* Notifications */}
              <button
                ref={notificationButtonRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Bell size={20} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Company Selector */}
        {!isCollapsed && (
          <div className="p-4 border-b border-slate-700">
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Société active
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            
            {/* Logo de la société sélectionnée */}
            {currentCompany?.logoUrl && (
              <div className="mt-3 flex items-center justify-center">
                <img
                  src={currentCompany.logoUrl}
                  alt={`Logo ${currentCompany.name}`}
                  className="max-w-full max-h-16 object-contain rounded-lg bg-white/10 p-2"
                />
              </div>
            )}
          </div>
        )}

        {/* Collapsed Company Logo */}
        {isCollapsed && currentCompany?.logoUrl && (
          <div className="p-2 border-b border-slate-700 flex justify-center">
            <img
              src={currentCompany.logoUrl}
              alt={`Logo ${currentCompany.name}`}
              className="w-8 h-8 object-contain rounded"
            />
          </div>
        )}

        {/* Accounting Period Selector */}
        {!isCollapsed && (
          <div className="p-4 border-b border-slate-700">
            <label className="text-sm font-medium text-slate-300 mb-2 block flex items-center">
              <Calendar size={16} className="mr-2" />
              Exercice comptable
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accountingPeriods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center px-3 py-3 text-left rounded-lg transition-all ${
                      isActive 
                        ? 'text-white shadow-lg' 
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    style={isActive ? { backgroundColor: settings.accentColor } : {}}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="ml-3 font-medium">{item.label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className={`w-full flex items-center px-3 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Déconnexion' : undefined}
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="ml-3">Déconnexion</span>}
          </button>
        </div>
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <NotificationPanel 
          onClose={() => setShowNotifications(false)} 
          triggerRef={notificationButtonRef}
        />
      )}
    </>
  );
};

export default Sidebar;