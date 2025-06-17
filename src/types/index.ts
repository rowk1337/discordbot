interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  companies: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  color: string;
  logoUrl?: string;
  logoFileName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  compteTiers: string;
  type: 'externe' | 'interne' | 'partenaire';
  email?: string;
  telephone?: string;
  commentaires?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientReminder {
  id: string;
  clientId: string;
  invoiceId: string;
  date: string;
  type: 'email' | 'telephone' | 'courrier' | 'autre';
  description: string;
  createdBy: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  date: string;
  numeroFacture: string;
  reference: string;
  compteTiers: string;
  libelleEcriture: string;
  modeReglement: string;
  dateEcheance: string;
  statutReglement: 'regle' | 'non_regle' | 'partiel';
  montantRegle: number;
  dateDernierReglement?: string;
  positionReglement: string;
  montantARegler: number;
  quantiteARegler: number;
  debit: number;
  avoir: number;
  // Champs calculés
  montantTotal: number;
  soldeRestant: number;
  clientName: string;
  clientType: 'externe' | 'interne' | 'partenaire';
  datePrevisionnelleReglement?: string;
  isOverdue?: boolean;
}

export interface Payment {
  id: string;
  invoiceId: string;
  montant: number;
  date: string;
  modeReglement: string;
  reference?: string;
}

export interface Stats {
  totalInvoices: number;
  totalMontant: number;
  montantRegle: number;
  montantEnAttente: number;
  montantPartiel: number;
  soldeTotal: number;
  factunesReglees: number;
  facturesPartielles: number;
  facturesNonReglees: number;
  overdueInvoices: number;
}

export interface Notification {
  id: string;
  type: 'payment' | 'invoice' | 'reminder' | 'warning';
  title: string;
  message: string;
  date: string;
  read: boolean;
  invoiceId?: string;
}

interface GoogleIntegration {
  isConnected: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  connectedAt?: string;
}

export interface ReminderTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  type: 'first_reminder' | 'second_reminder' | 'final_notice';
  daysAfterDue: number;
  isActive: boolean;
}

export interface AutomationSettings {
  enabled: boolean;
  firstReminderDays: number;
  secondReminderDays: number;
  finalNoticeDays: number;
  sendFromEmail?: string;
  ccEmails: string[];
  workingDaysOnly: boolean;
  excludeWeekends: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  notifications: {
    overdueInvoices: boolean;
    newPayments: boolean;
    dueDateReminders: boolean;
    weeklyReport: boolean;
  };
  defaultClientTypes: {
    interne: string[];
    partenaire: string[];
  };
  clientTypeSettings?: {
    [key: string]: {
      defaultPaymentDays: number;
      defaultPaymentMode: string;
    };
  };
  googleIntegration?: GoogleIntegration;
  reminderTemplates?: ReminderTemplate[];
  automationSettings?: AutomationSettings;
}

export interface AccountingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface UserCompanyAccess {
  id: string;
  userId: string;
  companyId: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
}