import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Building2, Palette, Bell, Plus, Edit, Trash2, Calendar, UserPlus, GripVertical, Mail, Send, Upload, Image } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import GoogleIntegrationSection from './GoogleIntegrationSection';
import EmailSystemSection from './EmailSystemSection';
import UserManagementSection from './UserManagementSection';
import CompanyLogoUpload from './CompanyLogoUpload';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { 
    companies, 
    updateCompany, 
    addCompany, 
    deleteCompany, 
    settings, 
    updateSettings,
    accountingPeriods,
    addAccountingPeriod,
    updateAccountingPeriod,
    clients,
    reorderCompanies,
    reorderAccountingPeriods
  } = useData();
  const [activeSection, setActiveSection] = useState('companies');
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyColor, setNewCompanyColor] = useState('#3B82F6');
  const [draggedCompany, setDraggedCompany] = useState<string | null>(null);
  const [draggedPeriod, setDraggedPeriod] = useState<string | null>(null);
  const [showLogoUpload, setShowLogoUpload] = useState<string | null>(null);

  const sections = [
    { id: 'companies', label: 'Sociétés', icon: Building2 },
    { id: 'periods', label: 'Exercices Comptables', icon: Calendar },
    { id: 'clients', label: 'Types de Clients', icon: Users },
    { id: 'google', label: 'Intégration Google', icon: Mail },
    { id: 'email-system', label: 'Système Email', icon: Send },
    { id: 'appearance', label: 'Apparence', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    ...(user?.user_metadata?.role === 'admin' ? [{ id: 'users', label: 'Utilisateurs', icon: UserPlus }] : [])
  ];

  const clientTypes = [
    { 
      id: 'externe', 
      label: 'Client Externe', 
      description: 'Clients extérieurs à votre organisation',
      color: 'bg-blue-500'
    },
    { 
      id: 'interne', 
      label: 'Client Interne', 
      description: 'Départements ou services internes',
      color: 'bg-green-500'
    },
    { 
      id: 'partenaire', 
      label: 'Partenaire', 
      description: 'Partenaires commerciaux et collaborateurs',
      color: 'bg-purple-500'
    }
  ];

  const accentColors = [
    { name: 'Bleu', value: '#3B82F6' },
    { name: 'Vert', value: '#10B981' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Rose', value: '#EC4899' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Rouge', value: '#EF4444' }
  ];

  const handleAddCompany = async () => {
    if (newCompanyName.trim()) {
      await addCompany({
        name: newCompanyName.trim(),
        color: newCompanyColor
      });
      setNewCompanyName('');
      setNewCompanyColor('#3B82F6');
    }
  };

  const handleUpdateCompany = async (id: string, name: string, color: string) => {
    await updateCompany(id, { name, color });
    setEditingCompany(null);
  };

  const handleLogoUpdated = async (companyId: string, logoUrl: string, fileName: string) => {
    await updateCompany(companyId, { logoUrl, logoFileName: fileName });
  };

  const handleAddPeriod = async () => {
    const currentYear = new Date().getFullYear();
    await addAccountingPeriod({
      name: `Exercice ${currentYear}-${currentYear + 1}`,
      startDate: `${currentYear}-10-01`,
      endDate: `${currentYear + 1}-09-30`,
      isActive: false
    });
  };

  const getClientsByType = (type: string) => {
    return clients.filter(client => client.type === type);
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'company' | 'period') => {
    if (type === 'company') {
      setDraggedCompany(id);
    } else {
      setDraggedPeriod(id);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string, type: 'company' | 'period') => {
    e.preventDefault();
    
    if (type === 'company' && draggedCompany && draggedCompany !== targetId) {
      const draggedIndex = companies.findIndex(c => c.id === draggedCompany);
      const targetIndex = companies.findIndex(c => c.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newCompanies = [...companies];
        const [draggedItem] = newCompanies.splice(draggedIndex, 1);
        newCompanies.splice(targetIndex, 0, draggedItem);
        await reorderCompanies(newCompanies);
      }
      setDraggedCompany(null);
    } else if (type === 'period' && draggedPeriod && draggedPeriod !== targetId) {
      const draggedIndex = accountingPeriods.findIndex(p => p.id === draggedPeriod);
      const targetIndex = accountingPeriods.findIndex(p => p.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newPeriods = [...accountingPeriods];
        const [draggedItem] = newPeriods.splice(draggedIndex, 1);
        newPeriods.splice(targetIndex, 0, draggedItem);
        await reorderAccountingPeriods(newPeriods);
      }
      setDraggedPeriod(null);
    }
  };

  const updateClientTypeSettings = async (type: string, field: string, value: any) => {
    await updateSettings({
      clientTypeSettings: {
        ...settings.clientTypeSettings,
        [type]: {
          ...settings.clientTypeSettings?.[type],
          [field]: value
        }
      }
    });
  };

  const renderCompaniesSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Gestion des Sociétés</h3>
      </div>

      {/* Add Company Form */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">Ajouter une société</h4>
        <div className="flex gap-4">
          <input
            type="text"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder="Nom de la société"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="color"
            value={newCompanyColor}
            onChange={(e) => setNewCompanyColor(e.target.value)}
            className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
          />
          <button
            onClick={handleAddCompany}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus size={16} className="mr-2" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Companies List */}
      <div className="grid gap-4">
        {companies.map(company => (
          <div 
            key={company.id} 
            className="bg-white rounded-xl p-6 border border-gray-200 cursor-move"
            draggable
            onDragStart={(e) => handleDragStart(e, company.id, 'company')}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, company.id, 'company')}
          >
            {editingCompany === company.id ? (
              <EditCompanyForm
                company={company}
                onSave={handleUpdateCompany}
                onCancel={() => setEditingCompany(null)}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <GripVertical size={16} className="text-gray-400 mr-3" />
                    {company.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={`Logo ${company.name}`}
                        className="w-8 h-8 object-contain rounded mr-4"
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded mr-4"
                        style={{ backgroundColor: company.color }}
                      />
                    )}
                    <div>
                      <h4 className="font-semibold text-gray-900">{company.name}</h4>
                      <p className="text-sm text-gray-500">ID: {company.id}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowLogoUpload(company.id)}
                      className="px-3 py-1.5 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors flex items-center"
                    >
                      <Upload size={14} className="mr-1" />
                      Logo
                    </button>
                    <button
                      onClick={() => setEditingCompany(company.id)}
                      className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center"
                    >
                      <Edit size={14} className="mr-1" />
                      Modifier
                    </button>
                    {companies.length > 1 && (
                      <button
                        onClick={() => deleteCompany(company.id)}
                        className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center"
                      >
                        <Trash2 size={14} className="mr-1" />
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {/* Logo Upload Modal */}
                {showLogoUpload === company.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="font-medium text-gray-900">Gestion du logo</h5>
                      <button
                        onClick={() => setShowLogoUpload(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    </div>
                    <CompanyLogoUpload
                      company={company}
                      onLogoUpdated={(logoUrl, fileName) => {
                        handleLogoUpdated(company.id, logoUrl, fileName);
                        setShowLogoUpload(null);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderPeriodsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Exercices Comptables</h3>
        <button
          onClick={handleAddPeriod}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus size={16} className="mr-2" />
          Nouvel exercice
        </button>
      </div>

      <div className="grid gap-4">
        {accountingPeriods.map(period => (
          <div 
            key={period.id} 
            className="bg-white rounded-xl p-6 border border-gray-200 cursor-move"
            draggable
            onDragStart={(e) => handleDragStart(e, period.id, 'period')}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, period.id, 'period')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <GripVertical size={16} className="text-gray-400 mr-3" />
                <div>
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    {period.name}
                    {period.isActive && (
                      <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                        Actif
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Du {new Date(period.startDate).toLocaleDateString('fr-FR')} au {new Date(period.endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  Modifier
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderClientsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Types de Clients</h3>
        <p className="text-gray-600">
          Configurez les différents types de clients et leurs paramètres par défaut.
        </p>
      </div>

      <div className="grid gap-6">
        {clientTypes.map(type => (
          <div key={type.id} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-4 ${type.color}`} />
                <div>
                  <h4 className="font-semibold text-gray-900">{type.label}</h4>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {getClientsByType(type.id).length} client{getClientsByType(type.id).length > 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Default payment terms */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-3">Paramètres par défaut</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Délai de paiement (jours)
                  </label>
                  <input
                    type="number"
                    value={settings.clientTypeSettings?.[type.id]?.defaultPaymentDays || (type.id === 'externe' ? 30 : type.id === 'partenaire' ? 60 : 15)}
                    onChange={(e) => updateClientTypeSettings(type.id, 'defaultPaymentDays', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mode de règlement par défaut
                  </label>
                  <select
                    value={settings.clientTypeSettings?.[type.id]?.defaultPaymentMode || 'Virement'}
                    onChange={(e) => updateClientTypeSettings(type.id, 'defaultPaymentMode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                    <option value="Prélèvement">Prélèvement</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Apparence</h3>
        <p className="text-gray-600">
          Personnalisez l'apparence de votre application.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Thème</h4>
          <div className="grid grid-cols-3 gap-4">
            {['light', 'dark', 'auto'].map((theme) => (
              <div
                key={theme}
                onClick={() => updateSettings({ theme: theme as any })}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  settings.theme === theme ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`rounded h-20 mb-2 ${
                  theme === 'light' ? 'bg-white shadow-sm' :
                  theme === 'dark' ? 'bg-gray-800' :
                  'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}></div>
                <p className="text-sm font-medium text-center capitalize">{theme === 'auto' ? 'Automatique' : theme === 'light' ? 'Clair' : 'Sombre'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Couleur d'accent</h4>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateSettings({ accentColor: color.value })}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                    settings.accentColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications</h3>
        <p className="text-gray-600">
          Configurez vos préférences de notification.
        </p>
      </div>

      <div className="space-y-4">
        {[
          { 
            key: 'overdueInvoices', 
            label: 'Factures en retard', 
            description: 'Recevoir une notification pour les factures en retard' 
          },
          { 
            key: 'newPayments', 
            label: 'Nouveaux paiements', 
            description: 'Être notifié lors de la réception d\'un paiement' 
          },
          { 
            key: 'dueDateReminders', 
            label: 'Rappels d\'échéance', 
            description: 'Rappels 7 jours avant l\'échéance des factures' 
          },
          { 
            key: 'weeklyReport', 
            label: 'Résumé hebdomadaire', 
            description: 'Recevoir un résumé hebdomadaire de l\'activité' 
          }
        ].map((setting) => (
          <div key={setting.key} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{setting.label}</h4>
                <p className="text-sm text-gray-500">{setting.description}</p>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={settings.notifications[setting.key as keyof typeof settings.notifications]}
                  onChange={(e) => updateSettings({
                    notifications: {
                      ...settings.notifications,
                      [setting.key]: e.target.checked
                    }
                  })}
                  className="sr-only"
                />
                <div 
                  className={`w-10 h-6 rounded-full shadow-inner transition-colors cursor-pointer ${
                    settings.notifications[setting.key as keyof typeof settings.notifications] 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                  }`}
                  onClick={() => updateSettings({
                    notifications: {
                      ...settings.notifications,
                      [setting.key]: !settings.notifications[setting.key as keyof typeof settings.notifications]
                    }
                  })}
                ></div>
                <div 
                  className={`absolute w-4 h-4 bg-white rounded-full shadow transform transition-transform cursor-pointer ${
                    settings.notifications[setting.key as keyof typeof settings.notifications] 
                      ? 'translate-x-5' 
                      : 'translate-x-1'
                  }`}
                  onClick={() => updateSettings({
                    notifications: {
                      ...settings.notifications,
                      [setting.key]: !settings.notifications[setting.key as keyof typeof settings.notifications]
                    }
                  })}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'companies': return renderCompaniesSection();
      case 'periods': return renderPeriodsSection();
      case 'clients': return renderClientsSection();
      case 'google': return <GoogleIntegrationSection />;
      case 'email-system': return <EmailSystemSection />;
      case 'appearance': return renderAppearanceSection();
      case 'notifications': return renderNotificationsSection();
      case 'users': return <UserManagementSection />;
      default: return renderCompaniesSection();
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <SettingsIcon size={28} className="mr-3" />
          Paramètres
        </h1>
        <p className="text-purple-100">
          Configurez votre application selon vos besoins
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <nav className="space-y-2">
              {sections.map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center px-3 py-2 text-left rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'text-white border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    style={activeSection === section.id ? { backgroundColor: settings.accentColor } : {}}
                  >
                    <Icon size={20} className="mr-3" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Company Form Component
const EditCompanyForm: React.FC<{
  company: any;
  onSave: (id: string, name: string, color: string) => void;
  onCancel: () => void;
}> = ({ company, onSave, onCancel }) => {
  const [name, setName] = useState(company.name);
  const [color, setColor] = useState(company.color);

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
        />
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => onSave(company.id, name, color)}
          className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sauvegarder
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default Settings;