# Documentation du Système d'Envoi d'Emails

## Vue d'ensemble

Ce système d'envoi d'emails robuste et personnalisé offre une solution complète pour la gestion automatisée des communications par email avec vos clients. Il comprend une file d'attente intelligente, une gestion d'erreurs avancée, et des options de personnalisation étendues.

## 🏗️ Architecture du Système

### Composants Principaux

1. **EmailQueue** (`src/lib/emailQueue.ts`)
   - Gestionnaire de file d'attente avec traitement asynchrone
   - Système de retry automatique avec backoff exponentiel
   - Classification intelligente des erreurs
   - Notifications en temps réel

2. **EmailTemplateEngine** (`src/lib/emailTemplates.ts`)
   - Moteur de templates avec variables dynamiques
   - Validation et prévisualisation des modèles
   - Génération HTML automatique
   - Modèles par défaut prêts à l'emploi

3. **UserPreferences** (`src/components/Email/UserPreferences.tsx`)
   - Interface de configuration utilisateur
   - Paramètres d'automatisation
   - Gestion des notifications
   - Test d'envoi d'emails

4. **EmailQueueManager** (`src/components/Email/EmailQueueManager.tsx`)
   - Interface de monitoring en temps réel
   - Gestion manuelle des jobs
   - Statistiques et analytics
   - Export des logs

## 🚀 Fonctionnalités Principales

### File d'Attente Intelligente

```typescript
// Ajouter un email à la file d'attente
await emailQueue.addEmail({
  to: 'client@example.com',
  subject: 'Rappel - Facture {{numeroFacture}}',
  content: 'Contenu personnalisé...',
  priority: 'high', // low, normal, high
  scheduledAt: new Date('2024-01-15T10:00:00'),
  metadata: {
    invoiceId: 'inv-123',
    clientId: 'client-456',
    type: 'reminder'
  }
});
```

**Caractéristiques :**
- **Priorités** : Gestion de 3 niveaux de priorité (low, normal, high)
- **Programmation** : Envoi différé avec planification précise
- **Traitement par lots** : Optimisation des performances avec traitement groupé
- **Persistance** : Sauvegarde automatique en cas de redémarrage

### Gestion d'Erreurs Avancée

Le système classifie automatiquement les erreurs et applique des stratégies de récupération appropriées :

#### Types d'Erreurs

1. **Erreurs d'Authentification**
   - Détection automatique des problèmes de tokens
   - Notification immédiate à l'utilisateur
   - Pas de retry automatique (nécessite une reconnexion)

2. **Erreurs de Quota**
   - Détection des limites Gmail API
   - Retry automatique avec délai adaptatif
   - Notification préventive avant saturation

3. **Erreurs Réseau**
   - Retry automatique avec backoff exponentiel
   - Délais : 1 min, 5 min, 15 min
   - Maximum 3 tentatives par défaut

4. **Erreurs de Validation**
   - Emails invalides détectés
   - Pas de retry (erreur définitive)
   - Log détaillé pour correction

#### Stratégie de Retry

```typescript
const RETRY_DELAYS = [60, 300, 900]; // 1min, 5min, 15min

// Configuration personnalisable
preferences.automation.retrySettings = {
  maxRetries: 3,
  retryDelays: [1, 5, 15] // en minutes
};
```

### Système de Templates

#### Variables Disponibles

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{numeroFacture}}` | Numéro de facture | FAC2024-001 |
| `{{montantTotal}}` | Montant total | 1 500,00 € |
| `{{soldeRestant}}` | Solde restant | 750,00 € |
| `{{dateFacture}}` | Date de facture | 15/01/2024 |
| `{{dateEcheance}}` | Date d'échéance | 15/02/2024 |
| `{{joursRetard}}` | Jours de retard | 15 |
| `{{nomClient}}` | Nom du client | Société ABC |
| `{{nomSociete}}` | Nom de la société | Ma Société |

#### Utilisation des Templates

```typescript
// Remplacer les variables dans un template
const emailContent = EmailTemplateEngine.replaceVariables(
  template.content,
  {
    numeroFacture: 'FAC2024-001',
    montantTotal: 1500,
    soldeRestant: 750,
    nomClient: 'Société ABC'
  },
  {
    name: 'Ma Société',
    address: '123 Rue de la Paix, 75001 Paris',
    phone: '01 23 45 67 89',
    email: 'contact@masociete.fr'
  }
);
```

#### Validation des Templates

```typescript
const validation = EmailTemplateEngine.validateTemplate(template);
if (!validation.isValid) {
  console.log('Erreurs:', validation.errors);
}
```

## ⚙️ Configuration et Personnalisation

### Préférences Utilisateur

#### Expéditeur par Défaut
```typescript
defaultSender: {
  name: 'Votre Nom',
  email: 'votre@email.com',
  signature: 'Cordialement,\nVotre équipe'
}
```

#### Automatisation
```typescript
automation: {
  enabled: true,
  workingHoursOnly: true,
  workingHours: { start: '09:00', end: '18:00' },
  excludeWeekends: true,
  maxDailyEmails: 50,
  retrySettings: {
    maxRetries: 3,
    retryDelays: [1, 5, 15]
  }
}
```

#### Notifications
```typescript
notifications: {
  emailSent: true,      // Succès d'envoi
  emailFailed: true,    // Échecs d'envoi
  queueFull: true,      // File d'attente pleine
  dailyReport: false    // Rapport quotidien
}
```

### Informations de l'Entreprise

```typescript
companyInfo: {
  name: 'Ma Société',
  address: '123 Rue de la Paix, 75001 Paris',
  phone: '01 23 45 67 89',
  email: 'contact@masociete.fr',
  website: 'https://www.masociete.fr'
}
```

## 📊 Monitoring et Analytics

### Interface de Monitoring

L'interface `EmailQueueManager` offre :

- **Vue en temps réel** de la file d'attente
- **Statistiques détaillées** (envoyés, échecs, en attente)
- **Filtrage avancé** par statut et période
- **Actions manuelles** (retry, annulation)
- **Export des logs** au format CSV

### Métriques Disponibles

```typescript
const stats = await emailQueue.getQueueStats();
// Retourne :
{
  pending: 5,     // En attente
  processing: 2,  // En cours
  sent: 1247,     // Envoyés
  failed: 23,     // Échecs
  total: 1277     // Total
}
```

### Logs Détaillés

Chaque email est tracé avec :
- **Horodatage** complet (création, traitement, envoi)
- **Métadonnées** (facture, client, template)
- **Statut détaillé** et messages d'erreur
- **ID Google** pour suivi dans Gmail
- **Tentatives** et historique des retries

## 🔧 Utilisation Pratique

### Envoi d'une Relance Automatique

```typescript
import { emailQueue } from '../lib/emailQueue';
import { EmailTemplateEngine } from '../lib/emailTemplates';

// 1. Préparer les données
const invoiceData = {
  numeroFacture: 'FAC2024-001',
  montantTotal: 1500,
  soldeRestant: 750,
  dateEcheance: '2024-02-15',
  nomClient: 'Société ABC'
};

// 2. Sélectionner le template
const template = reminderTemplates.find(t => t.type === 'first_reminder');

// 3. Générer le contenu
const subject = EmailTemplateEngine.replaceVariables(
  template.subject, 
  invoiceData, 
  companyInfo
);
const content = EmailTemplateEngine.replaceVariables(
  template.content, 
  invoiceData, 
  companyInfo
);

// 4. Ajouter à la file d'attente
await emailQueue.addEmail({
  to: client.email,
  subject,
  content,
  priority: 'normal',
  metadata: {
    invoiceId: invoice.id,
    clientId: client.id,
    templateId: template.id,
    type: 'reminder'
  }
});
```

### Test de Configuration

```typescript
// Tester l'envoi d'un email
const testResult = await emailQueue.addEmail({
  to: 'test@example.com',
  subject: 'Test de configuration',
  content: 'Ceci est un email de test.',
  priority: 'high'
});

console.log('Email de test ajouté:', testResult);
```

### Gestion des Erreurs Personnalisée

```typescript
// Écouter les notifications d'erreur
emailQueue.on('error', (error, job) => {
  if (error.type === 'authentication') {
    // Rediriger vers la page de reconnexion Google
    window.location.href = '/settings?tab=google';
  } else if (error.type === 'quota') {
    // Afficher une notification de quota
    showNotification('Limite Gmail atteinte, retry automatique dans 5 minutes');
  }
});
```

## 🛡️ Sécurité et Bonnes Pratiques

### Protection des Données

1. **Chiffrement** : Tous les tokens sont stockés de manière sécurisée
2. **Validation** : Validation stricte des adresses email
3. **Logs** : Pas de stockage des mots de passe ou tokens dans les logs
4. **RGPD** : Respect des règles de confidentialité

### Limites et Quotas

1. **Gmail API** : 250 quota units par utilisateur/seconde
2. **Emails quotidiens** : Configurable (défaut : 50/jour)
3. **File d'attente** : Nettoyage automatique des anciens jobs
4. **Retry** : Maximum 3 tentatives par email

### Recommandations

1. **Tester** régulièrement la configuration avec des emails de test
2. **Surveiller** les statistiques d'envoi et taux d'erreur
3. **Personnaliser** les templates selon votre secteur d'activité
4. **Configurer** les heures d'envoi selon votre clientèle
5. **Sauvegarder** régulièrement vos templates personnalisés

## 🔄 Maintenance et Dépannage

### Nettoyage Automatique

```typescript
// Nettoyer les anciens jobs (plus de 30 jours)
await emailQueue.cleanupOldJobs(30);
```

### Diagnostic des Problèmes

1. **Vérifier la connexion Google** dans les paramètres
2. **Consulter les logs** d'erreur dans le gestionnaire de file
3. **Tester l'envoi** avec un email de test
4. **Vérifier les quotas** Gmail dans la console Google Cloud

### Résolution des Erreurs Courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| Token expiré | Session Google expirée | Reconnecter le compte Google |
| Quota dépassé | Trop d'emails envoyés | Attendre ou augmenter les limites |
| Email invalide | Adresse incorrecte | Vérifier l'adresse dans les données client |
| Réseau | Problème de connexion | Vérifier la connexion internet |

## 📈 Évolutions Futures

### Fonctionnalités Prévues

1. **Templates visuels** avec éditeur WYSIWYG
2. **A/B Testing** des templates
3. **Statistiques d'ouverture** et de clic
4. **Intégration** avec d'autres providers (Outlook, SendGrid)
5. **Workflows** d'automatisation avancés
6. **API REST** pour intégrations externes

### Contributions

Le système est conçu pour être extensible. Les contributions sont les bienvenues pour :
- Nouveaux providers d'email
- Templates sectoriels
- Améliorations de l'interface
- Optimisations de performance

---

Cette documentation couvre l'ensemble du système d'envoi d'emails. Pour des questions spécifiques ou des besoins de personnalisation avancée, consultez le code source ou contactez l'équipe de développement.