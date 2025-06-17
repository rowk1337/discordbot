import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw,
  Trash2,
  Eye,
  Filter,
  Download
} from 'lucide-react';
import { emailQueue, EmailJob } from '../../lib/emailQueue';

const EmailQueueManager: React.FC = () => {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    total: 0
  });
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'sent' | 'failed'>('all');
  const [selectedJob, setSelectedJob] = useState<EmailJob | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Actualiser toutes les 5 secondes
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const queueStats = await emailQueue.getQueueStats();
      setStats(queueStats);
      
      // Charger les jobs depuis localStorage pour la démo
      const queue = JSON.parse(localStorage.getItem('email_queue') || '[]');
      setJobs(queue);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  const getStatusIcon = (status: EmailJob['status']) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="text-yellow-500" />;
      case 'processing': return <Mail size={16} className="text-blue-500 animate-pulse" />;
      case 'sent': return <CheckCircle size={16} className="text-green-500" />;
      case 'failed': return <XCircle size={16} className="text-red-500" />;
      case 'cancelled': return <XCircle size={16} className="text-gray-500" />;
      default: return <AlertTriangle size={16} className="text-gray-500" />;
    }
  };

  const getStatusLabel = (status: EmailJob['status']) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En cours';
      case 'sent': return 'Envoyé';
      case 'failed': return 'Échec';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  const getPriorityColor = (priority: EmailJob['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await emailQueue.retryJob(jobId);
      await loadData();
    } catch (error) {
      console.error('Erreur lors de la reprise du job:', error);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await emailQueue.cancelJob(jobId);
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'annulation du job:', error);
    }
  };

  const handleCleanup = async () => {
    try {
      await emailQueue.cleanupOldJobs(7); // Nettoyer les jobs de plus de 7 jours
      await loadData();
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['ID', 'Destinataire', 'Objet', 'Statut', 'Priorité', 'Tentatives', 'Créé le', 'Traité le', 'Erreur'].join(','),
      ...filteredJobs.map(job => [
        job.id,
        job.to,
        `"${job.subject}"`,
        getStatusLabel(job.status),
        job.priority,
        `${job.currentRetries}/${job.maxRetries}`,
        job.scheduledAt ? new Date(job.scheduledAt).toLocaleString('fr-FR') : '',
        job.processedAt ? new Date(job.processedAt).toLocaleString('fr-FR') : '',
        `"${job.errorMessage || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Gestionnaire de file d'attente email</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleCleanup}
            className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
          >
            <Trash2 size={16} className="mr-2" />
            Nettoyer
          </button>
          <button
            onClick={exportLogs}
            className="px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center"
          >
            <Download size={16} className="mr-2" />
            Exporter
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock size={24} className="text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
            </div>
            <Mail size={24} className="text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Envoyés</p>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            </div>
            <CheckCircle size={24} className="text-green-500" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Échecs</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle size={24} className="text-red-500" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Mail size={24} className="text-gray-500" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center space-x-4">
        <Filter size={20} className="text-gray-500" />
        <div className="flex space-x-2">
          {(['all', 'pending', 'processing', 'sent', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'Tous' : getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des jobs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinataire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tentatives</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Programmé</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(job.status)}
                      <span className="ml-2 text-sm text-gray-900">
                        {getStatusLabel(job.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{job.to}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {job.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(job.priority)}`}>
                      {job.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {job.currentRetries}/{job.maxRetries}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString('fr-FR') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setShowDetails(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Voir détails"
                      >
                        <Eye size={16} />
                      </button>
                      
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="text-green-600 hover:text-green-800 transition-colors"
                          title="Réessayer"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                      
                      {(job.status === 'pending' || job.status === 'failed') && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Annuler"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <Mail size={48} className="mx-auto mb-3 text-gray-300" />
            <div className="text-gray-500 text-lg">Aucun email dans la file d'attente</div>
            <p className="text-gray-400 mt-2">
              {filter === 'all' 
                ? 'La file d\'attente est vide' 
                : `Aucun email avec le statut "${getStatusLabel(filter)}"`
              }
            </p>
          </div>
        )}
      </div>

      {/* Modal de détails */}
      {showDetails && selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => {
            setShowDetails(false);
            setSelectedJob(null);
          }}
          onRetry={() => handleRetryJob(selectedJob.id)}
          onCancel={() => handleCancelJob(selectedJob.id)}
        />
      )}
    </div>
  );
};

// Modal de détails d'un job
const JobDetailsModal: React.FC<{
  job: EmailJob;
  onClose: () => void;
  onRetry: () => void;
  onCancel: () => void;
}> = ({ job, onClose, onRetry, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Détails de l'email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informations générales */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Informations générales</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">ID:</span>
                <span className="ml-2 font-mono">{job.id}</span>
              </div>
              <div>
                <span className="text-gray-600">Statut:</span>
                <span className="ml-2">{job.status}</span>
              </div>
              <div>
                <span className="text-gray-600">Priorité:</span>
                <span className="ml-2">{job.priority}</span>
              </div>
              <div>
                <span className="text-gray-600">Tentatives:</span>
                <span className="ml-2">{job.currentRetries}/{job.maxRetries}</span>
              </div>
            </div>
          </div>

          {/* Contenu de l'email */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Contenu de l'email</h4>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600 text-sm">Destinataire:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded">{job.to}</div>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Objet:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded">{job.subject}</div>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Contenu:</span>
                <div className="mt-1 p-3 bg-gray-50 rounded max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">
                  {job.content}
                </div>
              </div>
            </div>
          </div>

          {/* Métadonnées */}
          {job.metadata && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Métadonnées</h4>
              <div className="text-sm space-y-2">
                {job.metadata.invoiceId && (
                  <div>
                    <span className="text-gray-600">Facture:</span>
                    <span className="ml-2">{job.metadata.invoiceId}</span>
                  </div>
                )}
                {job.metadata.clientId && (
                  <div>
                    <span className="text-gray-600">Client:</span>
                    <span className="ml-2">{job.metadata.clientId}</span>
                  </div>
                )}
                {job.metadata.type && (
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2">{job.metadata.type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Erreur */}
          {job.errorMessage && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Erreur</h4>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {job.errorMessage}
              </div>
            </div>
          )}

          {/* Dates */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Horodatage</h4>
            <div className="text-sm space-y-2">
              {job.scheduledAt && (
                <div>
                  <span className="text-gray-600">Programmé:</span>
                  <span className="ml-2">{new Date(job.scheduledAt).toLocaleString('fr-FR')}</span>
                </div>
              )}
              {job.processedAt && (
                <div>
                  <span className="text-gray-600">Traité:</span>
                  <span className="ml-2">{new Date(job.processedAt).toLocaleString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          {job.status === 'failed' && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <RotateCcw size={16} className="mr-2" />
              Réessayer
            </button>
          )}
          
          {(job.status === 'pending' || job.status === 'failed') && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center"
            >
              <XCircle size={16} className="mr-2" />
              Annuler
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailQueueManager;