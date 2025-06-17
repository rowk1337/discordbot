import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Calendar, Mail, Phone, FileText, MessageSquare } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Client } from '../../types';

interface ReminderModalProps {
  client: Client;
  onClose: () => void;
  invoiceId?: string;
}

const ReminderModal: React.FC<ReminderModalProps> = ({ client, onClose, invoiceId }) => {
  const { addClientReminder } = useData();
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    type: 'email' as 'email' | 'telephone' | 'courrier' | 'autre',
    description: '',
    date: new Date().toISOString().split('T')[0]
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    addClientReminder({
      clientId: client.id,
      invoiceId: invoiceId || '',
      date: formData.date,
      type: formData.type,
      description: formData.description,
      createdBy: user?.id || ''
    });
    
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getReminderTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail size={20} className="text-blue-500" />;
      case 'telephone': return <Phone size={20} className="text-green-500" />;
      case 'courrier': return <FileText size={20} className="text-purple-500" />;
      default: return <MessageSquare size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Calendar size={24} className="mr-2 text-purple-600" />
            Nouvelle relance
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Client Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="text-sm text-gray-600">Client</div>
          <div className="font-medium text-gray-900">{client.name}</div>
          <div className="text-sm text-gray-500">{client.compteTiers}</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de relance
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de relance
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="email">Email</option>
              <option value="telephone">Téléphone</option>
              <option value="courrier">Courrier</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Décrivez la relance effectuée..."
              required
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
              className="flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Save size={20} className="mr-2" />
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderModal