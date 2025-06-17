import React from 'react';
import { FileText, DollarSign, CheckCircle, AlertCircle, TrendingUp, Clock, Percent } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import StatsCard from './StatsCard';

const Dashboard: React.FC = () => {
  const { companies, selectedCompany, invoices, getStats } = useData();
  
  const currentCompany = companies.find(c => c.id === selectedCompany);
  const stats = getStats(selectedCompany);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getRecentInvoices = () => {
    return invoices
      .filter(inv => inv.companyId === selectedCompany)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
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

  const tauxRecouvrement = stats.totalMontant > 0 
    ? ((stats.montantRegle / stats.totalMontant) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Tableau de bord - {currentCompany?.name}
        </h1>
        <p className="text-blue-100">
          Suivi comptable et gestion des règlements
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Factures"
          value={stats.totalInvoices}
          icon={FileText}
          color="bg-blue-500"
        />
        <StatsCard
          title="Montant Total"
          value={formatCurrency(stats.totalMontant)}
          icon={DollarSign}
          color="bg-purple-500"
        />
        <StatsCard
          title="Montant Réglé"
          value={formatCurrency(stats.montantRegle)}
          icon={CheckCircle}
          color="bg-green-500"
        />
        <StatsCard
          title="Solde Restant"
          value={formatCurrency(stats.soldeTotal)}
          icon={AlertCircle}
          color="bg-red-500"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Taux de Recouvrement"
          value={`${tauxRecouvrement}%`}
          icon={Percent}
          color="bg-indigo-500"
        />
        <StatsCard
          title="Factures Partielles"
          value={stats.facturesPartielles}
          icon={Clock}
          color="bg-orange-500"
        />
        <StatsCard
          title="Factures Non Réglées"
          value={stats.facturesNonReglees}
          icon={AlertCircle}
          color="bg-red-500"
        />
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp size={20} className="mr-2 text-blue-600" />
            Aperçu Financier
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <span className="text-green-800 font-medium">Montant Réglé</span>
              <span className="text-green-600 font-bold text-lg">
                {formatCurrency(stats.montantRegle)}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
              <span className="text-orange-800 font-medium">Règlements Partiels</span>
              <span className="text-orange-600 font-bold text-lg">
                {formatCurrency(stats.montantPartiel)}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <span className="text-red-800 font-medium">En Attente</span>
              <span className="text-red-600 font-bold text-lg">
                {formatCurrency(stats.montantEnAttente)}
              </span>
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Taux de Recouvrement</span>
                <span className="font-semibold text-gray-900">{tauxRecouvrement}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${tauxRecouvrement}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Factures Récentes
          </h3>
          <div className="space-y-3">
            {getRecentInvoices().map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{invoice.numeroFacture}</span>
                    <span className="text-gray-900 font-semibold">
                      {formatCurrency(invoice.montantTotal)}
                    </span>
                  </div>
                  <div className="flex items-center mt-1 text-sm text-gray-500">
                    <span>{invoice.clientName}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(invoice.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {invoice.soldeRestant > 0 && (
                    <div className="text-xs text-orange-600 mt-1">
                      Solde: {formatCurrency(invoice.soldeRestant)}
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.statutReglement)}`}>
                    {getStatusLabel(invoice.statutReglement)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;