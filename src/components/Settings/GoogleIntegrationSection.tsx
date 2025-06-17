import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Settings, Trash2, Plus, Edit, Calendar, Clock, Users, ExternalLink, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { googleAuth, GoogleAuthState } from '../../lib/googleAuth';
import { ReminderTemplate, AutomationSettings } from '../../types';

const GoogleIntegrationSection: React.FC = () => {
  const { settings, updateSettings, syncGoogleAuth, forceSettingsSync } = useData();
  const [isConnecting, setIsConnecting] = useState(false);
  const [googleState, setGoogleState] = useState<GoogleAuthState>({ isConnected: false });
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reminderTemplates = settings.reminderTemplates || [];
  const automationSettings = settings.automationSettings || {
    enabled: false,
    firstReminderDays: 7,
    secondReminderDays: 15,
    finalNoticeDays: 30,
    ccEmails: [],
    workingDaysOnly: true,
    excludeWeekends: true
  };

  // Charger l'état de connexion Google au montage
  useEffect(() => {
    loadGoogleState();
  }, []);

  // Synchroniser avec les paramètres globaux
  useEffect(() => {
    if (settings.googleIntegration) {
      setGoogleState(settings.googleIntegration);
    }
  }, [settings.googleIntegration]);

  const loadGoogleState = async () => {
    try {
      const profile = await googleAuth.getProfile();
      if (profile) {
        setGoogleState(profile);
        // Synchroniser avec le contexte global
        await syncGoogleAuth();
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'état Google:', error);
      setGoogleState({ isConnected: false });
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    setConnectionError(null);
    
    try {
      console.log('🔄 Actualisation du statut Google...');
      
      // Forcer la synchronisation complète
      await forceSettingsSync();
      
      // Forcer la synchronisation Google
      const profile = await googleAuth.forceSync();
      if (profile) {
        setGoogleState(profile);
        await syncGoogleAuth();
        console.log('✅ Statut Google actualisé:', profile);
      } else {
        setGoogleState({ isConnected: false });
        console.log('❌ Google non connecté');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      setConnectionError('Erreur lors de la vérification du statut de connexion');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      await googleAuth.initiateLogin();
      // La redirection vers Google se fait automatiquement
    } catch (error) {
      console.error('Erreur lors de la connexion Google:', error);
      
      // Analyser le type d'erreur pour fournir un message plus spécifique
      let errorMessage = 'Une erreur inattendue s\'est produite lors de la connexion à Google.';
      
      if (error instanceof Error) {
        if (error.message.includes('Configuration Google OAuth manquante') || 
            error.message.includes('génération de l\'URL d\'autorisation')) {
          errorMessage = 'La configuration Google OAuth n\'est pas complète. Veuillez vérifier que les variables d\'environnement GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI sont correctement configurées dans votre projet Supabase.';
        } else if (error.message.includes('Utilisateur non authentifié')) {
          errorMessage = 'Vous devez être connecté pour utiliser l\'intégration Google.';
        } else if (error.message.includes('réseau') || error.message.includes('network')) {
          errorMessage = 'Erreur de connexion réseau. Veuillez vérifier votre connexion internet et réessayer.';
        }
      }
      
      setConnectionError(errorMessage);
      setIsConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await googleAuth.disconnect();
      setGoogleState({ isConnected: false });
      setConnectionError(null);
      
      // Mettre à jour les paramètres locaux
      await updateSettings({
        googleIntegration: { isConnected: false }
      });
      
      // Synchroniser avec le contexte global
      await syncGoogleAuth();
    } catch (error) {
      console.error('Erreur lors de la déconnexion Google:', error);
      setConnectionError('Erreur lors de la déconnexion. Veuillez réessayer.');
    }
  };

  const handleSaveTemplate = async (template: Omit<ReminderTemplate, 'id'>) => {
    const newTemplate: ReminderTemplate = {
      ...template,
      id: editingTemplate?.id || `template-${Date.now()}`
    };

    const updatedTemplates = editingTemplate
      ? reminderTemplates.map(t => t.id === editingTemplate.id ? newTemplate : t)
      : [...reminderTemplates, newTemplate];

    await updateSettings({
      reminderTemplates: updatedTemplates
    });

    setShowTemplateModal(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const updatedTemplates = reminderTemplates.filter(t => t.id !== templateId);
    await updateSettings({
      reminderTemplates: updatedTemplates
    });
  };

  const handleUpdateAutomation = async (newSettings: Partial<AutomationSettings>) => {
    await updateSettings({
      automationSettings: { ...automationSettings, ...newSettings }
    });
  };

  const createDefaultTemplates = async () => {
    const defaultTemplates: ReminderTemplate[] = [
      {
        id: 'template-1',
        name: 'Première relance',
        subject: 'Rappel - Facture {{numeroFacture}} échue',
        content: `Bonjour,

Nous vous informons que la facture {{numeroFacture}} d'un montant de {{montantTotal}} datée du {{dateFacture}} est arrivée à échéance le {{dateEcheance}}.

Le solde restant à régler est de {{soldeRestant}}.

Nous vous remercions de bien vouloir procéder au règlement dans les plus brefs délais.

Cordialement,
{{nomSociete}}`,
        type: 'first_reminder',
        daysAfterDue: 7,
        isActive: true
      },
      {
        id: 'template-2',
        name: 'Deuxième relance',
        subject: 'URGENT - Facture {{numeroFacture}} en retard',
        content: `Bonjour,

Malgré notre précédent courrier, nous constatons que la facture {{numeroFacture}} d'un montant de {{montantTotal}} n'a toujours pas été réglée.

Cette facture est maintenant en retard de {{joursRetard}} jours.

Le solde restant à régler est de {{soldeRestant}}.

Nous vous demandons de régulariser cette situation rapidement pour éviter toute procédure de recouvrement.

Cordialement,
{{nomSociete}}`,
        type: 'second_reminder',
        daysAfterDue: 15,
        isActive: true
      },
      {
        id: 'template-3',
        name: 'Mise en demeure',
        subject: 'MISE EN DEMEURE - Facture {{numeroFacture}}',
        content: `Madame, Monsieur,

Par la présente, nous vous mettons en demeure de procéder au règlement de la facture {{numeroFacture}} d'un montant de {{montantTotal}}, échue depuis le {{dateEcheance}}.

Cette facture est maintenant en retard de {{joursRetard}} jours.

Le solde restant à régler est de {{soldeRestant}}.

À défaut de règlement sous 8 jours, nous nous verrons contraints d'engager une procédure de recouvrement contentieux.

Cordialement,
{{nomSociete}}`,
        type: 'final_notice',
        daysAfterDue: 30,
        isActive: true
      }
    ];

    await updateSettings({
      reminderTemplates: defaultTemplates
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Intégration Google</h3>
        <p className="text-gray-600">
          Connectez votre compte Google pour automatiser l'envoi de relances par email.
        </p>
      </div>

      {/* Configuration Google Cloud Console */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start">
          <AlertCircle size={20} className="text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h5 className="font-medium text-blue-800 mb-2">Configuration requise</h5>
            <div className="text-sm text-blue-700 space-y-2">
              <p>Pour utiliser l'intégration Google, vous devez configurer les variables d'environnement suivantes dans votre projet Supabase :</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code className="bg-blue-100 px-1 rounded">GOOGLE_CLIENT_ID</code> - ID client OAuth 2.0</li>
                <li><code className="bg-blue-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> - Secret client OAuth 2.0</li>
                <li><code className="bg-blue-100 px-1 rounded">GOOGLE_REDIRECT_URI</code> - URI de redirection autorisée</li>
              </ul>
              <div className="mt-3 space-y-2">
                <p className="font-medium">Instructions de configuration :</p>
                <ol className="list-decimal list-inside space-y-1 ml-4 text-xs">
                  <li>Allez dans votre <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Google Cloud Console</a></li>
                  <li>Créez des identifiants OAuth 2.0 si ce n'est pas déjà fait</li>
                  <li>Dans votre projet Supabase, allez dans "Edge Functions" → "Environment Variables"</li>
                  <li>Ajoutez les trois variables avec leurs valeurs respectives</li>
                  <li>Redéployez vos Edge Functions si nécessaire</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Erreur de connexion */}
      {connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start">
            <AlertCircle size={20} className="text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-medium text-red-800 mb-2">Erreur de connexion</h5>
              <p className="text-sm text-red-700">{connectionError}</p>
              <button
                onClick={() => setConnectionError(null)}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Masquer ce message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statut de connexion Google */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
              googleState.isConnected ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {googleState.isConnected ? (
                <CheckCircle size={24} className="text-green-600" />
              ) : (
                <Mail size={24} className="text-gray-400" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">
                {googleState.isConnected ? 'Compte Google connecté' : 'Compte Google non connecté'}
              </h4>
              <p className="text-sm text-gray-500">
                {googleState.isConnected 
                  ? `Connecté avec ${googleState.email}`
                  : 'Connectez votre compte Gmail pour envoyer des relances automatiques'
                }
              </p>
              {googleState.isConnected && googleState.connectedAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Connecté le {new Date(googleState.connectedAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
              className="px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center"
              title="Actualiser le statut"
            >
              <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Vérification...' : 'Actualiser'}
            </button>
            
            {googleState.isConnected ? (
              <button
                onClick={handleGoogleDisconnect}
                className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Déconnecter
              </button>
            ) : (
              <button
                onClick={handleGoogleConnect}
                disabled={isConnecting}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isConnecting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Mail size={16} className="mr-2" />
                )}
                {isConnecting ? 'Connexion...' : 'Connecter Google'}
              </button>
            )}
          </div>
        </div>

        {googleState.isConnected && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start">
              <CheckCircle size={20} className="text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-medium text-green-800 mb-1">Fonctionnalités activées</h5>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Envoi automatique de relances par email</li>
                  <li>• Personnalisation des modèles de relance</li>
                  <li>• Programmation des envois selon un calendrier</li>
                  <li>• Suivi des statistiques d'ouverture et de réponse</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Paramètres d'automatisation */}
      {googleState.isConnected && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
              <Settings size={20} className="mr-2" />
              Automatisation des relances
            </h4>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Activé</span>
              <div 
                className={`w-10 h-6 rounded-full shadow-inner transition-colors cursor-pointer ${
                  automationSettings.enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
                onClick={() => handleUpdateAutomation({ enabled: !automationSettings.enabled })}
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform cursor-pointer ${
                    automationSettings.enabled ? 'translate-x-5' : 'translate-x-1'
                  } mt-1`}
                />
              </div>
            </div>
          </div>

          {automationSettings.enabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Première relance (jours après échéance)
                  </label>
                  <input
                    type="number"
                    value={automationSettings.firstReminderDays}
                    onChange={(e) => handleUpdateAutomation({ firstReminderDays: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deuxième relance (jours après échéance)
                  </label>
                  <input
                    type="number"
                    value={automationSettings.secondReminderDays}
                    onChange={(e) => handleUpdateAutomation({ secondReminderDays: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mise en demeure (jours après échéance)
                  </label>
                  <input
                    type="number"
                    value={automationSettings.finalNoticeDays}
                    onChange={(e) => handleUpdateAutomation({ finalNoticeDays: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={automationSettings.workingDaysOnly}
                    onChange={(e) => handleUpdateAutomation({ workingDaysOnly: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Jours ouvrés uniquement</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={automationSettings.excludeWeekends}
                    onChange={(e) => handleUpdateAutomation({ excludeWeekends: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Exclure les week-ends</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modèles de relance */}
      {googleState.isConnected && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Modèles de relance</h4>
            <div className="flex space-x-2">
              {reminderTemplates.length === 0 && (
                <button
                  onClick={createDefaultTemplates}
                  className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Créer modèles par défaut
                </button>
              )}
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateModal(true);
                }}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus size={16} className="mr-2" />
                Nouveau modèle
              </button>
            </div>
          </div>

          {reminderTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail size={48} className="mx-auto mb-3 text-gray-300" />
              <p>Aucun modèle de relance configuré</p>
              <p className="text-sm mt-1">Créez des modèles pour automatiser vos relances</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminderTemplates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h5 className="font-medium text-gray-900">{template.name}</h5>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {template.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Envoyé {template.daysAfterDue} jours après l'échéance
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowTemplateModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions d'utilisation */}
      {googleState.isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start">
            <AlertCircle size={20} className="text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Variables disponibles dans les modèles</h5>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                <div>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{numeroFacture}}"}</code> - Numéro de facture</p>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{montantTotal}}"}</code> - Montant total</p>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{soldeRestant}}"}</code> - Solde restant</p>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{dateFacture}}"}</code> - Date de facture</p>
                </div>
                <div>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{dateEcheance}}"}</code> - Date d'échéance</p>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{joursRetard}}"}</code> - Jours de retard</p>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{nomClient}}"}</code> - Nom du client</p>
                  <p><code className="bg-blue-100 px-1 rounded">{"{{nomSociete}}"}</code> - Nom de la société</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modèle */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
};

// Modal pour créer/modifier un modèle
const TemplateModal: React.FC<{
  template: ReminderTemplate | null;
  onSave: (template: Omit<ReminderTemplate, 'id'>) => void;
  onClose: () => void;
}> = ({ template, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    content: template?.content || '',
    type: template?.type || 'first_reminder' as const,
    daysAfterDue: template?.daysAfterDue || 7,
    isActive: template?.isActive ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {template ? 'Modifier le modèle' : 'Nouveau modèle de relance'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du modèle
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de relance
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="first_reminder">Première relance</option>
                <option value="second_reminder">Deuxième relance</option>
                <option value="final_notice">Mise en demeure</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jours après échéance
              </label>
              <input
                type="number"
                value={formData.daysAfterDue}
                onChange={(e) => setFormData(prev => ({ ...prev, daysAfterDue: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                required
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Modèle actif</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Objet de l'email
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Rappel - Facture {{numeroFacture}} échue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contenu de l'email
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Utilisez les variables comme {{numeroFacture}}, {{montantTotal}}, etc."
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {template ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoogleIntegrationSection;