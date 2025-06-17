import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, Database } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Invoice, Company, Stats, Payment, Notification, AppSettings, AccountingPeriod, Client, ClientReminder } from '../types';
import { googleAuth } from '../lib/googleAuth';

type Tables = Database['public']['Tables'];

interface DataContextType {
  companies: Company[];
  invoices: Invoice[];
  payments: Payment[];
  notifications: Notification[];
  settings: AppSettings;
  accountingPeriods: AccountingPeriod[];
  clients: Client[];
  clientReminders: ClientReminder[];
  selectedCompany: string;
  selectedPeriod: string;
  isLoading: boolean;
  setSelectedCompany: (companyId: string) => void;
  setSelectedPeriod: (periodId: string) => void;
  addInvoice: (invoice: Omit<Invoice, 'id'>) => Promise<void>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addPayment: (invoiceId: string, montant: number, date: string, mode: string, reference?: string) => Promise<void>;
  importInvoices: (invoiceData: any) => Promise<void>;
  getStats: (companyId?: string) => Stats;
  getInvoicePayments: (invoiceId: string) => Payment[];
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
  addCompany: (company: Omit<Company, 'id'>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  reorderCompanies: (companies: Company[]) => Promise<void>;
  reorderAccountingPeriods: (periods: AccountingPeriod[]) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  getUnreadNotifications: () => Notification[];
  addAccountingPeriod: (period: Omit<AccountingPeriod, 'id'>) => Promise<void>;
  updateAccountingPeriod: (id: string, updates: Partial<AccountingPeriod>) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  getOrCreateClient: (compteTiers: string, clientName: string, clientType: string) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  getClientByCompteTiers: (compteTiers: string) => Client | undefined;
  getClientInvoices: (clientId: string) => Invoice[];
  addClientReminder: (reminder: Omit<ClientReminder, 'id'>) => Promise<void>;
  getClientReminders: (clientId: string) => ClientReminder[];
  getOverdueInvoices: () => Invoice[];
  refreshData: () => Promise<void>;
  syncGoogleAuth: () => Promise<void>;
  forceSettingsSync: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

const initialSettings: AppSettings = {
  theme: 'light',
  accentColor: '#3B82F6',
  notifications: {
    overdueInvoices: true,
    newPayments: true,
    dueDateReminders: true,
    weeklyReport: false
  },
  defaultClientTypes: {
    interne: [],
    partenaire: []
  },
  clientTypeSettings: {
    externe: {
      defaultPaymentDays: 30,
      defaultPaymentMode: 'Virement'
    },
    interne: {
      defaultPaymentDays: 15,
      defaultPaymentMode: 'Virement'
    },
    partenaire: {
      defaultPaymentDays: 60,
      defaultPaymentMode: 'Virement'
    }
  },
  googleIntegration: {
    isConnected: false
  },
  reminderTemplates: [],
  automationSettings: {
    enabled: false,
    firstReminderDays: 7,
    secondReminderDays: 15,
    finalNoticeDays: 30,
    sendFromEmail: '',
    ccEmails: [],
    workingDaysOnly: true,
    excludeWeekends: true
  }
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [accountingPeriods, setAccountingPeriods] = useState<AccountingPeriod[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientReminders, setClientReminders] = useState<ClientReminder[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Fonction pour transformer les données de la DB vers les types de l'app
  const transformCompany = (dbCompany: Tables['companies']['Row']): Company => ({
    id: dbCompany.id,
    name: dbCompany.name,
    color: dbCompany.color,
    logoUrl: dbCompany.logo_url || undefined,
    logoFileName: dbCompany.logo_file_name || undefined,
    createdAt: dbCompany.created_at,
    updatedAt: dbCompany.updated_at
  });

  const transformClient = (dbClient: Tables['clients']['Row']): Client => ({
    id: dbClient.id,
    companyId: dbClient.company_id,
    name: dbClient.name,
    compteTiers: dbClient.compte_tiers,
    type: dbClient.type,
    email: dbClient.email || undefined,
    telephone: dbClient.telephone || undefined,
    commentaires: dbClient.commentaires || undefined,
    createdAt: dbClient.created_at,
    updatedAt: dbClient.updated_at
  });

  const transformInvoice = (dbInvoice: Tables['invoices']['Row']): Invoice => {
    // Calculer si la facture est en retard
    const today = new Date();
    const dueDate = new Date(dbInvoice.date_echeance);
    const isOverdue = today > dueDate && dbInvoice.solde_restant > 0;

    return {
      id: dbInvoice.id,
      companyId: dbInvoice.company_id,
      date: dbInvoice.date,
      numeroFacture: dbInvoice.numero_facture,
      reference: dbInvoice.reference || '',
      compteTiers: dbInvoice.compte_tiers,
      libelleEcriture: dbInvoice.libelle_ecriture,
      modeReglement: dbInvoice.mode_reglement,
      dateEcheance: dbInvoice.date_echeance,
      statutReglement: dbInvoice.statut_reglement,
      montantRegle: dbInvoice.montant_regle,
      dateDernierReglement: dbInvoice.date_dernier_reglement || undefined,
      positionReglement: dbInvoice.position_reglement,
      montantARegler: dbInvoice.montant_a_regler,
      quantiteARegler: dbInvoice.quantite_a_regler,
      debit: dbInvoice.debit,
      avoir: dbInvoice.avoir,
      montantTotal: dbInvoice.montant_total,
      soldeRestant: dbInvoice.solde_restant,
      clientName: dbInvoice.client_name,
      clientType: dbInvoice.client_type,
      isOverdue: isOverdue // Calculer côté client pour être sûr
    };
  };

  const transformPayment = (dbPayment: Tables['payments']['Row']): Payment => ({
    id: dbPayment.id,
    invoiceId: dbPayment.invoice_id,
    montant: dbPayment.montant,
    date: dbPayment.date,
    modeReglement: dbPayment.mode_reglement,
    reference: dbPayment.reference || undefined
  });

  const transformAccountingPeriod = (dbPeriod: Tables['accounting_periods']['Row']): AccountingPeriod => ({
    id: dbPeriod.id,
    name: dbPeriod.name,
    startDate: dbPeriod.start_date,
    endDate: dbPeriod.end_date,
    isActive: dbPeriod.is_active
  });

  const transformNotification = (dbNotification: Tables['notifications']['Row']): Notification => ({
    id: dbNotification.id,
    type: dbNotification.type,
    title: dbNotification.title,
    message: dbNotification.message,
    date: dbNotification.date,
    read: dbNotification.read,
    invoiceId: dbNotification.invoice_id || undefined
  });

  const transformClientReminder = (dbReminder: Tables['client_reminders']['Row']): ClientReminder => ({
    id: dbReminder.id,
    clientId: dbReminder.client_id,
    invoiceId: dbReminder.invoice_id || '',
    date: dbReminder.date,
    type: dbReminder.type,
    description: dbReminder.description,
    createdBy: dbReminder.created_by || ''
  });

  // Fonction pour synchroniser l'état Google Auth
  const syncGoogleAuth = async () => {
    if (!user) return;

    try {
      // Forcer la synchronisation avec la base de données
      const googleState = await googleAuth.forceSync();
      
      if (googleState) {
        // Mettre à jour les paramètres locaux
        setSettings(prev => ({
          ...prev,
          googleIntegration: googleState
        }));

        // Mettre à jour la base de données si nécessaire
        const { data: currentSettings } = await supabase
          .from('app_settings')
          .select('google_integration_settings')
          .eq('user_id', user.id)
          .single();

        if (currentSettings?.google_integration_settings?.isConnected !== googleState.isConnected) {
          await updateSettings({
            googleIntegration: googleState
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation Google Auth:', error);
    }
  };

  // Fonction pour charger les modèles de relance depuis la base de données
  const loadReminderTemplates = async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');

      if (error) {
        console.error('Erreur lors du chargement des modèles:', error);
        return [];
      }

      return data?.map(template => ({
        id: template.id,
        name: template.name,
        subject: template.subject,
        content: template.content,
        type: template.type,
        daysAfterDue: template.days_after_due,
        isActive: template.is_active
      })) || [];
    } catch (error) {
      console.error('Erreur lors du chargement des modèles:', error);
      return [];
    }
  };

  // Fonction pour charger les règles d'automatisation depuis la base de données
  const loadAutomationRules = async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')
        .limit(1);

      if (error) {
        console.error('Erreur lors du chargement des règles d\'automatisation:', error);
        return null;
      }

      if (data && data.length > 0) {
        const rule = data[0];
        return {
          enabled: rule.is_active,
          firstReminderDays: 7,
          secondReminderDays: 15,
          finalNoticeDays: 30,
          sendFromEmail: '',
          ccEmails: [],
          workingDaysOnly: true,
          excludeWeekends: true,
          ...rule.conditions
        };
      }

      return null;
    } catch (error) {
      console.error('Erreur lors du chargement des règles d\'automatisation:', error);
      return null;
    }
  };

  // Fonction pour forcer la synchronisation des paramètres
  const forceSettingsSync = async () => {
    if (!user) return;

    try {
      console.log('🔄 Synchronisation forcée des paramètres...');
      
      const { data: settingsData, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.log('❌ Aucun paramètre trouvé, création des paramètres par défaut...');
        await createDefaultSettings();
        setSettings(initialSettings);
      } else if (settingsData) {
        console.log('✅ Paramètres chargés depuis la base de données');
        
        // Charger les modèles de relance
        const reminderTemplates = await loadReminderTemplates();
        
        // Charger les règles d'automatisation
        const automationSettings = await loadAutomationRules();
        
        const loadedSettings: AppSettings = {
          theme: settingsData.theme,
          accentColor: settingsData.accent_color,
          notifications: settingsData.notifications_settings,
          defaultClientTypes: { interne: [], partenaire: [] },
          clientTypeSettings: settingsData.client_type_settings,
          googleIntegration: settingsData.google_integration_settings || { isConnected: false },
          reminderTemplates: reminderTemplates,
          automationSettings: automationSettings || initialSettings.automationSettings
        };
        setSettings(loadedSettings);
      }

      // Synchroniser l'état Google Auth
      await syncGoogleAuth();
      setSettingsLoaded(true);
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation des paramètres:', error);
      setSettings(initialSettings);
      setSettingsLoaded(true);
    }
  };

  // Fonction pour créer les paramètres par défaut
  const createDefaultSettings = async () => {
    if (!user) return;

    try {
      console.log('🆕 Création des paramètres par défaut pour l\'utilisateur:', user.id);
      
      const { error } = await supabase
        .from('app_settings')
        .insert({
          user_id: user.id,
          theme: initialSettings.theme,
          accent_color: initialSettings.accentColor,
          notifications_settings: initialSettings.notifications,
          client_type_settings: initialSettings.clientTypeSettings,
          google_integration_settings: initialSettings.googleIntegration
        });

      if (error) {
        console.error('❌ Erreur lors de la création des paramètres par défaut:', error);
      } else {
        console.log('✅ Paramètres par défaut créés avec succès');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la création des paramètres par défaut:', error);
    }
  };

  // Charger toutes les données
  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Charger les sociétés
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at');

      if (companiesError) throw companiesError;
      const transformedCompanies = companiesData.map(transformCompany);
      setCompanies(transformedCompanies);

      // Sélectionner la première société par défaut
      if (transformedCompanies.length > 0 && !selectedCompany) {
        setSelectedCompany(transformedCompanies[0].id);
      }

      // Charger les exercices comptables
      const { data: periodsData, error: periodsError } = await supabase
        .from('accounting_periods')
        .select('*')
        .order('created_at');

      if (periodsError) throw periodsError;
      const transformedPeriods = periodsData.map(transformAccountingPeriod);
      setAccountingPeriods(transformedPeriods);

      // Sélectionner le premier exercice par défaut
      if (transformedPeriods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(transformedPeriods[0].id);
      }

      // Charger les clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;
      setClients(clientsData.map(transformClient));

      // Charger les factures
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('date', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData.map(transformInvoice));

      // Charger les paiements
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('date', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData.map(transformPayment));

      // Charger les relances
      const { data: remindersData, error: remindersError } = await supabase
        .from('client_reminders')
        .select('*')
        .order('date', { ascending: false });

      if (remindersError) throw remindersError;
      setClientReminders(remindersData.map(transformClientReminder));

      // Charger les notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (notificationsError) throw notificationsError;
      setNotifications(notificationsData.map(transformNotification));

      // Charger les paramètres en dernier
      await forceSettingsSync();

    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  useEffect(() => {
    if (user) {
      console.log('👤 Utilisateur connecté, chargement des données...');
      loadData();
    } else {
      // Réinitialiser les données si l'utilisateur se déconnecte
      console.log('👤 Utilisateur déconnecté, réinitialisation...');
      setCompanies([]);
      setInvoices([]);
      setPayments([]);
      setNotifications([]);
      setAccountingPeriods([]);
      setClients([]);
      setClientReminders([]);
      setSettings(initialSettings);
      setSelectedCompany('');
      setSelectedPeriod('');
      setSettingsLoaded(false);
      setIsLoading(false);
    }
  }, [user]);

  // Synchroniser Google Auth périodiquement seulement si les paramètres sont chargés
  useEffect(() => {
    if (user && settingsLoaded) {
      const interval = setInterval(() => {
        syncGoogleAuth();
      }, 60000); // Toutes les 60 secondes
      return () => clearInterval(interval);
    }
  }, [user, settingsLoaded]);

  // Fonctions CRUD pour les sociétés
  const addCompany = async (company: Omit<Company, 'id'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: company.name,
        color: company.color,
        logo_url: company.logoUrl,
        logo_file_name: company.logoFileName
      })
      .select()
      .single();

    if (error) throw error;

    const newCompany = transformCompany(data);
    setCompanies(prev => [...prev, newCompany]);
  };

  const updateCompany = async (id: string, updates: Partial<Company>) => {
    if (!user) return;

    const { error } = await supabase
      .from('companies')
      .update({
        name: updates.name,
        color: updates.color,
        logo_url: updates.logoUrl,
        logo_file_name: updates.logoFileName
      })
      .eq('id', id);

    if (error) throw error;

    setCompanies(prev => prev.map(company => 
      company.id === id ? { ...company, ...updates } : company
    ));
  };

  const deleteCompany = async (id: string) => {
    if (!user || companies.length <= 1) return;

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    setCompanies(prev => prev.filter(company => company.id !== id));
    
    if (selectedCompany === id) {
      const remainingCompanies = companies.filter(c => c.id !== id);
      if (remainingCompanies.length > 0) {
        setSelectedCompany(remainingCompanies[0].id);
      }
    }
  };

  const reorderCompanies = async (newCompanies: Company[]) => {
    setCompanies(newCompanies);
    // Note: Pour un vrai réordonnancement, vous pourriez ajouter un champ 'order' dans la DB
  };

  // Fonctions CRUD pour les clients
  const addClient = async (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: client.companyId,
        name: client.name,
        compte_tiers: client.compteTiers,
        type: client.type,
        email: client.email,
        telephone: client.telephone,
        commentaires: client.commentaires
      })
      .select()
      .single();

    if (error) throw error;

    const newClient = transformClient(data);
    setClients(prev => [...prev, newClient]);
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    if (!user) return;

    const { error } = await supabase
      .from('clients')
      .update({
        name: updates.name,
        compte_tiers: updates.compteTiers,
        type: updates.type,
        email: updates.email,
        telephone: updates.telephone,
        commentaires: updates.commentaires
      })
      .eq('id', id);

    if (error) throw error;

    setClients(prev => prev.map(client => 
      client.id === id ? { ...client, ...updates, updatedAt: new Date().toISOString() } : client
    ));
  };
  
  // Function to get or create a client by compte tiers
  const getOrCreateClient = async (compteTiers: string, clientName: string, clientType: string): Promise<Client> => {
    if (!user) throw new Error('User not authenticated');
    
    // First check if client exists
    let client = clients.find(c => c.compteTiers === compteTiers && c.companyId === selectedCompany);
    
    if (client) {
      return client;
    }
    
    // Create new client if not found
    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: selectedCompany,
        name: clientName,
        compte_tiers: compteTiers,
        type: clientType as 'externe' | 'interne' | 'partenaire'
      })
      .select()
      .single();

    if (error) throw error;
    
    const newClient = transformClient(data);
    setClients(prev => [...prev, newClient]);
    
    return newClient;
  };

  // Fonctions CRUD pour les factures
  const addInvoice = async (invoice: Omit<Invoice, 'id'>) => {
    if (!user) return;

    // Trouver ou créer le client
    let client = clients.find(c => c.compteTiers === invoice.compteTiers);
    if (!client) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          company_id: invoice.companyId,
          name: invoice.clientName,
          compte_tiers: invoice.compteTiers,
          type: invoice.clientType
        })
        .select()
        .single();

      if (clientError) throw clientError;
      client = transformClient(clientData);
      setClients(prev => [...prev, client!]);
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        company_id: invoice.companyId,
        client_id: client.id,
        date: invoice.date,
        numero_facture: invoice.numeroFacture,
        reference: invoice.reference,
        compte_tiers: invoice.compteTiers,
        libelle_ecriture: invoice.libelleEcriture,
        mode_reglement: invoice.modeReglement,
        date_echeance: invoice.dateEcheance,
        statut_reglement: invoice.statutReglement,
        montant_regle: invoice.montantRegle,
        date_dernier_reglement: invoice.dateDernierReglement,
        position_reglement: invoice.positionReglement,
        montant_a_regler: invoice.montantARegler,
        quantite_a_regler: invoice.quantiteARegler,
        debit: invoice.debit,
        avoir: invoice.avoir,
        montant_total: invoice.montantTotal,
        solde_restant: invoice.soldeRestant,
        client_name: invoice.clientName,
        client_type: invoice.clientType,
        is_overdue: invoice.isOverdue || false
      })
      .select()
      .single();

    if (error) throw error;

    const newInvoice = transformInvoice(data);
    setInvoices(prev => [...prev, newInvoice]);
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    if (!user) return;

    const { error } = await supabase
      .from('invoices')
      .update({
        date: updates.date,
        numero_facture: updates.numeroFacture,
        reference: updates.reference,
        compte_tiers: updates.compteTiers,
        libelle_ecriture: updates.libelleEcriture,
        mode_reglement: updates.modeReglement,
        date_echeance: updates.dateEcheance,
        montant_total: updates.montantTotal,
        debit: updates.debit,
        avoir: updates.avoir,
        client_name: updates.clientName,
        client_type: updates.clientType
      })
      .eq('id', id);

    if (error) throw error;

    setInvoices(prev => prev.map(invoice => 
      invoice.id === id ? { ...invoice, ...updates } : invoice
    ));
  };

  const deleteInvoice = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
    setPayments(prev => prev.filter(payment => payment.invoiceId !== id));
  };

  // Fonctions CRUD pour les paiements
  const addPayment = async (invoiceId: string, montant: number, date: string, mode: string, reference?: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('payments')
      .insert({
        invoice_id: invoiceId,
        montant,
        date,
        mode_reglement: mode,
        reference
      })
      .select()
      .single();

    if (error) throw error;

    const newPayment = transformPayment(data);
    setPayments(prev => [...prev, newPayment]);

    // Créer une notification
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'payment',
          title: 'Nouveau paiement reçu',
          message: `Paiement de ${montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} reçu pour la facture ${invoice.numeroFacture}`,
          invoice_id: invoiceId
        });

      // Recharger les notifications
      const { data: notificationsData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (notificationsData) {
        setNotifications(notificationsData.map(transformNotification));
      }
    }

    // Les totaux seront recalculés automatiquement par les triggers de la DB
    await refreshData();
  };

  // Autres fonctions...
  const addClientReminder = async (reminder: Omit<ClientReminder, 'id'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('client_reminders')
      .insert({
        client_id: reminder.clientId,
        invoice_id: reminder.invoiceId || null,
        date: reminder.date,
        type: reminder.type,
        description: reminder.description,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    const newReminder = transformClientReminder(data);
    setClientReminders(prev => [...prev, newReminder]);
  };

  const markNotificationAsRead = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) throw error;

    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  // Fonction pour sauvegarder les modèles de relance
  const saveReminderTemplates = async (templates: any[]) => {
    if (!user) return;

    try {
      // Supprimer tous les anciens modèles
      await supabase
        .from('reminder_templates')
        .delete()
        .eq('user_id', user.id);

      // Insérer les nouveaux modèles
      if (templates.length > 0) {
        const { error } = await supabase
          .from('reminder_templates')
          .insert(
            templates.map(template => ({
              user_id: user.id,
              name: template.name,
              subject: template.subject,
              content: template.content,
              type: template.type,
              days_after_due: template.daysAfterDue,
              is_active: template.isActive
            }))
          );

        if (error) {
          console.error('Erreur lors de la sauvegarde des modèles:', error);
          throw error;
        }
      }

      console.log('✅ Modèles de relance sauvegardés avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des modèles:', error);
      throw error;
    }
  };

  // Fonction pour sauvegarder les règles d'automatisation
  const saveAutomationSettings = async (automationSettings: any) => {
    if (!user) return;

    try {
      // Supprimer les anciennes règles
      await supabase
        .from('automation_rules')
        .delete()
        .eq('user_id', user.id);

      // Insérer la nouvelle règle
      const { error } = await supabase
        .from('automation_rules')
        .insert({
          user_id: user.id,
          name: 'Règle d\'automatisation principale',
          is_active: automationSettings.enabled,
          trigger_type: 'days_after_due',
          trigger_value: automationSettings.firstReminderDays,
          conditions: automationSettings
        });

      if (error) {
        console.error('Erreur lors de la sauvegarde des règles d\'automatisation:', error);
        throw error;
      }

      console.log('✅ Règles d\'automatisation sauvegardées avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des règles d\'automatisation:', error);
      throw error;
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    if (!user) return;

    console.log('💾 Mise à jour des paramètres:', updates);

    const newSettings = { ...settings, ...updates };

    try {
      // Sauvegarder les paramètres de base
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          user_id: user.id,
          theme: newSettings.theme,
          accent_color: newSettings.accentColor,
          notifications_settings: newSettings.notifications,
          client_type_settings: newSettings.clientTypeSettings,
          google_integration_settings: newSettings.googleIntegration
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Erreur lors de la mise à jour des paramètres:', error);
        throw error;
      }

      // Sauvegarder les modèles de relance si fournis
      if (updates.reminderTemplates) {
        await saveReminderTemplates(updates.reminderTemplates);
      }

      // Sauvegarder les règles d'automatisation si fournies
      if (updates.automationSettings) {
        await saveAutomationSettings(updates.automationSettings);
      }

      console.log('✅ Paramètres mis à jour avec succès');
      setSettings(newSettings);
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour des paramètres:', error);
      throw error;
    }
  };

  const addAccountingPeriod = async (period: Omit<AccountingPeriod, 'id'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('accounting_periods')
      .insert({
        name: period.name,
        start_date: period.startDate,
        end_date: period.endDate,
        is_active: period.isActive
      })
      .select()
      .single();

    if (error) throw error;

    const newPeriod = transformAccountingPeriod(data);
    setAccountingPeriods(prev => [...prev, newPeriod]);
  };

  const updateAccountingPeriod = async (id: string, updates: Partial<AccountingPeriod>) => {
    if (!user) return;

    const { error } = await supabase
      .from('accounting_periods')
      .update({
        name: updates.name,
        start_date: updates.startDate,
        end_date: updates.endDate,
        is_active: updates.isActive
      })
      .eq('id', id);

    if (error) throw error;

    setAccountingPeriods(prev => prev.map(period => 
      period.id === id ? { ...period, ...updates } : period
    ));
  };

  const reorderAccountingPeriods = async (newPeriods: AccountingPeriod[]) => {
    setAccountingPeriods(newPeriods);
  };

  const importInvoices = async (invoiceData: any) => {
    if (!user) return;

    try {
      // Get or create client
      const client = await getOrCreateClient(
        invoiceData.compteTiers,
        invoiceData.clientName,
        invoiceData.clientType
      );
      
      // Create the invoice
      const { error } = await supabase
        .from('invoices')
        .insert({
          company_id: invoiceData.companyId,
          client_id: client.id,
          date: invoiceData.date,
          numero_facture: invoiceData.numeroFacture,
          reference: invoiceData.reference,
          compte_tiers: invoiceData.compteTiers,
          libelle_ecriture: invoiceData.libelleEcriture,
          mode_reglement: invoiceData.modeReglement,
          date_echeance: invoiceData.dateEcheance,
          statut_reglement: invoiceData.statutReglement,
          montant_regle: invoiceData.montantRegle,
          date_dernier_reglement: invoiceData.dateDernierReglement,
          position_reglement: invoiceData.positionReglement,
          montant_a_regler: invoiceData.montantARegler,
          quantite_a_regler: invoiceData.quantiteARegler,
          debit: invoiceData.debit,
          avoir: invoiceData.avoir,
          montant_total: invoiceData.montantTotal,
          solde_restant: invoiceData.soldeRestant,
          client_name: invoiceData.clientName,
          client_type: invoiceData.clientType,
          is_overdue: invoiceData.isOverdue || false
        });

      if (error) {
        throw error;
      }
      
      // Refresh data to include the new invoice
      await refreshData();
      
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw new Error('Format de fichier invalide');
    }
  };

  // Fonctions utilitaires
  const getStats = (companyId?: string): Stats => {
    const currentPeriod = accountingPeriods.find(p => p.id === selectedPeriod);
    let filteredInvoices = companyId 
      ? invoices.filter(inv => inv.companyId === companyId)
      : invoices;

    if (currentPeriod && currentPeriod.id !== 'all-periods') {
      filteredInvoices = filteredInvoices.filter(inv => {
        const invoiceDate = new Date(inv.date);
        const startDate = new Date(currentPeriod.startDate);
        const endDate = new Date(currentPeriod.endDate);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
    }

    return {
      totalInvoices: filteredInvoices.length,
      totalMontant: filteredInvoices.reduce((sum, inv) => sum + inv.montantTotal, 0),
      montantRegle: filteredInvoices.reduce((sum, inv) => sum + inv.montantRegle, 0),
      montantEnAttente: filteredInvoices.filter(inv => inv.statutReglement === 'non_regle').reduce((sum, inv) => sum + inv.montantTotal, 0),
      montantPartiel: filteredInvoices.filter(inv => inv.statutReglement === 'partiel').reduce((sum, inv) => sum + inv.soldeRestant, 0),
      soldeTotal: filteredInvoices.reduce((sum, inv) => sum + inv.soldeRestant, 0),
      factunesReglees: filteredInvoices.filter(inv => inv.statutReglement === 'regle').length,
      facturesPartielles: filteredInvoices.filter(inv => inv.statutReglement === 'partiel').length,
      facturesNonReglees: filteredInvoices.filter(inv => inv.statutReglement === 'non_regle').length,
      overdueInvoices: filteredInvoices.filter(inv => inv.isOverdue).length
    };
  };

  const getInvoicePayments = (invoiceId: string): Payment[] => {
    return payments.filter(p => p.invoiceId === invoiceId);
  };

  const getClientByCompteTiers = (compteTiers: string): Client | undefined => {
    return clients.find(client => client.compteTiers === compteTiers);
  };

  const getClientInvoices = (clientId: string): Invoice[] => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return [];
    return invoices.filter(inv => inv.compteTiers === client.compteTiers);
  };

  const getClientReminders = (clientId: string): ClientReminder[] => {
    return clientReminders.filter(reminder => reminder.clientId === clientId);
  };

  // CORRECTION: Fonction pour obtenir les factures en retard
  const getOverdueInvoices = (): Invoice[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour une comparaison précise
    
    return invoices.filter(invoice => {
      // Vérifier que la facture a un solde restant
      if (invoice.soldeRestant <= 0) return false;
      
      // Vérifier que la facture n'est pas complètement réglée
      if (invoice.statutReglement === 'regle') return false;
      
      // Comparer la date d'échéance avec aujourd'hui
      const dueDate = new Date(invoice.dateEcheance);
      dueDate.setHours(0, 0, 0, 0);
      
      return today > dueDate;
    });
  };

  const getUnreadNotifications = (): Notification[] => {
    return notifications.filter(notif => !notif.read).slice(0, 5);
  };

  return (
    <DataContext.Provider value={{
      companies,
      invoices,
      payments,
      notifications,
      settings,
      accountingPeriods,
      clients,
      clientReminders,
      selectedCompany,
      selectedPeriod,
      isLoading,
      setSelectedCompany,
      setSelectedPeriod,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addPayment,
      importInvoices,
      getStats,
      getInvoicePayments,
      updateCompany,
      addCompany,
      deleteCompany,
      reorderCompanies,
      reorderAccountingPeriods,
      updateSettings,
      markNotificationAsRead,
      getUnreadNotifications,
      addAccountingPeriod,
      updateAccountingPeriod,
      addClient,
      updateClient,
      getClientByCompteTiers,
      getClientInvoices,
      addClientReminder,
      getClientReminders,
      getOrCreateClient,
      getOverdueInvoices,
      refreshData,
      syncGoogleAuth,
      forceSettingsSync
    }}>
      {children}
    </DataContext.Provider>
  );
};