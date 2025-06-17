import React, { useState } from 'react';
import { AlertTriangle, Calendar, Phone, Mail, FileText, MessageSquare, Plus, Eye, User, Send } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import ReminderModal from '../Clients/ReminderModal';
import ClientDetailModal from '../Clients/ClientDetailModal';
import ClientModal from '../Clients/ClientModal';
import AutoReminderButton from './AutoReminderButton';
import EmailPreviewModal from '../Email/EmailPreviewModal';

const RemindersTab: React.FC = () => {
  const { getOverdueInvoices, clients, getClientByCompteTiers, getClientReminders, settings } = useData();
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [showClientEdit, setShowClientEdit] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [previewClient, setPreviewClient] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const overdueInvoices = getOverdueInvoices();
  const googleIntegration = settings.googleIntegration;
  const reminderTemplates = settings.reminderTemplates || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getDaysOverdue = (dateEcheance: string) => {
    const today = new Date();
    const echeance = new Date(dateEcheance);
    const diffTime = today.getTime() - echeance.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleClientClick = (compteTiers: string) => {
    const client = getClientByCompteTiers(compteTiers);
    if (client) {
      setSelectedClient(client);
      setShowClientDetail(true);
    }
  };

  const handleAddReminder = (invoice: any) => {
    const client = getClientByCompteTiers(invoice.compteTiers);
    if (client) {
      setSelectedClient(client);
      setSelectedInvoice(invoice);
      setShowReminderModal(true);
    }
  };

  const handlePreviewEmail = (invoice: any) => {
    const client = getClientByCompteTiers(invoice.compteTiers);
    if (!client || !client.email) {
      return;
    }

    // Déterminer le type de relance approprié
    const daysOverdue = getDaysOverdue(invoice.dateEcheance);
    let reminderType = 'first_reminder';
    
    if (daysOverdue > 15) {
      reminderType = 'final_notice';
    } else if (daysOverdue > 7) {
      reminderType = 'second_reminder';
    }

    // Trouver le modèle approprié
    const template = reminderTemplates.find(t => t.type === reminderType && t.isActive);
    if (!template) {
      return;
    }

    setPreviewInvoice(invoice);
    setPreviewClient(client);
    setPreviewTemplate(template);
    setShowEmailPreview(true);
  };

  const getReminderTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail size={16} className="text-blue-500" />;
      case 'telephone': return <Phone size={16} className="text-green-500" />;
      case 'courrier': return <FileText size={16} className="text-purple-500" />;
      default: return <MessageSquare size={16} className="text-gray-500" />;
    }
  };

  const getLastReminder = (compteTiers: string) => {
    const client = getClientByCompteTiers(compteTiers);
    if (!client) return null;
    
    const reminders = getClientReminders(client.id);
    if (reminders.length === 0) return null;
    
    return reminders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
          <h1 className="text-2xl font-bold mb-2 flex items-center">
            <AlertTriangle size={28} className="mr-3" />
            Relances et Factures en Retard
          </h1>
          <p className="text-red-100">
            Gestion des factures échues et suivi des relances clients
          </p>
          {googleIntegration?.isConnected && (
            <div className="mt-3 flex items-center text-red-100">
              <Send size={16} className="mr-2" />
              Relances automatiques activées via Google
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Factures en retard</p>
                <p className="text-3xl font-bold text-red-600">{overdueInvoices.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500">
                <AlertTriangle size={24} className="text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Montant en retard</p>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(overdueInvoices.reduce((sum, inv) => sum + inv.soldeRestant, 0))}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500">
                <FileText size={24} className="text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Clients concernés</p>
                <p className="text-3xl font-bold text-red-600">
                  {new Set(overdueInvoices.map(inv => inv.compteTiers)).size}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500">
                <User size={24} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Google Integration Status */}
        {!googleIntegration?.isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start">
              <Mail size={20} className="text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-medium text-blue-800 mb-2">Automatisez vos relances avec Google</h5>
                <p className="text-blue-700 text-sm mb-3">
                  Connectez votre compte Google dans les paramètres pour envoyer automatiquement des relances par email.
                </p>
                <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                  Configurer l'intégration Google →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overdue Invoices Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Factures à relancer</h3>
          </div>
          
          {overdueInvoices.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle size={48} className="mx-auto mb-3 text-gray-300" />
              <div className="text-gray-500 text-lg">Aucune facture en retard</div>
              <p className="text-gray-400 mt-2">Toutes les factures sont à jour !</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Facture
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Échéance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Retard
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Solde dû
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dernière relance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overdueInvoices
                    .sort((a, b) => getDaysOverdue(b.dateEcheance) - getDaysOverdue(a.dateEcheance))
                    .map((invoice) => {
                      const client = getClientByCompteTiers(invoice.compteTiers);
                      const lastReminder = getLastReminder(invoice.compteTiers);
                      const daysOverdue = getDaysOverdue(invoice.dateEcheance);
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <button
                                onClick={() => handleClientClick(invoice.compteTiers)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {invoice.clientName}
                              </button>
                              <div className="text-sm text-gray-500">{invoice.compteTiers}</div>
                              <div className="text-xs text-gray-400">
                                Type: {invoice.clientType}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{invoice.numeroFacture}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(invoice.date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              {formatDate(invoice.dateEcheance)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              daysOverdue > 30 ? 'bg-red-100 text-red-800' :
                              daysOverdue > 15 ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {daysOverdue} jour{daysOverdue > 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              {formatCurrency(invoice.soldeRestant)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lastReminder ? (
                              <div className="flex items-center space-x-2">
                                {getReminderTypeIcon(lastReminder.type)}
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatDate(lastReminder.date)}
                                  </div>
                                  <div className="text-xs text-gray-500 capitalize">
                                    {lastReminder.type}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Aucune</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {client?.email && (
                                <div className="flex items-center text-gray-600 mb-1">
                                  <Mail size={14} className="mr-1" />
                                  <span className="text-xs">{client.email}</span>
                                </div>
                              )}
                              {client?.telephone && (
                                <div className="flex items-center text-gray-600">
                                  <Phone size={14} className="mr-1" />
                                  <span className="text-xs">{client.telephone}</span>
                                </div>
                              )}
                              {!client?.email && !client?.telephone && (
                                <span className="text-xs text-gray-400">Non renseigné</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-2">
                              {/* Bouton de relance automatique */}
                              {client && (
                                <AutoReminderButton invoice={invoice} client={client} />
                              )}
                              
                              {/* Actions manuelles */}
                              <div className="flex items-center space-x-2">
                                {client?.email && googleIntegration?.isConnected && (
                                  <button
                                    onClick={() => handlePreviewEmail(invoice)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                    title="Prévisualiser l'email de relance"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleAddReminder(invoice)}
                                  className="text-purple-600 hover:text-purple-800 transition-colors"
                                  title="Ajouter une relance manuelle"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={() => handleClientClick(invoice.compteTiers)}
                                  className="text-green-600 hover:text-green-800 transition-colors"
                                  title="Voir détails client"
                                >
                                  <User size={16} />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showClientDetail && selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => {
            setShowClientDetail(false);
            setSelectedClient(null);
          }}
          onEdit={() => {
            setShowClientDetail(false);
            setShowClientEdit(true);
          }}
        />
      )}

      {showClientEdit && selectedClient && (
        <ClientModal
          client={selectedClient}
          onClose={() => {
            setShowClientEdit(false);
            setSelectedClient(null);
          }}
        />
      )}

      {showReminderModal && selectedClient && (
        <ReminderModal
          client={selectedClient}
          invoiceId={selectedInvoice?.id}
          onClose={() => {
            setShowReminderModal(false);
            setSelectedClient(null);
            setSelectedInvoice(null);
          }}
        />
      )}

      {/* Modal de prévisualisation d'email */}
      {showEmailPreview && previewInvoice && previewClient && previewTemplate && (
        <EmailPreviewModal
          invoice={previewInvoice}
          client={previewClient}
          template={previewTemplate}
          onClose={() => {
            setShowEmailPreview(false);
            setPreviewInvoice(null);
            setPreviewClient(null);
            setPreviewTemplate(null);
          }}
          onEmailSent={() => {
            setShowEmailPreview(false);
            setPreviewInvoice(null);
            setPreviewClient(null);
            setPreviewTemplate(null);
          }}
        />
      )}
    </>
  );
};

export default RemindersTab;