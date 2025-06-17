import React, { useState, useRef, useEffect } from 'react';
import { X, User, Mail, Phone, MessageSquare, FileText, CreditCard, Calendar, Plus, Edit } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Client } from '../../types';
import ReminderModal from './ReminderModal';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
}

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, onClose, onEdit }) => {
  const { getClientInvoices, getClientReminders } = useData();
  const modalRef = useRef<HTMLDivElement>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  
  const clientInvoices = getClientInvoices(client.id);
  const clientReminders = getClientReminders(client.id);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'regle': return 'text-green-600 bg-green-100';
      case 'partiel': return 'text-orange-600 bg-orange-100';
      case 'non_regle': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'regle': return 'Réglée';
      case 'partiel': return 'Partielle';
      case 'non_regle': return 'Non réglée';
      default: return status;
    }
  };

  const getReminderTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail size={16} className="text-blue-500" />;
      case 'telephone': return <Phone size={16} className="text-green-500" />;
      case 'courrier': return <FileText size={16} className="text-purple-500" />;
      default: return <MessageSquare size={16} className="text-gray-500" />;
    }
  };

  const totalMontant = clientInvoices.reduce((sum, inv) => sum + inv.montantTotal, 0);
  const totalRegle = clientInvoices.reduce((sum, inv) => sum + inv.montantRegle, 0);
  const totalSolde = clientInvoices.reduce((sum, inv) => sum + inv.soldeRestant, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div ref={modalRef} className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <User size={24} className="mr-2 text-blue-600" />
              Détails du client - {client.name}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={onEdit}
                className="px-3 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center"
              >
                <Edit size={16} className="mr-2" />
                Modifier
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Client Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User size={20} className="mr-2 text-blue-600" />
                  Informations client
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nom:</span>
                    <span className="font-medium">{client.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">N° Compte Tiers:</span>
                    <span className="font-medium">{client.compteTiers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {client.type}
                    </span>
                  </div>
                  {client.email && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 flex items-center">
                        <Mail size={16} className="mr-1" />
                        Email:
                      </span>
                      <span className="font-medium">{client.email}</span>
                    </div>
                  )}
                  {client.telephone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 flex items-center">
                        <Phone size={16} className="mr-1" />
                        Téléphone:
                      </span>
                      <span className="font-medium">{client.telephone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard size={20} className="mr-2 text-green-600" />
                  Résumé financier
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Factures totales:</span>
                    <span className="font-medium">{clientInvoices.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant total:</span>
                    <span className="font-medium">{formatCurrency(totalMontant)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant réglé:</span>
                    <span className="font-medium text-green-600">{formatCurrency(totalRegle)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-900 font-semibold">Solde restant:</span>
                    <span className={`font-semibold ${totalSolde > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(totalSolde)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments */}
            {client.commentaires && (
              <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <MessageSquare size={20} className="mr-2 text-yellow-600" />
                  Commentaires
                </h3>
                <p className="text-gray-700">{client.commentaires}</p>
              </div>
            )}

            {/* Reminders */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar size={20} className="mr-2 text-purple-600" />
                  Historique des relances ({clientReminders.length})
                </h3>
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="px-3 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                >
                  <Plus size={16} className="mr-2" />
                  Nouvelle relance
                </button>
              </div>
              
              {clientReminders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune relance enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {clientReminders
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((reminder) => (
                      <div key={reminder.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getReminderTypeIcon(reminder.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 capitalize">{reminder.type}</span>
                            <span className="text-sm text-gray-500">{formatDate(reminder.date)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{reminder.description}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Invoices */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText size={20} className="mr-2 text-blue-600" />
                Factures ({clientInvoices.length})
              </h3>
              
              {clientInvoices.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune facture trouvée</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facture</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Échéance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {clientInvoices
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {invoice.numeroFacture}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(invoice.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <span className={invoice.isOverdue ? 'text-red-600 font-medium' : ''}>
                                {formatDate(invoice.dateEcheance)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {formatCurrency(invoice.montantTotal)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              <span className={invoice.soldeRestant > 0 ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(invoice.soldeRestant)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.statutReglement)}`}>
                                {getStatusLabel(invoice.statutReglement)}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <ReminderModal
          client={client}
          onClose={() => setShowReminderModal(false)}
        />
      )}
    </>
  );
};

export default ClientDetailModal