import React, { useState, useRef, useEffect } from 'react';
import { X, CreditCard, Save } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Invoice } from '../../types';

interface PaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose }) => {
  const { addPayment } = useData();
  const modalRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    montant: invoice.soldeRestant.toString(),
    date: new Date().toISOString().split('T')[0],
    modeReglement: invoice.modeReglement || 'Virement',
    reference: ''
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const montant = parseFloat(formData.montant);
    if (montant <= 0 || montant > invoice.soldeRestant) {
      alert('Le montant doit être compris entre 0 et le solde restant');
      return;
    }

    addPayment(
      invoice.id,
      montant,
      formData.date,
      formData.modeReglement,
      formData.reference || undefined
    );
    
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setFullAmount = () => {
    setFormData(prev => ({ ...prev, montant: invoice.soldeRestant.toString() }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CreditCard size={24} className="mr-2 text-green-600" />
            Ajouter un paiement
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Invoice Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Facture:</span>
              <span className="text-sm font-medium">{invoice.numeroFacture}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Client:</span>
              <span className="text-sm font-medium">{invoice.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Montant total:</span>
              <span className="text-sm font-medium">{formatCurrency(invoice.montantTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Déjà réglé:</span>
              <span className="text-sm font-medium text-green-600">{formatCurrency(invoice.montantRegle)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-sm font-semibold text-gray-900">Solde restant:</span>
              <span className="text-sm font-semibold text-red-600">{formatCurrency(invoice.soldeRestant)}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant du paiement (€)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="montant"
                value={formData.montant}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                max={invoice.soldeRestant}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={setFullAmount}
                className="px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Solde complet
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de paiement
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
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Référence (optionnel)
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder="Numéro de chèque, référence virement..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
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
              className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save size={20} className="mr-2" />
              Enregistrer le paiement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;