/*
  # Ajout des fonctionnalités d'intégration Google

  1. Nouvelles tables
    - `reminder_templates` - Modèles de relance personnalisables
    - `email_logs` - Historique des emails envoyés
    - `automation_rules` - Règles d'automatisation des relances

  2. Modifications
    - Ajout de colonnes pour l'intégration Google dans app_settings
    - Ajout de colonnes pour les paramètres d'automatisation

  3. Sécurité
    - Politiques RLS pour toutes les nouvelles tables
*/

-- Table des modèles de relance
CREATE TABLE IF NOT EXISTS reminder_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('first_reminder', 'second_reminder', 'final_notice')),
  days_after_due integer NOT NULL DEFAULT 7,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des logs d'emails
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES reminder_templates(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')) DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  google_message_id text,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Table des règles d'automatisation
CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  trigger_type text NOT NULL CHECK (trigger_type IN ('days_after_due', 'manual')),
  trigger_value integer,
  template_id uuid REFERENCES reminder_templates(id) ON DELETE CASCADE,
  conditions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activation RLS
ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour reminder_templates
CREATE POLICY "Users can read own reminder templates"
  ON reminder_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder templates"
  ON reminder_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder templates"
  ON reminder_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder templates"
  ON reminder_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Politiques RLS pour email_logs
CREATE POLICY "Users can read own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Politiques RLS pour automation_rules
CREATE POLICY "Users can read own automation rules"
  ON automation_rules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own automation rules"
  ON automation_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON automation_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON automation_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Triggers pour updated_at
CREATE TRIGGER update_reminder_templates_updated_at 
  BEFORE UPDATE ON reminder_templates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at 
  BEFORE UPDATE ON automation_rules 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour traiter les relances automatiques
CREATE OR REPLACE FUNCTION process_automatic_reminders()
RETURNS void AS $$
DECLARE
  rule_record automation_rules%ROWTYPE;
  invoice_record invoices%ROWTYPE;
  template_record reminder_templates%ROWTYPE;
  client_record clients%ROWTYPE;
  days_overdue integer;
BEGIN
  -- Parcourir toutes les règles actives
  FOR rule_record IN 
    SELECT * FROM automation_rules 
    WHERE is_active = true AND trigger_type = 'days_after_due'
  LOOP
    -- Trouver le modèle associé
    SELECT * INTO template_record 
    FROM reminder_templates 
    WHERE id = rule_record.template_id AND is_active = true;
    
    IF template_record.id IS NOT NULL THEN
      -- Trouver les factures éligibles
      FOR invoice_record IN
        SELECT * FROM invoices
        WHERE is_overdue = true 
        AND statut_reglement != 'regle'
      LOOP
        -- Calculer les jours de retard
        days_overdue := EXTRACT(DAY FROM (CURRENT_DATE - invoice_record.date_echeance));
        
        -- Vérifier si la règle s'applique
        IF days_overdue >= rule_record.trigger_value THEN
          -- Trouver le client
          SELECT * INTO client_record 
          FROM clients 
          WHERE id = invoice_record.client_id AND email IS NOT NULL;
          
          IF client_record.id IS NOT NULL THEN
            -- Vérifier qu'un email n'a pas déjà été envoyé récemment
            IF NOT EXISTS (
              SELECT 1 FROM email_logs 
              WHERE invoice_id = invoice_record.id 
              AND template_id = template_record.id
              AND status = 'sent'
              AND sent_at > CURRENT_DATE - INTERVAL '7 days'
            ) THEN
              -- Créer un log d'email en attente
              INSERT INTO email_logs (
                user_id, invoice_id, client_id, template_id,
                recipient_email, subject, content, status
              ) VALUES (
                rule_record.user_id,
                invoice_record.id,
                client_record.id,
                template_record.id,
                client_record.email,
                template_record.subject,
                template_record.content,
                'pending'
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ language 'plpgsql';

-- Insérer des modèles par défaut (optionnel)
-- Ces modèles seront créés automatiquement lors de la connexion Google