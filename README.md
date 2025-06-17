# Système d'authentification Google OAuth

Ce projet implémente un système complet d'authentification Google OAuth avec les fonctionnalités suivantes :

## 🔧 Configuration requise

### 1. Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez les APIs suivantes :
   - Google+ API
   - Gmail API
4. Allez dans "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configurez l'écran de consentement OAuth
6. Créez les identifiants OAuth 2.0 :
   - Type d'application : Application Web
   - URIs de redirection autorisées : `https://votre-domaine.com/auth/google/callback`

### 2. Variables d'environnement Supabase

Ajoutez ces variables dans votre projet Supabase (Settings → Edge Functions → Environment Variables) :

```bash
GOOGLE_CLIENT_ID=votre_client_id_google
GOOGLE_CLIENT_SECRET=votre_client_secret_google
GOOGLE_REDIRECT_URI=https://votre-domaine.com/auth/google/callback
```

## 🚀 Fonctionnalités

### Authentification sécurisée
- ✅ Flux OAuth 2.0 complet
- ✅ Protection CSRF avec paramètre state
- ✅ Validation des jetons
- ✅ Gestion des jetons de rafraîchissement
- ✅ Révocation sécurisée des jetons

### Gestion des sessions
- ✅ Stockage sécurisé des jetons dans Supabase
- ✅ Rafraîchissement automatique des jetons expirés
- ✅ Déconnexion complète avec révocation

### Envoi d'emails
- ✅ Intégration Gmail API
- ✅ Modèles de relance personnalisables
- ✅ Variables dynamiques dans les emails
- ✅ Suivi des envois et erreurs

### Sécurité
- ✅ HTTPS requis en production
- ✅ Validation des paramètres OAuth
- ✅ Protection contre les attaques CSRF
- ✅ Gestion sécurisée des secrets

## 📁 Structure des fichiers

```
supabase/functions/
├── google-auth/index.ts          # Gestion OAuth (login, callback, logout, profile)
└── send-email/index.ts           # Envoi d'emails via Gmail API

src/
├── lib/googleAuth.ts             # Service client pour l'authentification
├── components/
│   ├── Auth/GoogleCallback.tsx   # Page de callback OAuth
│   ├── Settings/GoogleIntegrationSection.tsx  # Interface de configuration
│   └── Reminders/AutoReminderButton.tsx      # Bouton d'envoi automatique
```

## 🔄 Flux d'authentification

1. **Initiation** : L'utilisateur clique sur "Connecter Google"
2. **Redirection** : Redirection vers Google avec state CSRF
3. **Autorisation** : L'utilisateur autorise l'application
4. **Callback** : Google redirige avec le code d'autorisation
5. **Échange** : Le code est échangé contre des jetons d'accès
6. **Stockage** : Les jetons sont stockés de manière sécurisée
7. **Utilisation** : L'application peut maintenant envoyer des emails

## 🛡️ Mesures de sécurité

### Protection CSRF
- Génération d'un state aléatoire cryptographiquement sécurisé
- Validation du state lors du callback
- Stockage temporaire dans sessionStorage

### Gestion des jetons
- Stockage chiffré dans Supabase
- Rafraîchissement automatique avant expiration
- Révocation lors de la déconnexion

### Validation des données
- Vérification de tous les paramètres OAuth
- Validation des emails et contenus
- Gestion des erreurs avec logs détaillés

## 📧 Utilisation des emails

```typescript
import { googleAuth } from './lib/googleAuth';

// Envoyer un email de relance
await googleAuth.sendEmail(
  'client@example.com',
  'Rappel - Facture FAC001',
  'Contenu de l\'email...',
  {
    invoiceId: 'invoice-123',
    clientId: 'client-456',
    templateId: 'template-789'
  }
);
```

## 🔧 Configuration des modèles

Les modèles d'email supportent les variables suivantes :
- `{{numeroFacture}}` - Numéro de facture
- `{{montantTotal}}` - Montant total
- `{{soldeRestant}}` - Solde restant
- `{{dateFacture}}` - Date de facture
- `{{dateEcheance}}` - Date d'échéance
- `{{joursRetard}}` - Jours de retard
- `{{nomClient}}` - Nom du client
- `{{nomSociete}}` - Nom de la société

## 🚨 Gestion des erreurs

Le système gère automatiquement :
- Jetons expirés (rafraîchissement automatique)
- Erreurs réseau (retry avec backoff)
- Erreurs d'autorisation (déconnexion automatique)
- Erreurs d'envoi d'email (logging et notification)

## 📊 Monitoring

Tous les envois d'emails sont loggés dans la table `email_logs` avec :
- Statut d'envoi (pending, sent, failed)
- ID du message Gmail
- Horodatage d'envoi
- Messages d'erreur éventuels
- Statistiques d'ouverture (si configuré)

## 🔄 Déploiement

1. Déployez les Edge Functions :
```bash
supabase functions deploy google-auth
supabase functions deploy send-email
```

2. Configurez les variables d'environnement dans Supabase

3. Testez l'intégration avec un compte Google de test

4. Activez l'intégration en production

## 📝 Notes importantes

- Les jetons de rafraîchissement Google n'expirent pas mais peuvent être révoqués
- L'API Gmail a des limites de quota (250 quota units par utilisateur par seconde)
- Les emails envoyés apparaîtront dans les "Éléments envoyés" de Gmail
- La vérification du domaine peut être requise pour certaines fonctionnalités avancées