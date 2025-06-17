import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Invoice } from '../../types';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, onClose }) => {
  const { addInvoice, updateInvoice, selectedCompany } = useData();
  const modalRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    date: '',
    numeroFacture: '',
    reference: '',
    compteTiers: '',
    libelleEcriture: '',
    modeReglement: 'Virement',
    dateEcheance: '',
    montantTotal: '',
    clientName: '',
    clientType: 'externe' as 'externe' | 'interne' | 'partenaire',
    debit: '',
    avoir: ''
  });

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

  useEffect(() => {
    if (invoice) {
      setFormData({
        date: invoice.date,
        numeroFacture: invoice.numeroFacture,
        reference: invoice.reference,
        compteTiers: invoice.compteTiers,
        libelleEcriture: invoice.libelleEcriture,
        modeReglement: invoice.modeReglement,
        dateEcheance: invoice.dateEcheance,
        montantTotal: invoice.montantTotal.toString(),
        clientName: invoice.clientName,
        clientType: invoice.clientType,
        debit: invoice.debit.toString(),
        avoir: invoice.avoir.toString()
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const echeance = new Date();
      echeance.setDate(echeance.getDate() + 30);
      
      setFormData({
        date: today,
        numeroFacture: `FAC${Date.now()}`,
        reference: '',
        compteTiers: '',
        libelleEcriture: '',
        modeReglement: 'Virement',
        dateEcheance: echeance.toISOString().split('T')[0],
        montantTotal: '',
        clientName: '',
        clientType: 'externe',
        debit: '',
        avoir: '0'
      });
    }
  }, [invoice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const montantTotal = parseFloat(formData.montantTotal);
    const debit = parseFloat(formData.debit) || montantTotal;
    const avoir = parseFloat(formData.avoir) || 0;
    
    const invoiceData = {
      companyId: selectedCompany,
      date: formData.date,
      numeroFacture: formData.numeroFacture,
      reference: formData.reference,
      compteTiers: formData.compteTiers,
      libelleEcriture: formData.libelleEcriture,
      modeReglement: formData.modeReglement,
      dateEcheance: formData.dateEcheance,
      statutReglement: 'non_regle' as const,
      montantRegle: 0,
      positionReglement: 'En attente',
      montantARegler: montantTotal,
      quantiteARegler: 1,
      debit,
      avoir,
      montantTotal,
      soldeRestant: montantTotal,
      clientName: formData.clientName,
      clientType: formData.clientType
    };

    if (invoice) {
      updateInvoice(invoice.id, invoiceData);
    } else {
      addInvoice(invoiceData);
    }
    
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-fill debit when montantTotal changes
    if (name === 'montantTotal') {
      setFormData(prev => ({ ...prev, debit: value }));
    }
    
    // Auto-generate client name from compteTiers
    if (name === 'compteTiers') {
      const clientName = `${value}`;
      setFormData(prev => ({ ...prev, clientName }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {invoice ? 'Modifier la facture' : 'Nouvelle facture'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de base</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° facture
                </label>
                <input
                  type="text"
                  name="numeroFacture"
                  value={formData.numeroFacture}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date échéance
                </label>
                <input
                  type="date"
                  name="dateEcheance"
                  value={formData.dateEcheance}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations client</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° Compte Tiers
                </label>
                <input
                  type="text"
                  name="compteTiers"
                  value={formData.compteTiers}
                  onChange={handleChange}
                  placeholder="00001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du client (généré automatiquement)
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de client
                </label>
                <select
                  name="clientType"
                  value={formData.clientType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="externe">Externe</option>
                  <option value="interne">Interne</option>
                  <option value="partenaire">Partenaire</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de règlement
                </label>
                <select
                  name="modeReglement"
                  value={formData.modeReglement}
                  onChange={handleChange}
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

          {/* Financial Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations financières</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant total (€)
                </label>
                <input
                  type="number"
                  name="montantTotal"
                  value={formData.montantTotal}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Débit (€)
                </label>
                <input
                  type="number"
                  name="debit"
                  value={formData.debit}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avoir (€)
                </label>
                <input
                  type="number"
                  name="avoir"
                  value={formData.avoir}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Libellé écriture
            </label>
            <textarea
              name="libelleEcriture"
              value={formData.libelleEcriture}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Description de la facture..."
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save size={20} className="mr-2" />
              {invoice ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceModal