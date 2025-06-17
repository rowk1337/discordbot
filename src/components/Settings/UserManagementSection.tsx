import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Mail, 
  Building2, 
  Eye, 
  EyeOff,
  UserCheck,
  UserX,
  Search,
  Filter,
  Key,
  Send,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Link,
  Copy
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AdminUserCreation from '../Auth/AdminUserCreation';

const UserManagementSection: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { companies } = useData();
  const [users, setUsers] = useState<any[]>([]);
  const [userAccess, setUserAccess] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Vérifier si l'utilisateur actuel est admin
  const isCurrentUserAdmin = currentUser?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (isCurrentUserAdmin) {
      loadUsers();
      loadUserAccess();
    }
  }, [isCurrentUserAdmin]);

  const loadUsers = async () => {
    try {
      setError(null);
      
      console.log('🔍 Chargement des utilisateurs via RPC...');
      console.log('👤 Utilisateur actuel:', currentUser?.email);
      console.log('🔑 Rôle actuel:', currentUser?.user_metadata?.role);
      
      // Utiliser la fonction RPC sécurisée
      const { data, error } = await supabase.rpc('get_users_list');

      if (error) {
        console.error('❌ Erreur RPC:', error);
        setError(`Erreur lors du chargement: ${error.message}`);
        return;
      }

      console.log('📦 Réponse RPC:', data);

      if (!data.success) {
        setError(data.error || 'Erreur inconnue lors du chargement des utilisateurs');
        return;
      }

      console.log('✅ Utilisateurs chargés:', data.data?.length || 0);
      setUsers(data.data || []);
    } catch (error: any) {
      console.error('❌ Erreur générale:', error);
      setError(`Erreur lors du chargement des utilisateurs: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserAccess = async () => {
    try {
      console.log('🔍 Chargement des accès utilisateurs via RPC...');
      
      // Utiliser la nouvelle fonction RPC sécurisée
      const { data, error } = await supabase.rpc('get_user_company_access');

      if (error) {
        console.error('❌ Erreur lors du chargement des accès:', error);
        setError(`Erreur lors du chargement des accès: ${error.message}`);
        return;
      }

      console.log('✅ Accès utilisateurs chargés:', data?.length || 0);
      setUserAccess(data || []);
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement des accès:', error);
      setError(`Erreur lors du chargement des accès: ${error.message}`);
    }
  };

  const checkCurrentUserRole = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      const { data, error } = await supabase.rpc('check_user_role');
      
      if (error) {
        console.error('Erreur lors de la vérification du rôle:', error);
        setError(`Erreur lors de la vérification: ${error.message}`);
        return;
      }
      
      console.log('🔍 Rôle vérifié:', data);
      
      if (data !== 'admin') {
        setError(`Votre rôle actuel est "${data}". Seuls les administrateurs peuvent accéder à cette section.`);
      } else {
        setSuccess('Rôle administrateur confirmé');
        await loadUsers();
      }
    } catch (error: any) {
      console.error('Erreur lors de la vérification du rôle:', error);
      setError(`Erreur lors de la vérification: ${error.message}`);
    }
  };

  const getUserCompanies = (userId: string) => {
    const access = userAccess.filter(a => a.user_id === userId);
    return access.map(a => ({
      ...a,
      companyName: a.company_name || 'Société inconnue'
    }));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.raw_user_meta_data?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || (user.raw_user_meta_data?.role || 'user') === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = () => {
    setShowCreateUserForm(true);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handlePromoteToAdmin = async (email: string) => {
    try {
      setError(null);
      setSuccess(null);
      
      const { data, error } = await supabase.rpc('promote_to_admin', { target_email: email });
      
      if (error) {
        throw error;
      }
      
      if (data.success) {
        setSuccess(data.message);
        await loadUsers();
      } else {
        setError(data.error);
      }
    } catch (error: any) {
      console.error('Erreur lors de la promotion:', error);
      setError(`Erreur lors de la promotion: ${error.message}`);
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      setError(null);
      setSuccess(null);
      
      const banDuration = isActive ? '876000h' : 'none'; // 100 ans pour désactiver, none pour activer
      
      const { data, error } = await supabase.rpc('toggle_user_status', { 
        target_user_id: userId,
        ban_duration: banDuration
      });
      
      if (error) {
        throw error;
      }
      
      if (data.success) {
        setSuccess(data.message);
        await loadUsers();
      } else {
        setError(data.error);
      }
    } catch (error: any) {
      console.error('Erreur lors de la modification du statut:', error);
      setError(`Erreur lors de la modification du statut: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      const { data, error } = await supabase.rpc('delete_user_account', { 
        target_user_id: userId
      });
      
      if (error) {
        throw error;
      }
      
      if (data.success) {
        setSuccess(data.message);
        await loadUsers();
      } else {
        setError(data.error);
      }
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      setError(`Erreur lors de la suppression: ${error.message}`);
    }
  };

  const handleResendSetupLink = async (email: string) => {
    try {
      setError(null);
      setSuccess(null);
      
      const { data, error } = await supabase.rpc('resend_password_setup_link', { 
        user_email: email
      });
      
      if (error) {
        throw error;
      }
      
      if (data.success) {
        setSuccess(`${data.message}. Lien: ${data.setup_url}`);
      } else {
        setError(data.error);
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi du lien:', error);
      setError(`Erreur lors de l'envoi du lien: ${error.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Lien copié dans le presse-papiers');
    setTimeout(() => setSuccess(null), 3000);
  };

  if (!isCurrentUserAdmin) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Shield size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Accès restreint</h3>
          <p className="text-gray-600 mb-4">
            Seuls les administrateurs peuvent accéder à la gestion des utilisateurs.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Votre rôle actuel: <span className="font-medium">{currentUser?.user_metadata?.role || 'non défini'}</span>
          </p>
          <button
            onClick={checkCurrentUserRole}
            className="flex items-center mx-auto px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw size={16} className="mr-2" />
            Vérifier mes permissions
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des utilisateurs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gestion des Utilisateurs</h3>
          <p className="text-gray-600 mt-1">
            Gérez les utilisateurs et leurs accès aux différentes sociétés.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadUsers}
            className="flex items-center px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={16} className="mr-2" />
            Actualiser
          </button>
          <button
            onClick={handleCreateUser}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Créer un utilisateur
          </button>
        </div>
      </div>

      {/* Messages d'état */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle size={20} className="text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800 mb-1">Erreur</h4>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle size={20} className="text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-green-800 mb-1">Succès</h4>
              <p className="text-green-700 text-sm whitespace-pre-line">{success}</p>
              {success.includes('https://') && (
                <button
                  onClick={() => {
                    const url = success.match(/https:\/\/[^\s]+/)?.[0];
                    if (url) copyToClipboard(url);
                  }}
                  className="mt-2 flex items-center text-green-600 hover:text-green-800 text-sm"
                >
                  <Copy size={14} className="mr-1" />
                  Copier le lien
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create User Form */}
      {showCreateUserForm && (
        <AdminUserCreation 
          onUserCreated={() => {
            loadUsers();
            setShowCreateUserForm(false);
          }} 
        />
      )}

      {/* Information importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield size={20} className="text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Gestion sécurisée des utilisateurs</h4>
            <p className="text-blue-700 text-sm">
              Les nouveaux utilisateurs recevront un lien de configuration sécurisé qui expire après 7 jours.
              Ils devront définir leur mot de passe en utilisant ce lien.
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Administrateurs</option>
            <option value="user">Utilisateurs</option>
          </select>

          <div className="flex items-center text-sm text-gray-600">
            <Users size={16} className="mr-2" />
            {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sociétés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé le
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const userCompanies = getUserCompanies(user.id);
                const role = user.raw_user_meta_data?.role || 'user';
                const name = user.raw_user_meta_data?.full_name || user.email;
                const isActive = user.email_confirmed_at !== null && (!user.banned_until || new Date(user.banned_until) <= new Date());
                const needsPasswordSetup = user.raw_user_meta_data?.password_setup_required === true;
                const passwordChangeRequired = user.raw_user_meta_data?.password_change_required === true;
                
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {(name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {(needsPasswordSetup || passwordChangeRequired) && (
                            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Key size={12} className="mr-1" />
                              {needsPasswordSetup ? 'Mot de passe à définir' : 'Changement requis'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {userCompanies.length === 0 ? (
                          <span className="text-sm text-gray-400">Toutes les sociétés</span>
                        ) : (
                          userCompanies.map((access) => (
                            <span
                              key={access.id}
                              className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded"
                            >
                              {access.companyName}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </button>
                        {role !== 'admin' && (
                          <button
                            onClick={() => handlePromoteToAdmin(user.email)}
                            className="text-purple-600 hover:text-purple-800 transition-colors"
                            title="Promouvoir administrateur"
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        {needsPasswordSetup && (
                          <button
                            onClick={() => handleResendSetupLink(user.email)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Renvoyer le lien de configuration"
                          >
                            <Link size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleUserStatus(user.id, isActive)}
                          className={`transition-colors ${
                            isActive 
                              ? 'text-orange-600 hover:text-orange-800' 
                              : 'text-green-600 hover:text-green-800'
                          }`}
                          title={isActive ? 'Désactiver' : 'Activer'}
                        >
                          {isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto mb-3 text-gray-300" />
            <div className="text-gray-500 text-lg">Aucun utilisateur trouvé</div>
            <p className="text-gray-400 mt-2">Essayez de modifier vos filtres ou créez un nouvel utilisateur</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && selectedUser && (
        <UserModal
          user={selectedUser}
          companies={companies}
          userAccess={userAccess}
          onClose={() => {
            setShowModal(false);
            setSelectedUser(null);
          }}
          onSave={() => {
            loadUsers();
            loadUserAccess();
            setShowModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

// Modal de création/modification d'utilisateur
const UserModal: React.FC<{
  user: any;
  companies: any[];
  userAccess: any[];
  onClose: () => void;
  onSave: () => void;
}> = ({ user, companies, userAccess, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    name: user?.raw_user_meta_data?.full_name || '',
    role: user?.raw_user_meta_data?.role || 'user',
    selectedCompanies: user ? userAccess.filter(a => a.user_id === user.id).map(a => a.company_id) : [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setSetupUrl(null);

    try {
      if (user) {
        // Modification d'un utilisateur existant
        const { data, error } = await supabase.rpc('update_user_role', {
          target_user_id: user.id,
          new_role: formData.role
        });

        if (error) throw error;

        if (data.success) {
          setSuccess('Utilisateur modifié avec succès');
        } else {
          setError(data.error);
        }
      } else {
        // Création d'un nouvel utilisateur avec lien de configuration
        const { data, error } = await supabase.rpc('create_user_with_setup_link', {
          user_email: formData.email,
          user_role: formData.role,
          user_name: formData.name || null
        });

        if (error) throw error;

        if (data.success) {
          setSuccess(`Utilisateur créé avec succès. Un lien de configuration a été généré.`);
          setSetupUrl(data.setup_url);
        } else {
          setError(data.error);
        }
      }

      // Attendre 3 secondes avant de fermer pour que l'utilisateur puisse lire le message
      setTimeout(() => {
        onSave();
      }, 3000);

    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyToggle = (companyId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedCompanies: prev.selectedCompanies.includes(companyId)
        ? prev.selectedCompanies.filter(id => id !== companyId)
        : [...prev.selectedCompanies, companyId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(prev => prev + '\n\nLien copié dans le presse-papiers');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {user ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm whitespace-pre-line">{success}</p>
              {setupUrl && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-green-800 mb-1">Lien de configuration :</p>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={setupUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-white border border-green-300 rounded-lg text-green-800"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(setupUrl)}
                      className="ml-2 p-2 text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                      title="Copier le lien"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    Partagez ce lien avec l'utilisateur pour qu'il puisse définir son mot de passe.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!user}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet (optionnel)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom complet de l'utilisateur"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rôle
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Les administrateurs ont accès à toutes les sociétés et à la gestion des utilisateurs.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Accès aux sociétés
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Laissez vide pour donner accès à toutes les sociétés (recommandé pour les administrateurs).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {companies.map((company) => (
                <label key={company.id} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.selectedCompanies.includes(company.id)}
                    onChange={() => handleCompanyToggle(company.id)}
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    {company.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={`Logo ${company.name}`}
                        className="w-6 h-6 object-contain rounded mr-3"
                      />
                    ) : (
                      <div 
                        className="w-6 h-6 rounded mr-3"
                        style={{ backgroundColor: company.color }}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-900">{company.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

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
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              )}
              {user ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagementSection;