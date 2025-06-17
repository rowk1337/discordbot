import React, { useState } from 'react';
import { Mail, Settings, Users, BarChart3, FileText } from 'lucide-react';
import EmailQueueManager from '../Email/EmailQueueManager';
import UserPreferences from '../Email/UserPreferences';
import { EmailTemplateEngine, DEFAULT_TEMPLATES } from '../../lib/emailTemplates';
import { useData } from '../../contexts/DataContext';

const EmailSystemSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'preferences' | 'templates' | 'analytics'>('queue');
  const { settings, updateSettings } = useData();

  const tabs = [
    { id: 'queue', label: 'File d\'attente', icon: Mail },
    { id: 'preferences', label: 'Préférences', icon: Settings },
    { id: 'templates', label: 'Modèles', icon: FileText },
    { id: 'analytics', label: 'Statistiques', icon: BarChart3 }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'queue':
        return <EmailQueueManager />;
      case 'preferences':
        return <UserPreferences />;
      case 'templates':
        return <TemplateManager />;
      case 'analytics':
        return <EmailAnalytics />;
      default:
        return <EmailQueueManager />;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Système d'envoi d'emails</h3>
        <p className="text-gray-600">
          Gérez votre système d'envoi d'emails robuste avec file d'attente, gestion d'erreurs et personnalisation.
        </p>
      </div>

      {/* Navigation par onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} className="mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu */}
      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
};

// Gestionnaire de modèles
const TemplateManager: React.FC = () => {
  const { settings, updateSettings } = useData();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const templates = settings.reminderTemplates || [];

  const createDefaultTemplates = async () => {
    await updateSettings({
      reminderTemplates: DEFAULT_TEMPLATES.map((template, index) => ({
        ...template,
        id: `default-${index + 1}`
      }))
    });
  };

  const previewTemplate = (template: any) => {
    const preview = EmailTemplateEngine.previewTemplate(
      template,
      settings.emailPreferences?.templates?.companyInfo
    );
    setSelectedTemplate({ ...template, preview });
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Gestionnaire de modèles</h4>
        {templates.length === 0 && (
          <button
            onClick={createDefaultTemplates}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Créer modèles par défaut
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <FileText size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Aucun modèle configuré</p>
          <p className="text-sm text-gray-400 mt-1">Créez des modèles pour automatiser vos emails</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template: any) => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-gray-900">{template.name}</h5>
                  <p className="text-sm text-gray-600">{template.subject}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {template.daysAfterDue} jours après échéance
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => previewTemplate(template)}
                    className="px-3 py-1 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Aperçu
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal d'aperçu */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Aperçu - {selectedTemplate.name}
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Objet</label>
                <div className="p-3 bg-gray-50 rounded border">
                  {selectedTemplate.preview?.subject}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenu</label>
                <div className="p-4 bg-gray-50 rounded border max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {selectedTemplate.preview?.content}
                </div>
              </div>
            </div>
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Analytiques des emails
const EmailAnalytics: React.FC = () => {
  const mockStats = {
    totalSent: 1247,
    successRate: 94.2,
    failureRate: 5.8,
    avgResponseTime: '2.3s',
    topErrors: [
      { type: 'Quota dépassé', count: 23 },
      { type: 'Email invalide', count: 18 },
      { type: 'Erreur réseau', count: 12 }
    ],
    dailyStats: [
      { date: '2024-01-01', sent: 45, failed: 3 },
      { date: '2024-01-02', sent: 52, failed: 2 },
      { date: '2024-01-03', sent: 38, failed: 5 },
      { date: '2024-01-04', sent: 61, failed: 1 },
      { date: '2024-01-05', sent: 43, failed: 4 }
    ]
  };

  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-gray-900">Statistiques d'envoi</h4>

      {/* Métriques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{mockStats.totalSent}</div>
          <div className="text-sm text-gray-600">Emails envoyés</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{mockStats.successRate}%</div>
          <div className="text-sm text-gray-600">Taux de succès</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{mockStats.failureRate}%</div>
          <div className="text-sm text-gray-600">Taux d'échec</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{mockStats.avgResponseTime}</div>
          <div className="text-sm text-gray-600">Temps moyen</div>
        </div>
      </div>

      {/* Erreurs principales */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h5 className="font-medium text-gray-900 mb-4">Erreurs principales</h5>
        <div className="space-y-3">
          {mockStats.topErrors.map((error, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-gray-700">{error.type}</span>
              <span className="text-gray-900 font-medium">{error.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graphique des envois quotidiens */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h5 className="font-medium text-gray-900 mb-4">Envois quotidiens (5 derniers jours)</h5>
        <div className="space-y-2">
          {mockStats.dailyStats.map((day, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {new Date(day.date).toLocaleDateString('fr-FR')}
              </span>
              <div className="flex items-center space-x-4">
                <span className="text-green-600">{day.sent} envoyés</span>
                <span className="text-red-600">{day.failed} échecs</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmailSystemSection;