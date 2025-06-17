import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  Clock, 
  Bell, 
  Palette, 
  Save,
  TestTube,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { EmailTemplateEngine, TEMPLATE_VARIABLES } from '../../lib/emailTemplates';

interface UserEmailPreferences {
  defaultSender: {
    name: string;
    email: string;
    signature: string;
  };
  automation: {
    enabled: boolean;
    workingHoursOnly: boolean;
    workingHours: {
      start: string;
      end: string;
    };
    excludeWeekends: boolean;
    maxDailyEmails: number;
    retrySettings: {
      maxRetries: number;
      retryDelays: number[]; // en minutes
    };
  };
  notifications: {
    emailSent: boolean;
    emailFailed: boolean;
    queueFull: boolean;
    dailyReport: boolean;
  };
  templates: {
    useHtml: boolean;
    defaultFont: string;
    defaultFontSize: number;
    brandColors: {
      primary: string;
      secondary: string;
    };
    companyInfo: {
      name: string;
      address: string;
      phone: string;
      email: string;
      website: string;
    };
  };
}

const UserPreferences: React.FC = () => {
  const { settings, updateSettings } = useData();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserEmailPreferences>({
    defaultSender: {
      name: user?.user_metadata?.full_name || '',
      email: user?.email || '',
      signature: ''
    },
    automation: {
      enabled: true,
      workingHoursOnly: true,
      workingHours: {
        start: '09:00',
        end: '18:00'
      },
      excludeWeekends: true,
      maxDailyEmails: 50,
      retrySettings: {
        maxRetries: 3,
        retryDelays: [1, 5, 15] // 1min, 5min, 15min
      }
    },
    notifications: {
      emailSent: true,
      emailFailed: true,
      queueFull: true,
      dailyReport: false
    },
    templates: {
      useHtml: true,
      defaultFont: 'Arial, sans-serif',
      defaultFontSize: 14,
      brandColors: {
        primary: '#3B82F6',
        secondary: '#6B7280'
      },
      companyInfo: {
        name: '',
        address: '',
        phone: '',
        email: '',
        website: ''
      }
    }
  });

  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  useEffect(() => {
    // Charger les préférences depuis les paramètres utilisateur
    if (settings.emailPreferences) {
      setPreferences(prev => ({ ...prev, ...settings.emailPreferences }));
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        emailPreferences: preferences
      });
      setTestResult({ success: true, message: 'Préférences sauvegardées avec succès' });
    } catch (error) {
      setTestResult({ success: false, message: 'Erreur lors de la sauvegarde' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    
    setIsTestingEmail(true);
    try {
      // Créer un email de test
      const testContent = EmailTemplateEngine.replaceVariables(
        `Bonjour,

Ceci est un email de test envoyé depuis votre système de gestion.

Informations de test :
- Facture : {{numeroFacture}}
- Montant : {{montantTotal}}
- Client : {{nomClient}}
- Société : {{nomSociete}}

Cordialement,
{{nomSociete}}`,
        {
          numeroFacture: 'TEST-001',
          montantTotal: 1500,
          nomClient: 'Client Test',
        },
        preferences.templates.companyInfo
      );

      // Simuler l'envoi (remplacer par l'appel réel à l'API)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestResult({ 
        success: true, 
        message: `Email de test envoyé avec succès à ${testEmail}` 
      });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: 'Erreur lors de l\'envoi de l\'email de test' 
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const updatePreference = (path: string, value: any) => {
    setPreferences(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Préférences email</h3>
        <p className="text-gray-600">
          Configurez vos préférences pour l'envoi d'emails et les notifications.
        </p>
      </div>

      {/* Message de résultat */}
      {testResult && (
        <div className={`rounded-lg p-4 border ${
          testResult.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {testResult.success ? (
              <CheckCircle size={20} className="mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="mr-3 flex-shrink-0" />
            )}
            <p>{testResult.message}</p>
          </div>
        </div>
      )}

      {/* Expéditeur par défaut */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Mail size={20} className="mr-2" />
          Expéditeur par défaut
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom d'affichage
            </label>
            <input
              type="text"
              value={preferences.defaultSender.name}
              onChange={(e) => updatePreference('defaultSender.name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Votre nom"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={preferences.defaultSender.email}
              onChange={(e) => updatePreference('defaultSender.email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="votre@email.com"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Signature
          </label>
          <textarea
            value={preferences.defaultSender.signature}
            onChange={(e) => updatePreference('defaultSender.signature', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Votre signature email..."
          />
        </div>
      </div>

      {/* Automatisation */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Clock size={20} className="mr-2" />
          Automatisation
        </h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Envoi automatique activé</label>
              <p className="text-sm text-gray-600">Activer l'envoi automatique des relances</p>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={preferences.automation.enabled}
                onChange={(e) => updatePreference('automation.enabled', e.target.checked)}
                className="sr-only"
              />
              <div 
                className={`w-10 h-6 rounded-full shadow-inner transition-colors cursor-pointer ${
                  preferences.automation.enabled ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                onClick={() => updatePreference('automation.enabled', !preferences.automation.enabled)}
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform cursor-pointer ${
                    preferences.automation.enabled ? 'translate-x-5' : 'translate-x-1'
                  } mt-1`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure de début
              </label>
              <input
                type="time"
                value={preferences.automation.workingHours.start}
                onChange={(e) => updatePreference('automation.workingHours.start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure de fin
              </label>
              <input
                type="time"
                value={preferences.automation.workingHours.end}
                onChange={(e) => updatePreference('automation.workingHours.end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.automation.workingHoursOnly}
                onChange={(e) => updatePreference('automation.workingHoursOnly', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Heures ouvrées uniquement</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.automation.excludeWeekends}
                onChange={(e) => updatePreference('automation.excludeWeekends', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Exclure les week-ends</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limite d'emails par jour
            </label>
            <input
              type="number"
              value={preferences.automation.maxDailyEmails}
              onChange={(e) => updatePreference('automation.maxDailyEmails', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="1000"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Bell size={20} className="mr-2" />
          Notifications
        </h4>
        
        <div className="space-y-4">
          {[
            { key: 'emailSent', label: 'Email envoyé avec succès', description: 'Notification lors de l\'envoi réussi d\'un email' },
            { key: 'emailFailed', label: 'Échec d\'envoi d\'email', description: 'Notification en cas d\'échec d\'envoi' },
            { key: 'queueFull', label: 'File d\'attente pleine', description: 'Alerte quand la file d\'attente atteint sa limite' },
            { key: 'dailyReport', label: 'Rapport quotidien', description: 'Résumé quotidien des envois d\'emails' }
          ].map((notification) => (
            <div key={notification.key} className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900">{notification.label}</label>
                <p className="text-sm text-gray-600">{notification.description}</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications[notification.key as keyof typeof preferences.notifications]}
                onChange={(e) => updatePreference(`notifications.${notification.key}`, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Informations de l'entreprise */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
          <Palette size={20} className="mr-2" />
          Informations de l'entreprise
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de l'entreprise
            </label>
            <input
              type="text"
              value={preferences.templates.companyInfo.name}
              onChange={(e) => updatePreference('templates.companyInfo.name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom de votre entreprise"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email de l'entreprise
            </label>
            <input
              type="email"
              value={preferences.templates.companyInfo.email}
              onChange={(e) => updatePreference('templates.companyInfo.email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="contact@entreprise.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone
            </label>
            <input
              type="tel"
              value={preferences.templates.companyInfo.phone}
              onChange={(e) => updatePreference('templates.companyInfo.phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="01 23 45 67 89"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site web
            </label>
            <input
              type="url"
              value={preferences.templates.companyInfo.website}
              onChange={(e) => updatePreference('templates.companyInfo.website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.entreprise.com"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adresse complète
          </label>
          <textarea
            value={preferences.templates.companyInfo.address}
            onChange={(e) => updatePreference('templates.companyInfo.address', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123 Rue de la Paix, 75001 Paris, France"
          />
        </div>
      </div>

      {/* Test d'email */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
          <TestTube size={20} className="mr-2" />
          Test d'email
        </h4>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Adresse email pour le test"
            />
          </div>
          <button
            onClick={handleTestEmail}
            disabled={!testEmail || isTestingEmail}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isTestingEmail ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <TestTube size={16} className="mr-2" />
            )}
            {isTestingEmail ? 'Envoi...' : 'Tester'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Envoyez un email de test pour vérifier votre configuration.
        </p>
      </div>

      {/* Variables disponibles */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-4">Variables disponibles dans les modèles</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TEMPLATE_VARIABLES.map((variable) => (
            <div key={variable.key} className="text-sm">
              <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">
                {`{{${variable.key}}}`}
              </code>
              <p className="text-blue-700 mt-1">{variable.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
};

export default UserPreferences;