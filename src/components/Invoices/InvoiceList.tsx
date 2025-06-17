import React, { useState, useMemo } from 'react';
import { Search, Filter, Edit, Trash2, Plus, Download, CreditCard, Eye, AlertTriangle, User, ChevronUp, ChevronDown } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Invoice } from '../../types';
import InvoiceModal from './InvoiceModal';
import PaymentModal from './PaymentModal';
import InvoiceDetailModal from './InvoiceDetailModal';
import ClientDetailModal from '../Clients/ClientDetailModal';
import ClientModal from '../Clients/ClientModal';

type SortField = 'numeroFacture' | 'clientName' | 'clientType' | 'dateEcheance' | 'montantTotal' | 'montantRegle' | 'soldeRestant' | 'statutReglement';
type SortDirection = 'asc' | 'desc';

const InvoiceList: React.FC = () => {
  const { 
    invoices, 
    selectedCompany, 
    selectedPeriod, 
    accountingPeriods, 
    updateInvoice, 
    deleteInvoice,
    clients,
    getClientByCompteTiers
  } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');
  const [overdueFilter, setOverdueFilter] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [showClientEdit, setShowClientEdit] = useState(false);
  const [sortField, setSortField] = useState<SortField>('numeroFacture');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const filteredInvoices = useMemo(() => {
    const currentPeriod = accountingPeriods.find(p => p.id === selectedPeriod);
    
    let filtered = invoices.filter(inv => inv.companyId === selectedCompany);

    // Filter by accounting period
    if (currentPeriod && currentPeriod.id !== 'all-periods') {
      filtered = filtered.filter(inv => {
        const invoiceDate = new Date(inv.date);
        const startDate = new Date(currentPeriod.startDate);
        const endDate = new Date(currentPeriod.endDate);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
    }

    // Apply filters
    filtered = filtered.filter(inv => {
      const matchesSearch = inv.numeroFacture.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.libelleEcriture.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.compteTiers.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || inv.statutReglement === statusFilter;
      const matchesClientType = clientTypeFilter === 'all' || inv.clientType === clientTypeFilter;
      
      // CORRECTION: Améliorer le filtre des factures en retard
      const matchesOverdue = !overdueFilter || (
        inv.soldeRestant > 0 && 
        inv.statutReglement !== 'regle' && 
        new Date() > new Date(inv.dateEcheance)
      );
      
      return matchesSearch && matchesStatus && matchesClientType && matchesOverdue;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField === 'dateEcheance') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle numeric fields
      if (['montantTotal', 'montantRegle', 'soldeRestant'].includes(sortField)) {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [invoices, selectedCompany, selectedPeriod, accountingPeriods, searchTerm, statusFilter, clientTypeFilter, overdueFilter, sortField, sortDirection]);

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

  const getClientTypeLabel = (type: string) => {
    switch (type) {
      case 'externe': return 'Externe';
      case 'interne': return 'Interne';
      case 'partenaire': return 'Partenaire';
      default: return type;
    }
  };

  // CORRECTION: Fonction pour vérifier si une facture est en retard
  const isInvoiceOverdue = (invoice: Invoice) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.dateEcheance);
    dueDate.setHours(0, 0, 0, 0);
    
    return (
      invoice.soldeRestant > 0 && 
      invoice.statutReglement !== 'regle' && 
      today > dueDate
    );
  };

  const openEditModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowModal(true);
  };

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const openDetailModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
  };

  const openCreateModal = () => {
    setSelectedInvoice(null);
    setShowModal(true);
  };

  const handleClientClick = (compteTiers: string) => {
    const client = getClientByCompteTiers(compteTiers);
    if (client) {
      setSelectedClient(client);
      setShowClientDetail(true);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date', 'N° Facture', 'Client', 'Type Client', 'Compte Tiers',
      'Montant Total', 'Montant Réglé', 'Solde Restant', 'Statut', 'Date Échéance', 'En Retard'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredInvoices.map(inv => [
        formatDate(inv.date),
        inv.numeroFacture,
        inv.clientName,
        getClientTypeLabel(inv.clientType),
        inv.compteTiers,
        inv.montantTotal,
        inv.montantRegle,
        inv.soldeRestant,
        getStatusLabel(inv.statutReglement),
        formatDate(inv.dateEcheance),
        isInvoiceOverdue(inv) ? 'Oui' : 'Non'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factures-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Factures</h1>
          <div className="flex gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={20} className="mr-2" />
              Export CSV
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Nouvelle Facture
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="regle">Réglées</option>
              <option value="partiel">Partielles</option>
              <option value="non_regle">Non réglées</option>
            </select>

            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les types</option>
              <option value="externe">Externe</option>
              <option value="interne">Interne</option>
              <option value="partenaire">Partenaire</option>
            </select>

            <label className="flex items-center px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={overdueFilter}
                onChange={(e) => setOverdueFilter(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Échéance dépassée</span>
            </label>

            <button className="flex items-center justify-center px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Filter size={20} className="mr-2" />
              Filtres
            </button>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('numeroFacture')}
                  >
                    <div className="flex items-center">
                      Facture
                      {getSortIcon('numeroFacture')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('clientName')}
                  >
                    <div className="flex items-center">
                      Client
                      {getSortIcon('clientName')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('clientType')}
                  >
                    <div className="flex items-center">
                      Type
                      {getSortIcon('clientType')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('dateEcheance')}
                  >
                    <div className="flex items-center">
                      Échéance
                      {getSortIcon('dateEcheance')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('montantTotal')}
                  >
                    <div className="flex items-center">
                      Montant Total
                      {getSortIcon('montantTotal')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('montantRegle')}
                  >
                    <div className="flex items-center">
                      Réglé
                      {getSortIcon('montantRegle')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('soldeRestant')}
                  >
                    <div className="flex items-center">
                      Solde
                      {getSortIcon('soldeRestant')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('statutReglement')}
                  >
                    <div className="flex items-center">
                      Statut
                      {getSortIcon('statutReglement')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  const isOverdue = isInvoiceOverdue(invoice);
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {isOverdue && (
                            <AlertTriangle size={16} className="text-red-500 mr-2" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{invoice.numeroFacture}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(invoice.date)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <button
                            onClick={() => handleClientClick(invoice.compteTiers)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {invoice.clientName}
                          </button>
                          <div className="text-sm text-gray-500">{invoice.compteTiers}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {getClientTypeLabel(invoice.clientType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {formatDate(invoice.dateEcheance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(invoice.montantTotal)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(invoice.montantRegle)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${invoice.soldeRestant > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(invoice.soldeRestant)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.statutReglement)}`}>
                          {getStatusLabel(invoice.statutReglement)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openDetailModal(invoice)}
                            className="text-gray-600 hover:text-gray-800 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleClientClick(invoice.compteTiers)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Voir client"
                          >
                            <User size={16} />
                          </button>
                          {invoice.soldeRestant > 0 && (
                            <button
                              onClick={() => openPaymentModal(invoice)}
                              className="text-green-600 hover:text-green-800 transition-colors"
                              title="Ajouter paiement"
                            >
                              <CreditCard size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(invoice)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Modifier"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice.id)}
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

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">Aucune facture trouvée</div>
              <p className="text-gray-400 mt-2">Essayez de modifier vos filtres ou créez une nouvelle facture</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}

      {showPaymentModal && selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}

      {showDetailModal && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}

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
    </>
  );
};

export default InvoiceList;