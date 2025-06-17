import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables d\'environnement Supabase manquantes');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types pour TypeScript
export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounting_periods: {
        Row: {
          id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          compte_tiers: string;
          type: 'externe' | 'interne' | 'partenaire';
          email: string | null;
          telephone: string | null;
          commentaires: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          compte_tiers: string;
          type: 'externe' | 'interne' | 'partenaire';
          email?: string | null;
          telephone?: string | null;
          commentaires?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          compte_tiers?: string;
          type?: 'externe' | 'interne' | 'partenaire';
          email?: string | null;
          telephone?: string | null;
          commentaires?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          date: string;
          numero_facture: string;
          reference: string | null;
          compte_tiers: string;
          libelle_ecriture: string;
          mode_reglement: string;
          date_echeance: string;
          statut_reglement: 'regle' | 'non_regle' | 'partiel';
          montant_regle: number;
          date_dernier_reglement: string | null;
          position_reglement: string;
          montant_a_regler: number;
          quantite_a_regler: number;
          debit: number;
          avoir: number;
          montant_total: number;
          solde_restant: number;
          client_name: string;
          client_type: 'externe' | 'interne' | 'partenaire';
          is_overdue: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_id: string;
          date: string;
          numero_facture: string;
          reference?: string | null;
          compte_tiers: string;
          libelle_ecriture: string;
          mode_reglement?: string;
          date_echeance: string;
          statut_reglement?: 'regle' | 'non_regle' | 'partiel';
          montant_regle?: number;
          date_dernier_reglement?: string | null;
          position_reglement?: string;
          montant_a_regler: number;
          quantite_a_regler?: number;
          debit: number;
          avoir?: number;
          montant_total: number;
          solde_restant: number;
          client_name: string;
          client_type: 'externe' | 'interne' | 'partenaire';
          is_overdue?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          client_id?: string;
          date?: string;
          numero_facture?: string;
          reference?: string | null;
          compte_tiers?: string;
          libelle_ecriture?: string;
          mode_reglement?: string;
          date_echeance?: string;
          statut_reglement?: 'regle' | 'non_regle' | 'partiel';
          montant_regle?: number;
          date_dernier_reglement?: string | null;
          position_reglement?: string;
          montant_a_regler?: number;
          quantite_a_regler?: number;
          debit?: number;
          avoir?: number;
          montant_total?: number;
          solde_restant?: number;
          client_name?: string;
          client_type?: 'externe' | 'interne' | 'partenaire';
          is_overdue?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          montant: number;
          date: string;
          mode_reglement: string;
          reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          montant: number;
          date: string;
          mode_reglement: string;
          reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          montant?: number;
          date?: string;
          mode_reglement?: string;
          reference?: string | null;
          created_at?: string;
        };
      };
      client_reminders: {
        Row: {
          id: string;
          client_id: string;
          invoice_id: string | null;
          date: string;
          type: 'email' | 'telephone' | 'courrier' | 'autre';
          description: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          invoice_id?: string | null;
          date: string;
          type: 'email' | 'telephone' | 'courrier' | 'autre';
          description: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          invoice_id?: string | null;
          date?: string;
          type?: 'email' | 'telephone' | 'courrier' | 'autre';
          description?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'payment' | 'invoice' | 'reminder' | 'warning';
          title: string;
          message: string;
          date: string;
          read: boolean;
          invoice_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'payment' | 'invoice' | 'reminder' | 'warning';
          title: string;
          message: string;
          date?: string;
          read?: boolean;
          invoice_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'payment' | 'invoice' | 'reminder' | 'warning';
          title?: string;
          message?: string;
          date?: string;
          read?: boolean;
          invoice_id?: string | null;
          created_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: string;
          user_id: string;
          theme: 'light' | 'dark' | 'auto';
          accent_color: string;
          notifications_settings: any;
          client_type_settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: 'light' | 'dark' | 'auto';
          accent_color?: string;
          notifications_settings?: any;
          client_type_settings?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: 'light' | 'dark' | 'auto';
          accent_color?: string;
          notifications_settings?: any;
          client_type_settings?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};