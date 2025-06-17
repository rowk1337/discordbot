import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Edit3, AlertCircle, CheckCircle, Mail, User, Calendar, Euro } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { googleAuth } from '../../lib/googleAuth';
import { EmailTemplateEngine } from '../../lib/emailTemplates';
import { Invoice, Client, ReminderTemplate } from '../../types';

interface EmailPreviewModalProps {
  invoice: Invoice;
  client: Client;
  template: ReminderTemplate;
  onClose: () => void;
  onEmailSent?: () => void;
}

interface EmailPreview {
  subject: string;
  content: string;
  htmlContent: string;
}

const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  invoice,
  client,
  template,
  onClose,
  onEmailSent
}) => {
  const { settings, addClientReminder, companies, selectedCompany } = useData();
  const modalRef = useRef<HTMLDivElement>(null);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculer les jours de retard
  const daysOverdue = Math.ceil(
    (new Date().getTime() - new Date(invoice.dateEcheance).getTime()) / (1000 * 60 * 60 * 24)
  );

  useEffect(() => {
    generateEmailPreview();
  }, [invoice, client, template]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const generateEmailPreview = () => {
    try {
      const variables = {
        numeroFacture: invoice.numeroFacture,
        montantTotal: invoice.montantTotal,
        soldeRestant: invoice.soldeRestant,
        dateFacture: invoice.date,
        dateEcheance: invoice.dateEcheance,
        joursRetard: Math.max(0, daysOverdue),
        nomClient: client.name
      };

      // CORRECTION: Récupérer le nom de la société actuelle
      const currentCompany = companies.find(c => c.id === selectedCompany);
      const companyInfo = {
        name: currentCompany?.name || settings.emailPreferences?.templates?.companyInfo?.name || 'Votre Société',
        address: settings.emailPreferences?.templates?.companyInfo?.address || '',
        phone: settings.emailPreferences?.templates?.companyInfo?.phone || '',
        email: settings.emailPreferences?.templates?.companyInfo?.email || '',
        website: settings.emailPreferences?.templates?.companyInfo?.website || ''
      };

      const subject = EmailTemplateEngine.replaceVariables(template.subject, variables, companyInfo);
      const content = EmailTemplateEngine.replaceVariables(template.content, variables, companyInfo);
      const htmlContent = EmailTemplateEngine.generateHtmlContent(content);

      setEmailPreview({ subject, content, htmlContent });
      setEditedSubject(subject);
      setEditedContent(content);
      setError(null);
    } catch (error) {
      console.error('Erreur lors de la génération de l\'aperçu:', error);
      setError('Erreur lors de la génération de l\'aperçu de l\'email');
    }
  };

  const validateEmail = (): string | null => {
    // Vérifier que le client a un email
    if (!client.email) {
      return 'Le client n\'a pas d\'adresse email renseignée. Veuillez ajouter une adresse email dans la fiche client.';
    }

    // Vérifier le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client.email)) {
      return 'L\'adresse email du client n\'est pas valide. Veuillez corriger l\'adresse dans la fiche client.';
    }

    // Vérifier que l'objet n'est pas vide
    if (!editedSubject.trim()) {
      return 'L\'objet de l\'email ne peut pas être vide.';
    }

    // Vérifier que le contenu n'est pas vide
    if (!editedContent.trim()) {
      return 'Le contenu de l\'email ne peut pas être vide.';
    }

    // Vérifier la connexion Google
    if (!settings.googleIntegration?.isConnected) {
      return 'Votre compte Google n\'est pas connecté. Veuillez vous connecter dans les paramètres.';
    }

    return null;
  };

  const handleSendEmail = async () => {
    setError(null);
    setSuccess(null);

    // Validation
    const validationError = validateEmail();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSending(true);

    try {
      // CORRECTION: Générer le contenu HTML avec les sauts de ligne correctement formatés
      const htmlContent = EmailTemplateEngine.generateHtmlContent(editedContent);

      // Envoyer l'email via le service Google Auth avec le contenu HTML
      const messageId = await googleAuth.sendEmail(
        client.email!,
        editedSubject,
        htmlContent, // Utiliser le contenu HTML au lieu du texte brut
        {
          invoiceId: invoice.id,
          clientId: client.id,
          templateId: template.id
        }
      );

      // Enregistrer la relance dans la base de données
      await addClientReminder({
        clientId: client.id,
        invoiceId: invoice.id,
        date: new Date().toISOString().split('T')[0],
        type: 'email',
        description: `Relance automatique envoyée: ${editedSubject} (ID: ${messageId})`
      });

      setSuccess(`Email envoyé avec succès à ${client.email}`);
      
      // Notifier le parent
      if (onEmailSent) {
        onEmailSent();
      }

      // Fermer la modal après 2 secondes
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      
      // Analyser l'erreur pour fournir un message plus spécifique
      let errorMessage = 'Une erreur inattendue s\'est produite lors de l\'envoi de l\'email.';
      
      if (error instanceof Error) {
        if (error.message.includes('unauthorized') || error.message.includes('token')) {
          errorMessage = 'Votre session Google a expiré. Veuillez vous reconnecter dans les paramètres.';
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          errorMessage = 'Limite de quota Gmail atteinte. Veuillez réessayer dans quelques minutes.';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Problème de connexion réseau. Vérifiez votre connexion internet et réessayez.';
        } else if (error.message.includes('invalid email')) {
          errorMessage = 'L\'adresse email du destinataire n\'est pas valide.';
        } else if (error.message.includes('non connecté')) {
          errorMessage = 'Votre compte Google n\'est pas connecté. Veuillez vous connecter dans les paramètres.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedSubject(emailPreview?.subject || '');
    setEditedContent(emailPreview?.content || '');
    setError(null);
  };

  const handleSaveEdit = () => {
    if (!editedSubject.trim() || !editedContent.trim()) {
      setError('L\'objet et le contenu ne peuvent pas être vides.');
      return;
    }
    setIsEditing(false);
    setError(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (!emailPreview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Génération de l'aperçu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Mail size={24} className="mr-2 text-blue-600" />
            Aperçu de la relance
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Messages d'état */}
        {error && (
          <div className="mx-6 mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle size={20} className="text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-800 mb-1">Erreur</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle size={20} className="text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-green-800 mb-1">Succès</h4>
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Informations du destinataire */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User size={20} className="mr-2 text-blue-600" />
              Informations du destinataire
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Client:</span>
                    <span className="font-medium">{client.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className={`font-medium ${client.email ? 'text-green-600' : 'text-red-600'}`}>
                      {client.email || 'Non renseigné'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Téléphone:</span>
                    <span className="font-medium">{client.telephone || 'Non renseigné'}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Facture:</span>
                    <span className="font-medium">{invoice.numeroFacture}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant dû:</span>
                    <span className="font-medium text-red-600">{formatCurrency(invoice.soldeRestant)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Échéance:</span>
                    <span className={`font-medium ${daysOverdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatDate(invoice.dateEcheance)}
                      {daysOverdue > 0 && (
                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                          +{daysOverdue} jour{daysOverdue > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Aperçu de l'email */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Aperçu de l'email</h3>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="flex items-center px-3 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Edit3 size={16} className="mr-2" />
                  Modifier
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Objet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objet de l'email
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Objet de l'email"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <span className="font-medium">{editedSubject}</span>
                  </div>
                )}
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenu de l'email
                </label>
                {isEditing ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contenu de l'email"
                  />
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg border max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                      {editedContent}
                    </pre>
                  </div>
                )}
              </div>

              {/* CORRECTION: Aperçu HTML pour montrer le rendu final */}
              {!isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aperçu du rendu final (HTML)
                  </label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div 
                      className="p-4 bg-white max-h-64 overflow-y-auto"
                      dangerouslySetInnerHTML={{ 
                        __html: EmailTemplateEngine.generateHtmlContent(editedContent) 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Actions d'édition */}
              {isEditing && (
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sauvegarder
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Informations du modèle */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start">
              <Calendar size={20} className="text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-800 mb-1">Modèle utilisé</h4>
                <p className="text-blue-700 text-sm">
                  <strong>{template.name}</strong> - {template.type.replace('_', ' ')} 
                  ({template.daysAfterDue} jours après échéance)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer avec actions */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {client.email ? (
              <span className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-2" />
                Prêt à envoyer
              </span>
            ) : (
              <span className="flex items-center text-red-600">
                <AlertCircle size={16} className="mr-2" />
                Email du client manquant
              </span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSendEmail}
              disabled={isSending || !client.email || isEditing}
              className="flex items-center px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Envoyer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailPreviewModal;