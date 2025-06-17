import React, { useRef, useEffect } from 'react';
import { X, FileText, Calendar, User, CreditCard, Clock } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Invoice } from '../../types';

interface InvoiceDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
}

const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, onClose }) => {
  const { getInvoicePayments } = useData();
  const modalRef = useRef<HTMLDivElement>(null);
  const payments = getInvoicePayments(invoice.id);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText size={24} className="mr-2 text-blue-600" />
            Détails de la facture {invoice.numeroFacture}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Summary */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(invoice.statutReglement)}`}>
                {getStatusLabel(invoice.statutReglement)}
              </span>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.montantTotal)}</div>
                <div className="text-sm text-gray-500">Montant total</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-semibold text-green-600">{formatCurrency(invoice.montantRegle)}</div>
                <div className="text-sm text-green-700">Réglé</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-semibold text-red-600">{formatCurrency(invoice.soldeRestant)}</div>
                <div className="text-sm text-red-700">Solde restant</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">{payments.length}</div>
                <div className="text-sm text-blue-700">Paiements</div>
              </div>
            </div>
          </div>

          {/* Invoice Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText size={20} className="mr-2 text-blue-600" />
                Informations Facture
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">N° facture:</span>
                  <span className="font-medium">{invoice.numeroFacture}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Compte tiers:</span>
                  <span className="font-medium">{invoice.compteTiers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Libellé:</span>
                  <span className="font-medium">{invoice.libelleEcriture}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User size={20} className="mr-2 text-green-600" />
                Informations Client
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Client:</span>
                  <span className="font-medium">{invoice.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    {invoice.clientType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mode règlement:</span>
                  <span className="font-medium">{invoice.modeReglement}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar size={20} className="mr-2 text-purple-600" />
              Dates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700 mb-1">Date facture</div>
                <div className="font-semibold text-blue-900">
                  {new Date(invoice.date).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-sm text-orange-700 mb-1">Date échéance</div>
                <div className="font-semibold text-orange-900">
                  {new Date(invoice.dateEcheance).toLocaleDateString('fr-FR')}
                </div>
              </div>
              {invoice.dateDernierReglement && (
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-700 mb-1">Dernier règlement</div>
                  <div className="font-semibold text-green-900">
                    {new Date(invoice.dateDernierReglement).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CreditCard size={20} className="mr-2 text-green-600" />
                Historique des paiements
              </h3>
              <div className="space-y-3">
                {payments.map((payment, index) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-green-600">{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{formatCurrency(payment.montant)}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(payment.date).toLocaleDateString('fr-FR')} • {payment.modeReglement}
                          {payment.reference && ` • ${payment.reference}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-green-600">
                      <CreditCard size={20} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounting Details */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock size={20} className="mr-2 text-gray-600" />
              Détails comptables
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Débit</div>
                <div className="font-semibold text-gray-900">{formatCurrency(invoice.debit)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Avoir</div>
                <div className="font-semibold text-gray-900">{formatCurrency(invoice.avoir)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Quantité à régler</div>
                <div className="font-semibold text-gray-900">{invoice.quantiteARegler}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Position</div>
                <div className="font-semibold text-gray-900">{invoice.positionReglement}</div>
              </div>
            </div>
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
  );
};

export default InvoiceDetailModal;