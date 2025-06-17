/*
  # Schéma initial pour l'application PayTracker

  1. Nouvelles tables
    - `companies` - Sociétés
    - `accounting_periods` - Exercices comptables
    - `clients` - Clients
    - `invoices` - Factures
    - `payments` - Paiements
    - `client_reminders` - Relances clients
    - `notifications` - Notifications
    - `app_settings` - Paramètres application

  2. Sécurité
    - Activation RLS sur toutes les tables
    - Politiques pour les utilisateurs authentifiés
*/

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des sociétés
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des exercices comptables
CREATE TABLE IF NOT EXISTS accounting_periods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  compte_tiers text NOT NULL,
  type text NOT NULL CHECK (type IN ('externe', 'interne', 'partenaire')),
  email text,
  telephone text,
  commentaires text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, compte_tiers)
);

-- Table des factures
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  numero_facture text NOT NULL,
  reference text,
  compte_tiers text NOT NULL,
  libelle_ecriture text NOT NULL,
  mode_reglement text NOT NULL DEFAULT 'Virement',
  date_echeance date NOT NULL,
  statut_reglement text NOT NULL CHECK (statut_reglement IN ('regle', 'non_regle', 'partiel')) DEFAULT 'non_regle',
  montant_regle numeric(10,2) DEFAULT 0,
  date_dernier_reglement date,
  position_reglement text DEFAULT 'En attente',
  montant_a_regler numeric(10,2) NOT NULL,
  quantite_a_regler integer DEFAULT 1,
  debit numeric(10,2) NOT NULL,
  avoir numeric(10,2) DEFAULT 0,
  montant_total numeric(10,2) NOT NULL,
  solde_restant numeric(10,2) NOT NULL,
  client_name text NOT NULL,
  client_type text NOT NULL CHECK (client_type IN ('externe', 'interne', 'partenaire')),
  is_overdue boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, numero_facture)
);

-- Table des paiements
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  montant numeric(10,2) NOT NULL,
  date date NOT NULL,
  mode_reglement text NOT NULL,
  reference text,
  created_at timestamptz DEFAULT now()
);

-- Table des relances clients
CREATE TABLE IF NOT EXISTS client_reminders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('email', 'telephone', 'courrier', 'autre')),
  description text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment', 'invoice', 'reminder', 'warning')),
  title text NOT NULL,
  message text NOT NULL,
  date timestamptz DEFAULT now(),
  read boolean DEFAULT false,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Table des paramètres application
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  accent_color text DEFAULT '#3B82F6',
  notifications_settings jsonb DEFAULT '{"overdueInvoices": true, "newPayments": true, "dueDateReminders": true, "weeklyReport": false}',
  client_type_settings jsonb DEFAULT '{"externe": {"defaultPaymentDays": 30, "defaultPaymentMode": "Virement"}, "interne": {"defaultPaymentDays": 15, "defaultPaymentMode": "Virement"}, "partenaire": {"defaultPaymentDays": 60, "defaultPaymentMode": "Virement"}}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activation RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour companies
CREATE POLICY "Users can read all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour accounting_periods
CREATE POLICY "Users can read all accounting periods"
  ON accounting_periods
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert accounting periods"
  ON accounting_periods
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update accounting periods"
  ON accounting_periods
  FOR UPDATE
  TO authenticated
  USING (true);

-- Politiques RLS pour clients
CREATE POLICY "Users can read all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour invoices
CREATE POLICY "Users can read all invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (true);

-- Politiques RLS pour payments
CREATE POLICY "Users can read all payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politiques RLS pour client_reminders
CREATE POLICY "Users can read all client reminders"
  ON client_reminders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert client reminders"
  ON client_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politiques RLS pour notifications
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Politiques RLS pour app_settings
CREATE POLICY "Users can read own settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonctions pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounting_periods_updated_at BEFORE UPDATE ON accounting_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour recalculer automatiquement les soldes des factures
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric(10,2);
  invoice_total numeric(10,2);
  new_solde numeric(10,2);
  new_status text;
BEGIN
  -- Récupérer le montant total de la facture
  SELECT montant_total INTO invoice_total
  FROM invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Calculer le total payé
  SELECT COALESCE(SUM(montant), 0) INTO total_paid
  FROM payments
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Calculer le nouveau solde
  new_solde := invoice_total - total_paid;

  -- Déterminer le nouveau statut
  IF new_solde = 0 THEN
    new_status := 'regle';
  ELSIF total_paid > 0 THEN
    new_status := 'partiel';
  ELSE
    new_status := 'non_regle';
  END IF;

  -- Mettre à jour la facture
  UPDATE invoices SET
    montant_regle = total_paid,
    solde_restant = new_solde,
    montant_a_regler = new_solde,
    statut_reglement = new_status,
    position_reglement = CASE
      WHEN new_status = 'regle' THEN 'Soldé'
      WHEN new_status = 'partiel' THEN 'Partiel'
      ELSE 'En attente'
    END,
    date_dernier_reglement = CASE
      WHEN total_paid > 0 THEN (
        SELECT date FROM payments
        WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ORDER BY date DESC
        LIMIT 1
      )
      ELSE NULL
    END,
    is_overdue = (CURRENT_DATE > date_echeance AND new_solde > 0)
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Triggers pour recalculer automatiquement les totaux
CREATE TRIGGER recalculate_on_payment_insert
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER recalculate_on_payment_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

CREATE TRIGGER recalculate_on_payment_delete
  AFTER DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

-- Fonction pour mettre à jour is_overdue quotidiennement
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET is_overdue = (CURRENT_DATE > date_echeance AND solde_restant > 0)
  WHERE statut_reglement != 'regle';
END;
$$ language 'plpgsql';

-- Insérer des données initiales
INSERT INTO companies (id, name, color) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Société Alpha', '#3B82F6'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Société Beta', '#10B981'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Société Gamma', '#F59E0B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounting_periods (id, name, start_date, end_date, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440011', 'Tous les exercices', '2020-01-01', '2030-12-31', true),
  ('550e8400-e29b-41d4-a716-446655440012', 'Exercice 2024-2025', '2024-10-01', '2025-09-30', false),
  ('550e8400-e29b-41d4-a716-446655440013', 'Exercice 2023-2024', '2023-10-01', '2024-09-30', false)
ON CONFLICT (id) DO NOTHING;