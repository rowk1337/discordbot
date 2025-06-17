import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, Users, Eye, Edit, Trash2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Client } from '../../types';
import ClientModal from './ClientModal';
import ClientDetailModal from './ClientDetailModal';

const ClientsTab: React.FC = () => {
  const { clients, selectedCompany, getClientInvoices } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredClients = useMemo(() => {
    return clients
      .filter(client => client.companyId === selectedCompany)
      .filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            client.compteTiers.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'all' || client.type === typeFilter;
        
        return matchesSearch && matchesType;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, selectedCompany, searchTerm, typeFilter]);

  const getClientTypeLabel = (type: string) => {
    switch (type) {
      case 'externe': return 'Externe';
      case 'interne': return 'Interne';
      case 'partenaire': return 'Partenaire';
      default: return type;
    }
  };

  const getClientTypeColor = (type: string) => {
    switch (type) {
      case 'externe': return 'bg-blue-100 text-blue-800';
      case 'interne': return 'bg-green-100 text-green-800';
      case 'partenaire': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setShowModal(true);
  };

  const openDetailModal = (client: Client) => {
    setSelectedClient(client);
    setShowDetailModal(true);
  };

  const openCreateModal = () => {
    setSelectedClient(null);
    setShowModal(true);
  };

  const getClientStats = (client: Client) => {
    const invoices = getClientInvoices(client.id);
    const totalMontant = invoices.reduce((sum, inv) => sum + inv.montantTotal, 0);
    const totalSolde = invoices.reduce((sum, inv) => sum + inv.soldeRestant, 0);
    
    return {
      totalInvoices: invoices.length,
      totalMontant,
      totalSolde
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users size={28} className="mr-3 text-blue-600" />
            Gestion des Clients
          </h1>
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Nouveau Client
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les types</option>
              <option value="externe">Externe</option>
              <option value="interne">Interne</option>
              <option value="partenaire">Partenaire</option>
            </select>

            <button className="flex items-center justify-center px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Filter size={20} className="mr-2" />
              Filtres avancés
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total clients</p>
                <p className="text-3xl font-bold text-gray-900">{filteredClients.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500">
                <Users size={24} className="text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Externes</p>
                <p className="text-3xl font-bold text-blue-600">
                  {filteredClients.filter(c => c.type === 'externe').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500">
                <Users size={24} className="text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Internes</p>
                <p className="text-3xl font-bold text-green-600">
                  {filteredClients.filter(c => c.type === 'interne').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-500">
                <Users size={24} className="text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Partenaires</p>
                <p className="text-3xl font-bold text-purple-600">
                  {filteredClients.filter(c => c.type === 'partenaire').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500">
                <Users size={24} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Factures
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solde dû
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClients.map((client) => {
                  const stats = getClientStats(client);
                  
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <button
                            onClick={() => openDetailModal(client)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {client.name}
                          </button>
                          <div className="text-sm text-gray-500">{client.compteTiers}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getClientTypeColor(client.type)}`}>
                          {getClientTypeLabel(client.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {client.email && (
                            <div className="text-gray-900">{client.email}</div>
                          )}
                          {client.telephone && (
                            <div className="text-gray-500">{client.telephone}</div>
                          )}
                          {!client.email && !client.telephone && (
                            <span className="text-gray-400">Non renseigné</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {stats.totalInvoices}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(stats.totalMontant)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${stats.totalSolde > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(stats.totalSolde)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openDetailModal(client)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openEditModal(client)}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Modifier"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto mb-3 text-gray-300" />
              <div className="text-gray-500 text-lg">Aucun client trouvé</div>
              <p className="text-gray-400 mt-2">Essayez de modifier vos filtres ou créez un nouveau client</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <ClientModal
          client={selectedClient}
          onClose={() => {
            setShowModal(false);
            setSelectedClient(null);
          }}
        />
      )}

      {showDetailModal && selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedClient(null);
          }}
          onEdit={() => {
            setShowDetailModal(false);
            setShowModal(true);
          }}
        />
      )}
    </>
  );
};

export default ClientsTab