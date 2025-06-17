import React, { useState } from 'react';
import { Mail, Send, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { googleAuth } from '../../lib/googleAuth';
import { Invoice, Client } from '../../types';
import EmailPreviewModal from '../Email/EmailPreviewModal';

interface AutoReminderButtonProps {
  invoice: Invoice;
  client: Client;
}

const AutoReminderButton: React.FC<AutoReminderButtonProps> = ({ invoice, client }) => {
  const { settings, addClientReminder } = useData();
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const googleIntegration = settings.googleIntegration;
  const reminderTemplates = settings.reminderTemplates || [];
  const automationSettings = settings.automationSettings;

  // Calculer le nombre de jours de retard
  const daysOverdue = Math.ceil(
    (new Date().getTime() - new Date(invoice.dateEcheance).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Déterminer le type de relance approprié
  const getReminderType = () => {
    if (daysOverdue <= (automationSettings?.firstReminderDays || 7)) {
      return 'first_reminder';
    } else if (daysOverdue <= (automationSettings?.secondReminderDays || 15)) {
      return 'second_reminder';
    } else {
      return 'final_notice';
    }
  };

  // Trouver le modèle approprié
  const getTemplate = () => {
    const type = getReminderType();
    return reminderTemplates.find(t => t.type === type && t.isActive);
  };

  const handlePreviewEmail = () => {
    const template = getTemplate();
    if (!template) {
      return;
    }
    setShowPreview(true);
  };

  const handleEmailSent = () => {
    setLastSent(new Date().toISOString());
    setShowPreview(false);
  };

  // Vérifier si on peut envoyer une relance
  const canSendReminder = () => {
    return (
      googleIntegration?.isConnected &&
      client.email &&
      automationSettings?.enabled &&
      getTemplate() &&
      invoice.isOverdue &&
      !isSending
    );
  };

  const getButtonText = () => {
    if (isSending) return 'Envoi...';
    if (lastSent) return 'Relance envoyée';
    
    const type = getReminderType();
    switch (type) {
      case 'first_reminder': return 'Première relance';
      case 'second_reminder': return 'Deuxième relance';
      case 'final_notice': return 'Mise en demeure';
      default: return 'Envoyer relance';
    }
  };

  const getButtonColor = () => {
    if (lastSent) return 'bg-green-600 hover:bg-green-700';
    
    const type = getReminderType();
    switch (type) {
      case 'first_reminder': return 'bg-blue-600 hover:bg-blue-700';
      case 'second_reminder': return 'bg-orange-600 hover:bg-orange-700';
      case 'final_notice': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const getIcon = () => {
    if (isSending) return <Clock size={16} className="animate-spin" />;
    if (lastSent) return <CheckCircle size={16} />;
    return <Eye size={16} />;
  };

  if (!googleIntegration?.isConnected) {
    return (
      <div className="flex items-center text-gray-400 text-sm">
        <AlertCircle size={16} className="mr-2" />
        Google non connecté
      </div>
    );
  }

  if (!client.email) {
    return (
      <div className="flex items-center text-gray-400 text-sm">
        <AlertCircle size={16} className="mr-2" />
        Email manquant
      </div>
    );
  }

  if (!automationSettings?.enabled) {
    return (
      <div className="flex items-center text-gray-400 text-sm">
        <AlertCircle size={16} className="mr-2" />
        Automatisation désactivée
      </div>
    );
  }

  const template = getTemplate();
  if (!template) {
    return (
      <div className="flex items-center text-gray-400 text-sm">
        <AlertCircle size={16} className="mr-2" />
        Modèle manquant
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-2">
        <button
          onClick={handlePreviewEmail}
          disabled={!canSendReminder()}
          className={`px-3 py-2 text-white rounded-lg transition-colors flex items-center text-sm ${
            canSendReminder() 
              ? getButtonColor()
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          title={`Prévisualiser l'email à ${client.email}`}
        >
          {getIcon()}
          <span className="ml-2">{getButtonText()}</span>
        </button>
        
        {lastSent && (
          <div className="text-xs text-gray-500">
            Envoyé le {new Date(lastSent).toLocaleDateString('fr-FR')} à {new Date(lastSent).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        
        {canSendReminder() && (
          <div className="text-xs text-gray-600">
            Modèle: {template.name}
          </div>
        )}
      </div>

      {/* Modal de prévisualisation */}
      {showPreview && template && (
        <EmailPreviewModal
          invoice={invoice}
          client={client}
          template={template}
          onClose={() => setShowPreview(false)}
          onEmailSent={handleEmailSent}
        />
      )}
    </>
  );
};

export default AutoReminderButton;